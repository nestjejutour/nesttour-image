import type { DB } from "./db";
import { getThumb, getFile, 모든그림키, 모든원본키, 통째로바꾸기 } from "./thumbs";

/**
 * 통째로 백업하기 — 원본 파일까지
 *
 * 먼저 있던 백업(backup.ts)은 JSON 하나였다. 거기에는 제안서와 미리보기만 담기고
 * 대표님이 올리신 원본 파일(.ai · PPTX · PDF · 사진)이 빠졌다.
 * 덩치가 커서 JSON 한 줄에 넣을 수 없었기 때문이다.
 *
 * 그래서 묶음(zip)으로 바꾼다. 안은 이렇게 생겼다.
 *
 *   manifest.json    무엇이 몇 개 들었는가, 파일마다 해시는 얼마인가
 *   database.json    제안서·분류·대화·규칙… (localStorage 에 있던 것 전부)
 *   files/           원본 파일
 *   thumbnails/      미리보기 그림
 *
 * 해시를 적어 두는 까닭: 복원할 때 파일이 중간에 상하지 않았는지 대조하기 위함이다.
 * 백업은 "받아 뒀다"가 아니라 "되살릴 수 있다"가 되어야 한다.
 */

/** 묶음 백업의 판. 나중에 서버로 옮길 때 이 숫자를 보고 읽는 법을 고른다 */
export const 백업판 = 2;

export interface 원본적음 {
  id: string;
  /** 대표님이 보시는 이름 */
  이름: string;
  /** 묶음 안에서의 자리 */
  담은이름: string;
  크기: number;
  해시: string;
}

export interface 그림적음 {
  id: string;
  담은이름: string;
  /** data URL 을 되살릴 때 쓸 종류 (image/jpeg 등) */
  mime: string;
  해시: string;
}

export interface 빠짐 {
  id: string;
  이름: string;
  까닭: string;
}

export interface 목록 {
  판: number;
  만든때: string;
  앱: string;
  건수: {
    제안서: number;
    페이지: number;
    분류: number;
    자료: number;
    원본파일: number;
    미리보기: number;
    대화: number;
    규칙: number;
    페이지모양: number;
    스타일: number;
    사람: number;
    기록: number;
  };
  원본: 원본적음[];
  미리보기: 그림적음[];
  /** 담지 못한 것. 하나라도 있으면 "전체 백업 완료" 라고 하지 않는다 */
  빠진것: 빠짐[];
  설정: { 패널?: string };
}

export interface 되는중 {
  단계: string;
  끝난: number;
  전부: number;
  지금?: string;
}
type 알림 = (s: 되는중) => void;

const 패널칸 = "mtmb-panels-v1";

/* ── 자잘한 연장 ── */

/** 파일 이름에 섞인 길 구분자·제어문자를 걷어 낸다 (묶음 안에서 폴더가 되어 버리면 안 된다) */
const 이름씻기 = (s: string) =>
  (s || "이름없음").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 120);

/** SHA-256 을 16진수 글자로 */
async function 해시내기(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** data URL → 알맹이와 종류 */
function 그림풀기(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  const mime = m[1] || "application/octet-stream";
  const 몸 = m[3] ?? "";
  if (m[2]) {
    const s = atob(몸);
    const u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return { bytes: u, mime };
  }
  return { bytes: new TextEncoder().encode(decodeURIComponent(몸)), mime };
}

/** 알맹이 → data URL */
function 그림싸기(bytes: Uint8Array, mime: string): string {
  let s = "";
  // 한 번에 넘기면 긴 것에서 터진다. 토막 내어 잇는다.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${mime};base64,${btoa(s)}`;
}

const 확장 = (mime: string) =>
  mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : mime.includes("svg") ? "svg" : "jpg";

/* ── 담기 ── */

/**
 * 묶음을 만든다.
 *
 * 읽기만 한다 — 도중에 창을 닫아도 지금 자료는 멀쩡하다.
 */
export async function 전체백업만들기(
  db: DB,
  알려: 알림 = () => {},
): Promise<{ 이름: string; 크기: number; 목록: 목록; blob: Blob }> {
  const 짐: Record<string, Uint8Array> = {};
  const 빠진것: 빠짐[] = [];
  const 이름찾기 = new Map(db.library.map((x) => [x.id, x]));

  /* 원본 파일 — 목록이 아니라 칸을 직접 훑는다 */
  알려({ 단계: "원본 파일을 세는 중", 끝난: 0, 전부: 0 });
  const 원본키 = (await 모든원본키()).filter((k): k is string => typeof k === "string");
  const 원본: 원본적음[] = [];
  for (let i = 0; i < 원본키.length; i++) {
    const id = 원본키[i];
    const 적힌이름 = 이름찾기.get(id)?.fileName ?? `${id}.bin`;
    알려({ 단계: "원본 파일을 담는 중", 끝난: i, 전부: 원본키.length, 지금: 적힌이름 });
    try {
      const b = await getFile(id);
      if (!b) { 빠진것.push({ id, 이름: 적힌이름, 까닭: "칸에서 읽었더니 비어 있습니다" }); continue; }
      const buf = await b.arrayBuffer();
      const 담은이름 = `files/${id}__${이름씻기(적힌이름)}`;
      짐[담은이름] = new Uint8Array(buf);
      원본.push({ id, 이름: 적힌이름, 담은이름, 크기: buf.byteLength, 해시: await 해시내기(buf) });
    } catch (e: any) {
      빠진것.push({ id, 이름: 적힌이름, 까닭: e?.message ?? "읽지 못했습니다" });
    }
    // 화면이 멎지 않게 숨을 돌린다
    if (i % 5 === 4) await new Promise((r) => setTimeout(r, 0));
  }

  /*
    목록에는 "원본 있음" 이라 적혀 있는데 칸에서 사라진 것.

    칸만 훑으면 이런 것은 아예 보이지 않는다 — 조용히 적게 담기고 끝난다.
    백업이 제일 위험할 때가 그때다. 그래서 목록과 칸을 맞대어 본다.
  */
  const 담긴것 = new Set(원본.map((x) => x.id));
  for (const x of db.library) {
    if (x.hasFile && !담긴것.has(x.id)) {
      빠진것.push({ id: x.id, 이름: x.fileName || x.name, 까닭: "자료함에는 있다고 적혔는데 원본이 사라졌습니다" });
    }
  }

  /* 미리보기 그림 */
  const 그림키 = (await 모든그림키()).filter((k): k is string => typeof k === "string");
  const 미리보기: 그림적음[] = [];
  for (let i = 0; i < 그림키.length; i++) {
    const id = 그림키[i];
    알려({ 단계: "미리보기를 담는 중", 끝난: i, 전부: 그림키.length });
    try {
      const t = await getThumb(id);
      if (!t) { 빠진것.push({ id, 이름: 이름찾기.get(id)?.name ?? id, 까닭: "미리보기가 비어 있습니다" }); continue; }
      const 푼것 = 그림풀기(t);
      if (!푼것) { 빠진것.push({ id, 이름: id, 까닭: "미리보기 모양이 이상합니다" }); continue; }
      const 담은이름 = `thumbnails/${id}.${확장(푼것.mime)}`;
      짐[담은이름] = 푼것.bytes;
      미리보기.push({
        id, 담은이름, mime: 푼것.mime,
        해시: await 해시내기(푼것.bytes.slice().buffer),
      });
    } catch (e: any) {
      빠진것.push({ id, 이름: id, 까닭: e?.message ?? "읽지 못했습니다" });
    }
    if (i % 10 === 9) await new Promise((r) => setTimeout(r, 0));
  }

  /* 제안서·분류·대화… 와 설정 */
  알려({ 단계: "제안서와 설정을 담는 중", 끝난: 0, 전부: 1 });
  let 패널: string | undefined;
  try { 패널 = localStorage.getItem(패널칸) ?? undefined; } catch { /* 막혀 있으면 설정만 뺀다 */ }

  const 목록: 목록 = {
    판: 백업판,
    만든때: new Date().toISOString(),
    앱: "MTMB AI 디자인 스튜디오",
    건수: {
      제안서: db.projects.length,
      페이지: db.projects.reduce((n, p) => n + p.slides.length, 0),
      분류: db.categories.length,
      자료: db.library.length,
      원본파일: 원본.length,
      미리보기: 미리보기.length,
      대화: Object.keys(db.chats ?? {}).length,
      규칙: db.rules.length,
      페이지모양: db.pageTypes.length,
      스타일: db.styles.length,
      사람: db.people.length,
      기록: (db.history?.length ?? 0) + (db.trail?.length ?? 0),
    },
    원본, 미리보기, 빠진것,
    설정: { 패널 },
  };

  const 글로 = (o: unknown) => new TextEncoder().encode(JSON.stringify(o));
  짐["manifest.json"] = 글로(목록);
  짐["database.json"] = 글로({ 판: 백업판, db });

  /* 묶기 — 이미 눌린 파일이 많아 원본은 그냥 담고(level 0), 글만 누른다 */
  알려({ 단계: "묶는 중", 끝난: 0, 전부: 1 });
  const { zip } = await import("fflate");
  const 눌림: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
  for (const [k, v] of Object.entries(짐)) {
    눌림[k] = [v, { level: k.endsWith(".json") ? 6 : 0 }];
  }
  const 덩이 = await new Promise<Uint8Array>((res, rej) =>
    zip(눌림 as any, (e, d) => (e ? rej(e) : res(d))),
  );

  const d = new Date();
  const 두 = (n: number) => String(n).padStart(2, "0");
  const 이름 = `MTMB-디자인스튜디오-전체백업-${d.getFullYear()}${두(d.getMonth() + 1)}${두(d.getDate())}.zip`;
  const blob = new Blob([덩이.slice().buffer], { type: "application/zip" });
  return { 이름, 크기: blob.size, 목록, blob };
}

/** 묶음을 만들어 바로 내려받는다 */
export async function 전체백업받기(db: DB, 알려: 알림 = () => {}) {
  const r = await 전체백업만들기(db, 알려);
  const url = URL.createObjectURL(r.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = r.이름;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
  return r;
}

/* ── 되살리기 ── */

export interface 복원결과 {
  db: DB;
  목록: 목록;
  맞춰본것: { 원본: number; 미리보기: number; 해시어긋남: string[]; 빠진파일: string[] };
}

/**
 * 묶음을 읽어 되살린다.
 *
 * 쓰기는 맨 마지막에 한 번에 한다. 그 전까지는 읽고 대조만 한다 —
 * 파일이 상했거나 빠졌으면 지금 자료에 손대기 전에 멈춰야 하기 때문이다.
 */
export async function 전체복원하기(file: File, 알려: 알림 = () => {}): Promise<복원결과> {
  알려({ 단계: "묶음을 여는 중", 끝난: 0, 전부: 1 });

  /*
    예전 백업(JSON)을 여기 넣는 일이 잦을 것이다 — 전에 받아 둔 것이 그것뿐이니까.
    그런데 JSON 은 묶음을 푸는 데서 먼저 터지므로, 여기서 먼저 가려내지 않으면
    "묶음이 아니거나 상했습니다" 라는 막다른 말만 듣고 끝난다. 갈 길을 알려 준다.
  */
  if (/\.json$/i.test(file.name)) {
    throw new Error("예전 방식(JSON) 백업입니다 — 아래 「예전 백업(JSON) 복원」 으로 들여오십시오.");
  }

  let 푼것: Record<string, Uint8Array>;
  try {
    const { unzip } = await import("fflate");
    const buf = new Uint8Array(await file.arrayBuffer());
    푼것 = await new Promise((res, rej) => unzip(buf, (e, d) => (e ? rej(e) : res(d))));
  } catch {
    throw new Error("묶음(zip) 파일이 아니거나 상했습니다. 지금 자료는 그대로 두었습니다 — 다른 파일을 골라 주십시오.");
  }

  if (!푼것["manifest.json"] || !푼것["database.json"]) {
    throw new Error("이 앱에서 만든 전체 백업이 아닙니다. 지금 자료는 그대로 두었습니다.");
  }

  const 읽기 = (k: string) => JSON.parse(new TextDecoder().decode(푼것[k]));
  let 목록: 목록, 속: { db: DB };
  try { 목록 = 읽기("manifest.json"); 속 = 읽기("database.json"); }
  catch { throw new Error("백업 파일 속 목록이 상했습니다. 다른 백업으로 해 주십시오."); }

  if (!목록?.판 || 목록.판 > 백업판) {
    throw new Error(`이 백업은 더 새 판(${목록?.판 ?? "?"})입니다. 앱을 최신으로 올린 뒤 복원해 주십시오.`);
  }
  if (!속?.db?.projects || !Array.isArray(속.db.projects)) {
    throw new Error("백업 속 제안서 자료가 상했습니다.");
  }

  /* 파일을 모두 읽고 해시를 대조한다 — 여기서 걸리면 지금 자료는 그대로 둔다 */
  const 해시어긋남: string[] = [];
  const 빠진파일: string[] = [];
  const 그림들 = new Map<string, string>();
  const 원본들 = new Map<string, Blob>();

  const 원본목록 = 목록.원본 ?? [];
  for (let i = 0; i < 원본목록.length; i++) {
    const x = 원본목록[i];
    알려({ 단계: "원본 파일을 맞춰 보는 중", 끝난: i, 전부: 원본목록.length, 지금: x.이름 });
    const bytes = 푼것[x.담은이름];
    if (!bytes) { 빠진파일.push(x.이름); continue; }
    const 해시 = await 해시내기(bytes.slice().buffer);
    if (해시 !== x.해시) { 해시어긋남.push(x.이름); continue; }
    원본들.set(x.id, new Blob([bytes.slice().buffer]));
    if (i % 5 === 4) await new Promise((r) => setTimeout(r, 0));
  }

  const 그림목록 = 목록.미리보기 ?? [];
  for (let i = 0; i < 그림목록.length; i++) {
    const x = 그림목록[i];
    알려({ 단계: "미리보기를 맞춰 보는 중", 끝난: i, 전부: 그림목록.length });
    const bytes = 푼것[x.담은이름];
    if (!bytes) { 빠진파일.push(x.담은이름); continue; }
    const 해시 = await 해시내기(bytes.slice().buffer);
    if (해시 !== x.해시) { 해시어긋남.push(x.담은이름); continue; }
    그림들.set(x.id, 그림싸기(bytes, x.mime));
    if (i % 10 === 9) await new Promise((r) => setTimeout(r, 0));
  }

  if (해시어긋남.length || 빠진파일.length) {
    throw new Error(
      `백업 파일이 온전하지 않습니다 — ` +
      `${빠진파일.length ? `빠진 파일 ${빠진파일.length}개` : ""}` +
      `${빠진파일.length && 해시어긋남.length ? ", " : ""}` +
      `${해시어긋남.length ? `상한 파일 ${해시어긋남.length}개` : ""}. ` +
      `지금 자료는 그대로 두었습니다. 다른 백업으로 해 주십시오.`,
    );
  }

  /* 여기부터 쓴다. 두 칸을 한 거래에 묶어 통째로 갈아 끼운다 */
  알려({ 단계: "되살리는 중", 끝난: 0, 전부: 1 });
  await 통째로바꾸기(그림들, 원본들);

  // 설정은 있으면 얹는다. 없거나 막혀도 복원을 깨지 않는다.
  try { if (목록.설정?.패널) localStorage.setItem(패널칸, 목록.설정.패널); } catch { /* 설정만 못 얹는다 */ }

  return {
    db: 속.db,
    목록,
    맞춰본것: { 원본: 원본들.size, 미리보기: 그림들.size, 해시어긋남, 빠진파일 },
  };
}
