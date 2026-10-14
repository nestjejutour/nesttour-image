/**
 * 자료 받아들이기
 *
 * 대표님이 파일을 끌어다 놓거나 골라 넣으면, 거기서 AI 가 읽을 수 있는
 * 재료를 뽑아낸다. 못 읽는 형식은 솔직히 못 읽는다고 말한다.
 */

export type IntakeKind = "글" | "그림" | "못읽음";

export interface IntakeFile {
  id: string;
  name: string;
  size: number;
  mime: string;
  kind: IntakeKind;
  /** 뽑아낸 글 (AI 에게 넘길 재료) */
  text?: string;
  /** 그림이면 보여주고 AI 에게 보낼 주소 */
  dataUrl?: string;
  /** 못 읽은 이유 */
  note?: string;
  /** 읽는 중인가 */
  busy?: boolean;
}

const TEXTY = /\.(txt|md|markdown|csv|tsv|json|html?|rtf)$/i;
const IMAGEY = /\.(png|jpe?g|webp|gif|bmp)$/i;

export function kindOf(file: File): IntakeKind {
  if (IMAGEY.test(file.name) || file.type.startsWith("image/")) return "그림";
  if (TEXTY.test(file.name) || file.type.startsWith("text/")) return "글";
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") return "글";
  return "못읽음";
}

/** 파일 하나를 읽어 AI 가 쓸 수 있는 재료로 바꾼다 */
export async function readFile(file: File, id: string): Promise<IntakeFile> {
  const base: IntakeFile = {
    id, name: file.name, size: file.size, mime: file.type,
    kind: kindOf(file),
  };

  try {
    if (base.kind === "그림") {
      return { ...base, dataUrl: await asDataUrl(file) };
    }

    if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
      const text = await pdfText(file);
      return text.trim()
        ? { ...base, text }
        : { ...base, kind: "못읽음", note: "글자가 없는 PDF 입니다 (사진을 찍어 만든 PDF 일 수 있습니다)" };
    }

    if (base.kind === "글") {
      return { ...base, text: await file.text() };
    }

    // 못 읽는 것들 — 솔직히 말한다
    if (/\.pptx?$/i.test(file.name)) {
      return { ...base, note: "PPT 는 아직 못 읽습니다. 파워포인트에서 PDF 로 저장해 올려 주세요" };
    }
    if (/\.hwpx?$/i.test(file.name)) {
      return { ...base, note: "한글 파일은 못 읽습니다. 한글에서 PDF 로 저장해 올려 주세요" };
    }
    if (/\.docx?$/i.test(file.name)) {
      return { ...base, note: "워드는 아직 못 읽습니다. PDF 로 저장해 올려 주세요" };
    }
    return { ...base, note: "읽을 수 없는 형식입니다" };
  } catch (e: any) {
    return { ...base, kind: "못읽음", note: e?.message ?? "파일을 읽지 못했습니다" };
  }
}

/** PDF 에서 글자만 뽑는다 */
async function pdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;

  const pages: string[] = [];
  const max = Math.min(doc.numPages, 60); // 너무 긴 건 앞쪽만
  for (let i = 1; i <= max; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const line = tc.items
      .map((it: any) => (typeof it.str === "string" ? it.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (line) pages.push(`[${i}쪽] ${line}`);
  }
  if (doc.numPages > max) pages.push(`… (전체 ${doc.numPages}쪽 중 앞 ${max}쪽만 읽었습니다)`);
  return pages.join("\n");
}

function asDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

/** 읽어들인 파일들을 AI 에게 넘길 한 덩어리 글로 */
export function intakeToText(files: IntakeFile[]): string {
  return files
    .filter((f) => f.text?.trim())
    .map((f) => `──── ${f.name} ────\n${f.text!.slice(0, 20000)}`)
    .join("\n\n");
}

export const prettySize = (n: number) =>
  n < 1024 ? `${n}B` : n < 1024 * 1024 ? `${Math.round(n / 1024)}KB` : `${(n / 1048576).toFixed(1)}MB`;
