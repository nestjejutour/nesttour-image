/**
 * 미리보기 그림 창고
 *
 * 현수막 .ai 100개의 미리보기를 제안서 자료와 같은 칸(localStorage)에 넣으면
 * 금세 꽉 찬다. 그림은 따로 IndexedDB 에 둔다 — 여기는 수백 MB 를 받는다.
 * (되돌리기가 뜨는 묶음에도 그림이 끼지 않아 가볍다)
 */

const DB = "mtmb-thumbs";
const 칸 = "thumbs";
/** 원본 파일 칸. 현수막 .ai 가 1MB 안팎이라 100개도 들어간다 */
const 원본칸 = "files";

let 열린것: Promise<IDBDatabase> | null = null;

function 열기(): Promise<IDBDatabase> {
  if (열린것) return 열린것;
  열린것 = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 2);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(칸)) r.result.createObjectStore(칸);
      if (!r.result.objectStoreNames.contains(원본칸)) r.result.createObjectStore(원본칸);
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return 열린것;
}

async function 한번<T>(mode: IDBTransactionMode, 일: (s: IDBObjectStore) => IDBRequest, 어느칸 = 칸): Promise<T> {
  const db = await 열기();
  return new Promise((res, rej) => {
    const t = db.transaction(어느칸, mode);
    const req = 일(t.objectStore(어느칸));
    req.onsuccess = () => res(req.result as T);
    req.onerror = () => rej(req.error);
  });
}

export const putThumb = (id: string, dataUrl: string) =>
  한번<void>("readwrite", (s) => s.put(dataUrl, id));

export const getThumb = (id: string) =>
  한번<string | undefined>("readonly", (s) => s.get(id));

export const delThumb = (id: string) =>
  한번<void>("readwrite", (s) => s.delete(id));

/** 쓰이지 않는 그림은 치운다 (자료를 지웠는데 그림만 남아 있으면 안 된다) */
export async function 쓸어담기(살릴것: Set<string>) {
  const ids = await 한번<IDBValidKey[]>("readonly", (s) => s.getAllKeys());
  for (const k of ids) if (typeof k === "string" && !살릴것.has(k)) await delThumb(k);
}


/* ── 원본 파일 ── */

export const putFile = (id: string, blob: Blob) =>
  한번<void>("readwrite", (s) => s.put(blob, id), 원본칸);

export const getFile = (id: string) =>
  한번<Blob | undefined>("readonly", (s) => s.get(id), 원본칸);

export const delFile = (id: string) =>
  한번<void>("readwrite", (s) => s.delete(id), 원본칸);

/** 이 기기에서 쓰고 있는 자리 */
export async function 쓰는자리(): Promise<{ 쓴것: number; 줄것: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    if (!e) return null;
    return { 쓴것: e.usage ?? 0, 줄것: e.quota ?? 0 };
  } catch { return null; }
}


/* ── 통째로 백업하고 되돌리기 ── */

/**
 * 칸에 든 열쇠를 전부 센다.
 *
 * 자료 목록(db.library)만 돌면 "목록에서는 지웠는데 칸에는 남은 것"을 놓친다.
 * 백업은 놓친 것이 있으면 안 되므로 칸을 직접 훑는다.
 */
export const 모든그림키 = () =>
  한번<IDBValidKey[]>("readonly", (s) => s.getAllKeys());

export const 모든원본키 = () =>
  한번<IDBValidKey[]>("readonly", (s) => s.getAllKeys(), 원본칸);

/**
 * 두 칸을 통째로 갈아 끼운다 — 되는 것만 되고 마는 일이 없게.
 *
 * 복원은 "전부 아니면 전무" 여야 한다.
 * 그림만 바뀌고 원본은 옛것으로 남으면, 미리보기와 실제 파일이 어긋난 채로
 * 대표님이 그걸 모르고 쓰게 된다. 그 편이 아예 실패하는 것보다 나쁘다.
 *
 * IndexedDB 의 거래(transaction)는 한 덩어리로 묶이면 통째로 되돌아간다.
 * 그래서 두 칸을 한 거래에 넣고, 비우고 채우는 일을 거기서 다 한다.
 * 도중에 자리가 모자라거나 탈이 나면 손대기 전으로 되돌아간다.
 */
export async function 통째로바꾸기(
  그림들: Map<string, string>,
  원본들: Map<string, Blob>,
): Promise<void> {
  const db = await 열기();
  return new Promise((res, rej) => {
    const t = db.transaction([칸, 원본칸], "readwrite");
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error ?? new Error("되돌렸습니다"));
    t.onabort = () => rej(t.error ?? new Error("되돌렸습니다"));

    const 그림칸 = t.objectStore(칸);
    const 파일칸 = t.objectStore(원본칸);
    그림칸.clear();
    파일칸.clear();
    for (const [id, v] of 그림들) 그림칸.put(v, id);
    for (const [id, v] of 원본들) 파일칸.put(v, id);
  });
}
