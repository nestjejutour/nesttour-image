import { jsPDF } from "jspdf";
import type { DrawOp, StylePreset } from "../core/types";
import { renderToBlob } from "./canvas";
import { capability } from "../platform";
import { printSize } from "../core/paper";

/**
 * PDF 내보내기
 *
 * 미리보기·PPT 와 똑같은 그리기 명령을 그림으로 떠서 장마다 붙인다.
 * 그래서 화면에서 본 것과 한 치도 다르지 않다.
 * 글꼴을 PDF 에 심지 않아도 되므로 한글이 깨질 일도 없다.
 */

type Downloads = { save(r: { filename: string; data: Blob }): Promise<{ status: string }> };

export async function downloadPdf(
  plans: { ops: DrawOp[] }[],
  style: StylePreset,
  fileName: string,
  onProgress?: (done: number, total: number) => void,
  /** 인쇄 규격 id. 없거나 "screen" 이면 지금 판 크기 그대로 */
  paperId?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!plans.length) return { ok: false, error: "페이지가 없습니다." };

  // 그림 한 장의 크기 (= 지금 판 크기)
  const sw = style.slide.widthIn;
  const sh = style.slide.heightIn;

  // 종이 크기. "화면 그대로" 면 판 크기를 그대로 종이로 쓴다.
  const paper = printSize(paperId);
  const w = paper.widthIn || sw;
  const h = paper.heightIn || sh;
  const dir = w >= h ? "landscape" : "portrait";

  // 판을 종이 안에 가장 크게, 가운데 앉힌다
  const k = Math.min(w / sw, h / sh);
  const iw = sw * k;
  const ih = sh * k;
  const ix = (w - iw) / 2;
  const iy = (h - ih) / 2;

  const doc = new jsPDF({ orientation: dir, unit: "in", format: [w, h] });

  for (let i = 0; i < plans.length; i++) {
    const blob = await renderToBlob(plans[i].ops, style, { type: "image/jpeg", quality: 0.92 });
    if (!blob) continue;
    const dataUrl = await toDataUrl(blob);
    if (i > 0) doc.addPage([w, h], dir);
    doc.addImage(dataUrl, "JPEG", ix, iy, iw, ih);
    onProgress?.(i + 1, plans.length);
  }

  const out = doc.output("blob");
  const name = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;

  // 옆 패널에서는 내려받기 기능을 거쳐야 한다
  const downloads = await capability<Downloads>("downloads", 1500);
  if (downloads) {
    try {
      await downloads.save({ filename: name, data: out });
      return { ok: true };
    } catch (e: any) {
      if (e?.code === "declined") return { ok: false, error: "내려받기를 취소하셨습니다." };
      return { ok: false, error: e?.message ?? "PDF 를 내려받지 못했습니다." };
    }
  }

  // 내 PC 에서는 바로 저장
  const url = URL.createObjectURL(out);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { ok: true };
}

function toDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(b);
  });
}
