/**
 * 건별 파일함
 *
 * 제안서 한 건마다 폴더가 하나 있다고 생각하면 된다.
 *   · 원본      — 받은 제안요청서, 내보낸 PPT/PDF 처럼 그대로 남겨 둘 파일
 *   · 제작 자료 — 만들 때 참고한 자료
 *
 * 파일을 넣을 때 글을 뽑아 함께 보관한다. 그래서 다음에 AI 와 일할 때
 * 그 자료를 다시 올리지 않아도 된다.
 */

import { kindOf, readFile } from "./intake";
import type { Doc, Folder } from "./types";

export const FOLDERS: Folder[] = ["원본", "제작 자료"];

/** 내 PC 저장(브라우저)만 쓸 때 담아 둘 수 있는 파일 한 개 크기 */
const PC_LIMIT = 1_000_000;        // 1MB
/** 회사 서버(Firebase)에 연결했을 때 */
const SERVER_LIMIT = 25_000_000;   // 25MB

export const prettySize = (n: number) =>
  n < 1024 ? `${n}B`
  : n < 1024 * 1024 ? `${Math.round(n / 1024)}KB`
  : `${(n / 1048576).toFixed(1)}MB`;

/**
 * 파일 하나를 파일함에 넣을 모양으로 바꾼다.
 *
 * 너무 큰 파일은 본체를 못 들고 있는다(브라우저 저장칸이 터진다).
 * 그래도 이름·크기·뽑아낸 글은 남겨 둔다. 기록은 남는 게 낫다.
 */
export async function takeIn(
  file: File,
  folder: Folder,
  id: string,
  toServer: boolean,
): Promise<Doc> {
  const limit = toServer ? SERVER_LIMIT : PC_LIMIT;
  const base: Doc = {
    id, name: file.name, size: file.size, mime: file.type || "",
    folder, addedAt: new Date().toISOString(),
  };

  // 글은 먼저 뽑아 둔다. 파일이 커서 본체를 못 담아도 글은 남는다.
  let text: string | undefined;
  try {
    const read = await readFile(file, id);
    text = read.text;
    // 사진은 줄여서 담으므로 크기 제한에 걸리지 않는다
    if (read.dataUrl) return { ...base, url: read.dataUrl, text };
  } catch { /* 글을 못 뽑아도 파일은 담는다 */ }

  if (file.size > limit) {
    return {
      ...base, text,
      note: toServer
        ? `${prettySize(limit)} 보다 큰 파일은 보관하지 않습니다`
        : `내 PC 저장으로는 ${prettySize(limit)} 까지만 보관됩니다. 회사 서버에 연결하면 그대로 보관됩니다`,
    };
  }

  try {
    return { ...base, url: await asDataUrl(file), text };
  } catch {
    return { ...base, text, note: "파일을 읽지 못했습니다" };
  }
}

/** 파일함에서 꺼내 내려받기 */
export async function saveOut(doc: Doc): Promise<{ ok: boolean; error?: string }> {
  if (!doc.url) return { ok: false, error: "보관된 파일 본체가 없습니다" };
  try {
    const blob = doc.url.startsWith("data:")
      ? await (await fetch(doc.url)).blob()
      : await (await fetch(doc.url)).blob();

    // 아티팩트 안에서는 내려받기 권한을 거쳐야 한다
    const w = window as any;
    if (w.claude?.use) {
      const dl = await w.claude.use("downloads").catch(() => null);
      if (dl) {
        await dl.save({ filename: doc.name, data: blob });
        return { ok: true };
      }
    }

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = doc.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "내려받지 못했습니다" };
  }
}

/** 파일함에 쌓인 글을 AI 에게 넘길 한 덩어리로 */
export function docsToText(docs: Doc[] | undefined): string {
  if (!docs?.length) return "";
  return docs
    .filter((d) => d.text?.trim())
    .map((d) => `──── [${d.folder}] ${d.name} ────\n${d.text!.slice(0, 12000)}`)
    .join("\n\n");
}

export const docKind = (d: Doc) => kindOf({ name: d.name, type: d.mime } as File);

function asDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
