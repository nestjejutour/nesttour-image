import type { DrawOp, StylePreset } from "../core/types";

/**
 * 손 ③ — 그림(PNG)
 *
 * 미리보기·PPT 와 똑같은 그리기 명령을 받아 그림으로 뜬다.
 * 이걸 AI 에게 보내면 AI 가 "화면을 보고" 판단할 수 있다.
 *
 * 레이아웃 정의가 하나뿐이라서 손이 셋이 되어도 모양이 갈라지지 않는다.
 */

const DPI = 192; // 1인치 = 192px (2배). AI 가 글자를 읽을 수 있을 정도

/**
 * 한 변이 이보다 길어지면 안 된다.
 *
 * 400×70cm 현수막은 157인치다. 192dpi 로 그리면 가로 30,240px —
 * 브라우저 캔버스 한계를 넘고, 떠낸 그림도 수십 MB 라 AI 가 받지 못한다.
 * ("the file is over 20 MB" 가 여기서 났다)
 * 큰 판은 배율을 낮춰 그린다. 글자를 읽는 데는 이 정도면 넉넉하다.
 */
const 긴변최대 = 2400;

/**
 * 인쇄용으로 뜰 때 쓸 배율(dpi).
 *
 * 화면용(192dpi)으로 400cm 현수막을 뜨면 가로 30,000점이 되어 브라우저가 죽는다.
 * 그렇다고 2,400점으로 묶으면 1점이 1.7mm 가 되어 인쇄소에서 뭉개진다.
 * 그래서 "점 개수 예산" 을 두고 그 안에서 배율을 최대로 올린다.
 *
 *  · A4 (11.7×8.3인치) → 300dpi, 3,500×2,500점. 글이 또렷하다.
 *  · 400×70cm 현수막   → 약 83dpi, 13,000×2,300점.
 *    대형 현수막은 원래 72~150dpi 로 뽑는다. 몇 미터 떨어져서 보는 물건이다.
 *    게다가 바탕이 AI 가 그린 선 그림(SVG)이라, 사진을 늘린 것과 달리
 *    이 배율에서 선이 계산되어 그려진다 — 뭉개지지 않는다.
 *
 * 예산 30,000,000점은 메모리 120MB 쯤이다. 사무실 PC 에서 버틴다.
 */
export function 인쇄배율(style: StylePreset, 예산 = 30_000_000, 최대 = 300): number {
  const 넓이 = style.slide.widthIn * style.slide.heightIn;
  if (!(넓이 > 0)) return 최대;
  const 긴변 = Math.max(style.slide.widthIn, style.slide.heightIn);
  // 한 변이 16,000점을 넘으면 브라우저가 캔버스를 못 만든다
  return Math.max(48, Math.min(최대, Math.sqrt(예산 / 넓이), 16000 / 긴변));
}

/** 사람에게 보여 줄 한 줄 — "13,000 × 2,300점 (83dpi)" */
export function 인쇄크기말(style: StylePreset): string {
  const d = 인쇄배율(style);
  const w = Math.round(style.slide.widthIn * d).toLocaleString();
  const h = Math.round(style.slide.heightIn * d).toLocaleString();
  return `${w} × ${h}점 (${Math.round(d)}dpi)`;
}

export async function renderToBlob(
  ops: DrawOp[],
  style: StylePreset,
  as: { type?: string; quality?: number; dpi?: number } = {},
): Promise<Blob | null> {
  // 판이 크면 배율을 낮춘다. 그래야 캔버스가 버티고 그림도 가벼워진다.
  const 긴변인치 = Math.max(style.slide.widthIn, style.slide.heightIn);
  const dpi = as.dpi ?? Math.min(DPI, 긴변최대 / Math.max(1, 긴변인치));
  const w = Math.max(1, Math.round(style.slide.widthIn * dpi));
  const h = Math.max(1, Math.round(style.slide.heightIn * dpi));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = style.color.background;
  ctx.fillRect(0, 0, w, h);

  const family = [style.font.family, ...style.font.fallback].map((f) => `"${f}"`).join(", ");

  // 글꼴이 다 내려오기 전에 그리면 다른 글꼴로 그려진다.
  // PDF 를 처음 저장할 때 화면과 달라지는 일이 여기서 생긴다.
  await readyFont(style.font.family);

  // 사진을 먼저 다 읽어 둔다
  const images = new Map<string, HTMLImageElement>();
  await Promise.all(
    ops.filter((o) => o.kind === "image").map(async (o) => {
      const src = (o as Extract<DrawOp, { kind: "image" }>).src;
      if (images.has(src)) return;
      const img = await loadImage(src);
      if (img) images.set(src, img);
    }),
  );

  for (const op of ops) {
    const x = op.x * dpi;
    const y = op.y * dpi;
    const bw = op.w * dpi;
    const bh = op.h * dpi;

    if (op.kind === "rect") {
      if (op.fillHex) {
        ctx.globalAlpha = op.fillAlpha ?? 1;
        ctx.fillStyle = op.fillHex;
        ctx.fillRect(x, y, bw, bh);
        ctx.globalAlpha = 1;
      }
      if (op.strokeHex) {
        ctx.strokeStyle = op.strokeHex;
        ctx.lineWidth = Math.max(1, ((op.strokeWeightPt ?? 0.75) / 72) * dpi);
        ctx.strokeRect(x, y, bw, bh);
      }
      continue;
    }

    if (op.kind === "image") {
      const img = images.get(op.src);
      if (!img) continue;
      drawFitted(ctx, img, x, y, bw, bh, op.fit);
      continue;
    }

    // 글자
    const sizePx = (op.sizePt / 72) * dpi;
    ctx.font = `${op.bold ? "700" : "400"} ${sizePx}px ${family}`;
    ctx.fillStyle = op.colorHex;
    ctx.textBaseline = "top";
    ctx.textAlign = op.align;

    const lineH = sizePx * (op.lineSpacingMul ?? 1.3);
    const lines = wrap(ctx, op.text, bw);
    const blockH = lines.length * lineH;
    const startY =
      op.valign === "middle" ? y + (bh - blockH) / 2 : op.valign === "bottom" ? y + bh - blockH : y;
    const tx = op.align === "center" ? x + bw / 2 : op.align === "right" ? x + bw : x;

    lines.forEach((line, i) => ctx.fillText(line, tx, startY + i * lineH));
  }

  return new Promise((res) =>
    canvas.toBlob((b) => res(b), as.type ?? "image/png", as.quality),
  );
}

/** 줄바꿈. 한글은 어디서나 끊기지만 가능하면 띄어쓰기에서 끊는다 */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (ctx.measureText(para).width <= maxW) {
      out.push(para);
      continue;
    }
    let line = "";
    for (const word of para.split(/(\s+)/)) {
      const next = line + word;
      if (ctx.measureText(next).width > maxW && line.trim()) {
        out.push(line.trimEnd());
        line = word.trimStart();
      } else {
        line = next;
      }
    }
    if (line.trim()) out.push(line.trimEnd());
  }
  return out.length ? out : [""];
}

function drawFitted(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, w: number, h: number,
  fit: "cover" | "contain",
) {
  const ar = img.naturalWidth / img.naturalHeight;
  const boxAr = w / h;
  let dw = w, dh = h, dx = x, dy = y;

  if (fit === "cover") {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    if (ar > boxAr) { dh = h; dw = h * ar; dx = x - (dw - w) / 2; }
    else { dw = w; dh = w / ar; dy = y - (dh - h) / 2; }
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  } else {
    if (ar > boxAr) { dw = w; dh = w / ar; dy = y + (h - dh) / 2; }
    else { dh = h; dw = h * ar; dx = x + (w - dw) / 2; }
    ctx.drawImage(img, dx, dy, dw, dh);
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

/**
 * 글꼴이 쓸 준비가 될 때까지 기다린다.
 * 못 기다리는 환경이면 그냥 넘어간다 — 기다리다 멈추는 것보다 낫다.
 */
async function readyFont(family: string): Promise<void> {
  const fonts = (document as any).fonts;
  if (!fonts?.load) return;
  try {
    await Promise.race([
      Promise.all([
        fonts.load(`400 16px "${family}"`),
        fonts.load(`700 16px "${family}"`),
      ]).then(() => fonts.ready),
      new Promise((r) => setTimeout(r, 4000)),
    ]);
  } catch { /* 글꼴 없이 그린다 */ }
}
