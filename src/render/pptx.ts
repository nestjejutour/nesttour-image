import PptxGenJS from "pptxgenjs";
import type { DrawOp, StylePreset } from "../core/types";
import { capability } from "../platform";

/**
 * 손 ② — PPT 파일
 *
 * 화면 미리보기와 똑같은 그리기 명령을 받아서 pptxgenjs 로 그린다.
 * 좌표·크기·색을 다시 계산하지 않는다. 그대로 옮기기만 한다.
 */

/** pptxgenjs 는 색에 # 을 안 붙인다 */
const hex = (v: string) => v.replace("#", "").toUpperCase();

/** 우리 쪽 alpha(보이는 정도 0~1) → pptx transparency(투명한 정도 0~100) */
const toTransparency = (alpha?: number) =>
  alpha === undefined ? 0 : Math.round((1 - alpha) * 100);

export interface SlidePlan {
  ops: DrawOp[];
}

export function buildDeck(slides: SlidePlan[], style: StylePreset): PptxGenJS {
  const pptx = new PptxGenJS();

  pptx.defineLayout({
    name: "MTMB",
    width: style.slide.widthIn,
    height: style.slide.heightIn,
  });
  pptx.layout = "MTMB";
  pptx.theme = { headFontFace: style.font.family, bodyFontFace: style.font.family };

  const fontFace = style.font.family;

  for (const plan of slides) {
    const slide = pptx.addSlide();
    slide.background = { color: hex(style.color.background) };

    for (const op of plan.ops) {
      if (op.kind === "rect") {
        slide.addShape("rect", {
          x: op.x,
          y: op.y,
          w: op.w,
          h: op.h,
          fill: op.fillHex
            ? { color: hex(op.fillHex), transparency: toTransparency(op.fillAlpha) }
            : { color: "FFFFFF", transparency: 100 },
          line: op.strokeHex
            ? { color: hex(op.strokeHex), width: op.strokeWeightPt ?? style.hairline }
            : { type: "none" },
        });
        continue;
      }

      if (op.kind === "image") {
        const data = op.src.startsWith("data:") ? op.src.slice(5) : undefined;
        slide.addImage({
          ...(data ? { data } : { path: op.src }),
          x: op.x,
          y: op.y,
          w: op.w,
          h: op.h,
          sizing: { type: op.fit, w: op.w, h: op.h },
        });
        continue;
      }

      // 줄바꿈은 pptxgenjs 가 문자열 안의 \n 을 다루지 않으므로 직접 쪼갠다.
      const lines = op.text.split("\n");
      const runs = lines.map((line, i) => ({
        text: line,
        options: i < lines.length - 1 ? { breakLine: true } : {},
      }));

      slide.addText(runs, {
        x: op.x,
        y: op.y,
        w: op.w,
        h: op.h,
        fontFace,
        fontSize: op.sizePt,
        bold: op.bold,
        color: hex(op.colorHex),
        align: op.align,
        valign: op.valign,
        margin: 0,
        lineSpacingMultiple: op.lineSpacingMul,
        charSpacing: op.charSpacing,
        wrap: true,
      });
    }
  }

  return pptx;
}

type Downloads = { save(r: { filename: string; data: Blob }): Promise<{ status: string }> };

/** PPT 파일을 만들어 내려준다. 어디서 도는지에 따라 방법이 다르다. */
export async function downloadPptx(
  slides: SlidePlan[],
  style: StylePreset,
  fileName: string,
): Promise<{ ok: boolean; error?: string }> {
  const name = fileName.endsWith(".pptx") ? fileName : `${fileName}.pptx`;
  const pptx = buildDeck(slides, style);

  const downloads = await capability<Downloads>("downloads", 1500);
  if (downloads) {
    const blob = (await pptx.write({ outputType: "blob" })) as Blob;
    try {
      await downloads.save({ filename: name, data: blob });
      return { ok: true };
    } catch (e: any) {
      if (e?.code === "declined") return { ok: false, error: "내려받기를 취소하셨습니다." };
      return { ok: false, error: e?.message ?? "파일을 내려받지 못했습니다." };
    }
  }

  await pptx.writeFile({ fileName: name });
  return { ok: true };
}
