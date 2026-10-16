import type { DB } from "./db";
import { getThumb, putThumb } from "./thumbs";

/**
 * 통째로 내려받아 보관하기
 *
 * 지금 자료는 "이 브라우저 안"에만 있다.
 * 컴퓨터를 바꾸거나, 브라우저 기록을 지우거나, 다른 사람 PC 에서 열면 없다.
 * 그래서 파일 하나로 통째로 내려받아 회사 자료함에 두는 길을 둔다.
 *
 * 미리보기 그림은 따로(IndexedDB) 있으므로 여기서 같이 꺼내 담는다.
 */

const 판 = 1;

export interface 보따리 {
  판: number;
  만든때: string;
  db: DB;
  /** 자료 id → 미리보기 그림 */
  thumbs: Record<string, string>;
}

export async function 보따리만들기(db: DB): Promise<보따리> {
  const thumbs: Record<string, string> = {};
  for (const x of db.library) {
    if (x.noThumb) continue;
    const t = await getThumb(x.id);
    if (t) thumbs[x.id] = t;
  }
  return { 판, 만든때: new Date().toISOString(), db, thumbs };
}

/** 파일로 내려받는다 */
export async function 내려받기(db: DB): Promise<{ 이름: string; 크기: number }> {
  const 짐 = await 보따리만들기(db);
  const 글 = JSON.stringify(짐);
  const blob = new Blob([글], { type: "application/json" });
  const d = new Date();
  const 두자리 = (n: number) => String(n).padStart(2, "0");
  const 이름 = `디자인스튜디오-보관-${d.getFullYear()}${두자리(d.getMonth() + 1)}${두자리(d.getDate())}-${두자리(d.getHours())}${두자리(d.getMinutes())}.json`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = 이름;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);

  return { 이름, 크기: blob.size };
}

/** 내려받아 둔 파일을 도로 들여온다 */
export async function 들여오기(file: File): Promise<DB> {
  const 글 = await file.text();
  const 짐 = JSON.parse(글) as 보따리;
  if (!짐?.db?.projects || !Array.isArray(짐.db.projects)) {
    throw new Error("이 앱에서 내려받은 보관 파일이 아닙니다");
  }
  for (const [id, t] of Object.entries(짐.thumbs ?? {})) {
    try { await putThumb(id, t); } catch { /* 그림 하나쯤 빠져도 나머지는 들여온다 */ }
  }
  return 짐.db;
}
