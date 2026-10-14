import type { CSSProperties } from "react";
import type { DrawOp, StylePreset } from "../core/types";

/**
 * 손 ① — 화면 미리보기
 *
 * 그리기 명령을 그대로 HTML 로 옮긴다. 1인치 = 96px.
 * 글자 크기도 pt → px 로 똑같은 비율(96/72)로 바꾼다.
 * 그래서 PPT 와 같은 자리에 같은 크기로 보인다.
 */

const PX_PER_IN = 96;
const PT_TO_PX = 96 / 72;

export interface SlideViewProps {
  ops: DrawOp[];
  style: StylePreset;
  /** 1 = 실제 크기(10인치=960px). 0.5 = 절반 */
  zoom?: number;
  className?: string;
}

export function SlideView({ ops, style, zoom = 1, className }: SlideViewProps) {
  const s = PX_PER_IN * zoom;
  const fontStack = [style.font.family, ...style.font.fallback].join(", ");

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: style.slide.widthIn * s,
        height: style.slide.heightIn * s,
        background: style.color.background,
        fontFamily: fontStack,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {ops.map((op, i) => {
        const box: CSSProperties = {
          position: "absolute",
          left: op.x * s,
          top: op.y * s,
          width: op.w * s,
          height: op.h * s,
        };

        if (op.kind === "rect") {
          return (
            <div
              key={i}
              style={{
                ...box,
                background: op.fillHex ?? "transparent",
                opacity: op.fillAlpha ?? 1,
                border: op.strokeHex
                  ? `${Math.max(1, (op.strokeWeightPt ?? 0.75) * PT_TO_PX * zoom)}px solid ${op.strokeHex}`
                  : undefined,
                boxSizing: "border-box",
              }}
            />
          );
        }

        if (op.kind === "image") {
          return (
            <img
              key={i}
              src={op.src}
              alt=""
              style={{ ...box, objectFit: op.fit, display: "block" }}
            />
          );
        }

        return (
          <div
            key={i}
            style={{
              ...box,
              display: "flex",
              alignItems:
                op.valign === "middle" ? "center" : op.valign === "bottom" ? "flex-end" : "flex-start",
              justifyContent:
                op.align === "center" ? "center" : op.align === "right" ? "flex-end" : "flex-start",
              color: op.colorHex,
              fontSize: op.sizePt * PT_TO_PX * zoom,
              fontWeight: op.bold ? 700 : 400,
              lineHeight: op.lineSpacingMul ?? 1.3,
              letterSpacing: op.charSpacing ? op.charSpacing * PT_TO_PX * zoom : undefined,
              textAlign: op.align,
              whiteSpace: "pre-wrap",
              wordBreak: "keep-all",
              overflowWrap: "break-word",
            }}
          >
            <span style={{ width: "100%", textAlign: op.align }}>{op.text}</span>
          </div>
        );
      })}
    </div>
  );
}
