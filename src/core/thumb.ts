/**
 * 파일에서 미리보기 그림 한 장을 뽑는다.
 *
 * · .ai  — 일러스트가 "PDF 호환 파일 만들기" 로 저장했으면 속이 PDF 다.
 *          그 옵션을 끄고 저장한 파일은 그림을 못 뽑는다. 이름만 남는다.
 * · .pdf — 첫 장
 * · 그림 — 그대로 줄인다
 * · 그 밖 — 못 뽑는다
 *
 * 원본은 담지 않는다. 현수막 .ai 한 장이 수십~수백 MB 라 100개면 몇 GB 다.
 * 원본은 회사 자료함에 그대로 두고, 여기에는 보고 고르기 위한 그림만 둔다.
 */

/** 긴 변을 이만큼으로 줄인다. 100장을 담아도 저장 칸이 버틴다 */
const 길이 = 360;
const 품질 = 0.68;

export type 미리보기 = {
  thumb?: string;
  /** 원본 크기 — 그림은 픽셀, PDF·일러스트는 포인트 */
  w?: number; h?: number;
  /** 실제 인쇄 치수 (mm). PDF·일러스트에서만 나온다 */
  mmW?: number; mmH?: number;
  못뽑은까닭?: string;
};

/** 포인트(1/72인치)를 밀리미터로 */
export const ptToMm = (pt: number) => (pt / 72) * 25.4;

const 그려담기 = (c: HTMLCanvasElement) => c.toDataURL("image/jpeg", c.width > 800 ? 0.86 : 품질);

/** 긴 변 기준으로 줄일 비율 */
const 비율 = (w: number, h: number, 길 = 길이) => Math.min(1, 길 / Math.max(w, h));

export async function 미리보기뽑기(file: File): Promise<미리보기> {
  const 이름 = file.name.toLowerCase();
  const 확장 = 이름.slice(이름.lastIndexOf(".") + 1);

  try {
    if (file.type.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif", "bmp"].includes(확장)) {
      return await 그림에서(file);
    }
    if (확장 === "pdf" || 확장 === "ai" || 확장 === "eps" || file.type === "application/pdf") {
      return await 피디에프에서(file);
    }
    return { 못뽑은까닭: "그림을 뽑을 수 없는 형식입니다" };
  } catch (e: any) {
    const 말 = String(e?.message ?? e);
    // 일러스트가 PDF 호환 없이 저장한 .ai 가 여기로 온다
    if (확장 === "ai") {
      return { 못뽑은까닭: "PDF 호환으로 저장된 파일이 아닙니다 (그림을 못 뽑습니다)" };
    }
    return { 못뽑은까닭: 말.slice(0, 80) };
  }
}

async function 그림에서(file: File, 길 = 길이): Promise<미리보기> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("그림을 열지 못했습니다"));
      i.src = url;
    });
    const r = 비율(img.naturalWidth, img.naturalHeight, 길);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * r));
    c.height = Math.max(1, Math.round(img.naturalHeight * r));
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return { thumb: 그려담기(c), w: img.naturalWidth, h: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function 피디에프에서(file: File, 길 = 길이): Promise<미리보기> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const page = await doc.getPage(1);

  const 원래 = page.getViewport({ scale: 1 });
  const r = 비율(원래.width, 원래.height, 길);
  const view = page.getViewport({ scale: r });

  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(view.width));
  c.height = Math.max(1, Math.round(view.height));
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: view, canvas: c } as any).promise;

  // PDF 의 한 점(pt)은 1/72인치다. 그러니 이 숫자가 곧 인쇄 치수다 —
  // 11339pt × 2551pt 는 400cm × 90cm 짜리 현수막이다.
  const out = {
    thumb: 그려담기(c),
    w: Math.round(원래.width), h: Math.round(원래.height),
    mmW: Math.round(ptToMm(원래.width)), mmH: Math.round(ptToMm(원래.height)),
  };
  try { await doc.destroy(); } catch { /* 닫다 실패해도 그림은 나왔다 */ }
  return out;
}


/**
 * 원본에서 큰 그림을 뽑는다.
 *
 * 목록에 깔 작은 그림(360px)을 크게 늘리면 뭉개져서 볼 수가 없다.
 * 원본을 품고 있으니 열어 볼 때 그 자리에서 크게 그린다.
 * 저장 칸을 더 쓰지 않는 대신 몇백 밀리초가 든다 — 한 장 볼 때는 그만한 값이 있다.
 */
export async function 큰그림(blob: Blob, 이름: string, 긴변 = 1800): Promise<string | undefined> {
  const 확장 = 이름.toLowerCase().slice(이름.lastIndexOf(".") + 1);
  const f = new File([blob], 이름, { type: blob.type });
  try {
    if (["jpg", "jpeg", "png", "webp", "gif", "bmp"].includes(확장) || blob.type.startsWith("image/")) {
      return (await 그림에서(f, 긴변)).thumb;
    }
    if (["pdf", "ai", "eps"].includes(확장)) {
      return (await 피디에프에서(f, 긴변)).thumb;
    }
  } catch { /* 못 뽑으면 작은 그림으로 버틴다 */ }
  return undefined;
}
