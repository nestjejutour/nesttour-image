import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { DrawOp, StylePreset } from "../core/types";

/**
 * 손 ① — 화면 미리보기
 *
 * 그리기 명령을 그대로 HTML 로 옮긴다. 1인치 = 96px.
 * 글자 크기도 pt → px 로 똑같은 비율(96/72)로 바꾼다.
 * 그래서 PPT 와 같은 자리에 같은 크기로 보인다.
 *
 * edit 을 주면 화면에서 바로 고칠 수 있다.
 *   · 한 번 누르면 집기, 끌면 옮기기
 *   · 글자는 두 번 누르면 그 자리에서 고치기
 *   · 집은 것의 오른쪽 아래 모서리를 끌면 크기 조정
 */

const PX_PER_IN = 96;
const PT_TO_PX = 96 / 72;

export interface SlideEdit {
  /** 지금 집어 둔 것 */
  picked: string | null;
  onPick: (at: string | null) => void;
  /** 끌어서 옮김 (인치) */
  onMove: (at: string, dx: number, dy: number) => void;
  /** 모서리를 끌어 크기 바꿈 (인치) */
  onResize: (at: string, dw: number, dh: number) => void;
  /** 화면에서 글자를 고침 */
  onText: (bindPath: string, text: string) => void;
}

export interface SlideViewProps {
  ops: DrawOp[];
  style: StylePreset;
  /** 1 = 실제 크기(10인치=960px). 0.5 = 절반 */
  zoom?: number;
  className?: string;
  edit?: SlideEdit;
}

export function SlideView({ ops, style, zoom = 1, className, edit }: SlideViewProps) {
  const s = PX_PER_IN * zoom;
  const fontStack = [style.font.family, ...style.font.fallback].join(", ");
  const [editingAt, setEditingAt] = useState<string | null>(null);

  useEffect(() => { setEditingAt(null); }, [edit?.picked]);

  /** 끌기 시작 */
  const startDrag = (op: DrawOp, mode: "move" | "resize") => (e: React.PointerEvent) => {
    if (!edit || !op.at || editingAt === op.at) return;
    e.preventDefault();
    e.stopPropagation();
    edit.onPick(op.at);

    let lastX = e.clientX;
    let lastY = e.clientY;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - lastX) / s;
      const dy = (ev.clientY - lastY) / s;
      lastX = ev.clientX;
      lastY = ev.clientY;
      if (mode === "move") edit.onMove(op.at!, dx, dy);
      else edit.onResize(op.at!, dx, dy);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    document.body.style.userSelect = "none";
  };

  return (
    <div
      className={className}
      onPointerDown={() => edit?.onPick(null)}
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
        const on = !!edit && !!op.at && edit.picked === op.at;
        const box: CSSProperties = {
          position: "absolute",
          left: op.x * s,
          top: op.y * s,
          width: op.w * s,
          height: op.h * s,
        };
        const grab: CSSProperties = edit && op.at
          ? { cursor: "move", outline: on ? "1.5px solid var(--accent)" : undefined,
              outlineOffset: 1 }
          : {};
        const handlers = edit && op.at ? { onPointerDown: startDrag(op, "move") } : {};

        const corner = on && edit && (
          <span
            onPointerDown={startDrag(op, "resize")}
            style={{
              position: "absolute", right: -5, bottom: -5, width: 11, height: 11,
              background: "var(--accent)", borderRadius: 2, cursor: "nwse-resize",
            }}
          />
        );

        if (op.kind === "rect") {
          return (
            <div key={i} {...handlers}
              style={{
                ...box, ...grab,
                background: op.fillHex ?? "transparent",
                opacity: op.fillAlpha ?? 1,
                border: op.strokeHex
                  ? `${Math.max(1, (op.strokeWeightPt ?? 0.75) * PT_TO_PX * zoom)}px solid ${op.strokeHex}`
                  : undefined,
                boxSizing: "border-box",
              }}
            >{corner}</div>
          );
        }

        if (op.kind === "image") {
          return (
            <div key={i} {...handlers} style={{ ...box, ...grab }}>
              <img src={op.src} alt=""
                style={{ width: "100%", height: "100%", objectFit: op.fit, display: "block",
                         pointerEvents: "none" }} />
              {corner}
            </div>
          );
        }

        const editing = editingAt === op.at;
        return (
          <div
            key={i}
            {...(editing ? {} : handlers)}
            onDoubleClick={(e) => {
              if (!edit || !op.bindPath || !op.at) return;
              e.stopPropagation();
              edit.onPick(op.at);
              setEditingAt(op.at);
            }}
            style={{
              ...box, ...grab,
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
              cursor: edit && op.bindPath ? "text" : grab.cursor,
            }}
          >
            {editing ? (
              <InlineEdit
                text={op.isTodo ? "" : op.text}
                align={op.align}
                onDone={(v) => { setEditingAt(null); if (op.bindPath) edit!.onText(op.bindPath, v); }}
              />
            ) : (
              <span style={{ width: "100%", textAlign: op.align, pointerEvents: "none" }}>{op.text}</span>
            )}
            {!editing && corner}
          </div>
        );
      })}
    </div>
  );
}

/** 그 자리에서 글자 고치기 */
function InlineEdit({
  text, align, onDone,
}: {
  text: string;
  align: "left" | "center" | "right";
  onDone: (v: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.textContent = text;
    el.focus();
    const r = document.createRange();
    r.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
  }, []);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={(e) => onDone(e.currentTarget.textContent ?? "")}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") { e.preventDefault(); onDone(text); }
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.target as HTMLElement).blur(); }
      }}
      style={{
        width: "100%", textAlign: align, outline: "2px solid var(--accent)",
        outlineOffset: 2, background: "rgba(255,255,255,0.75)", minHeight: "1em",
        font: "inherit", color: "inherit", lineHeight: "inherit", whiteSpace: "pre-wrap",
      }}
    />
  );
}
