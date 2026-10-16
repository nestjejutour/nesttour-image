/**
 * 미리보기 그림 창고
 *
 * 현수막 .ai 100개의 미리보기를 제안서 자료와 같은 칸(localStorage)에 넣으면
 * 금세 꽉 찬다. 그림은 따로 IndexedDB 에 둔다 — 여기는 수백 MB 를 받는다.
 * (되돌리기가 뜨는 묶음에도 그림이 끼지 않아 가볍다)
 */

const DB = "mtmb-thumbs";
const 칸 = "thumbs";

let 열린것: Promise<IDBDatabase> | null = null;

function 열기(): Promise<IDBDatabase> {
  if (열린것) return 열린것;
  열린것 = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(칸)) r.result.createObjectStore(칸);
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return 열린것;
}

async function 한번<T>(mode: IDBTransactionMode, 일: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await 열기();
  return new Promise((res, rej) => {
    const t = db.transaction(칸, mode);
    const req = 일(t.objectStore(칸));
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
