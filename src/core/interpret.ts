import type {
  Content,
  DrawOp,
  Element,
  PageType,
  Slot,
  StylePreset,
  Todo,
  TypeToken,
} from "./types";
import { resolveColor } from "./style";

/**
 * ============================================================
 *  해석기 — 공장에서 제일 중요한 부품
 * ============================================================
 *
 *  페이지 모양(데이터) + 내용 + 스타일  →  그리기 명령 목록
 *
 *  미리보기와 PPT 는 둘 다 이 결과물만 보고 그린다.
 *  따라서 "화면과 PPT 모양이 다르다"는 일이 구조적으로 일어날 수 없다.
 */

export const TODO_TEXT = "[ 확인 필요 ]";

export interface InterpretCtx {
  style: StylePreset;
  /** 사진 자산 보관함 (키 → data URL) */
  assets?: Record<string, string>;
  /** 페이지 번호. 0 이거나 없으면 안 찍는다 */
  pageNumber?: number;
}

/** pt 를 인치로 */
const pt = (v: number) => v / 72;

function pick(scope: Content, key: string | undefined): unknown {
  if (!key) return undefined;
  return scope[key];
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function visible(el: { showIf?: string; hideIf?: string }, scope: Content): boolean {
  if (el.showIf && isEmpty(pick(scope, el.showIf))) return false;
  if (el.hideIf && !isEmpty(pick(scope, el.hideIf))) return false;
  return true;
}

function resolveSrc(v: unknown, assets?: Record<string, string>): string | null {
  if (typeof v !== "string" || v.trim() === "") return null;
  if (v.startsWith("data:") || v.startsWith("http") || v.startsWith("/")) return v;
  return assets?.[v] ?? null;
}

/** 스타일의 글자 규격을 꺼낸다. 없는 이름이면 body 로 떨어진다. */
function token(style: StylePreset, name: string | undefined): TypeToken {
  if (!name) return style.type.body;
  return style.type[name] ?? style.type.body;
}

/**
 * 한 페이지를 그리기 명령으로 바꾼다.
 */
export function interpret(pageType: PageType, content: Content, ctx: InterpretCtx): DrawOp[] {
  const ops: DrawOp[] = [];
  walk(pageType.elements, content, 0, 0, ctx, ops);

  // 페이지 번호는 브랜드 규칙이므로 스타일이 들고 있고, 해석기가 자동으로 찍는다.
  if (pageType.showPageNo !== false && ctx.pageNumber && ctx.pageNumber > 0) {
    const p = ctx.style.pageNo;
    ops.push({
      kind: "text",
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
      text: String(ctx.pageNumber),
      sizePt: p.size,
      bold: false,
      colorHex: resolveColor(ctx.style, p.color, "muted"),
      align: "right",
      valign: "middle",
    });
  }
  return ops;
}

function walk(
  elements: Element[],
  scope: Content,
  dx: number,
  dy: number,
  ctx: InterpretCtx,
  out: DrawOp[],
): void {
  const { style } = ctx;

  for (const el of elements) {
    if (el.type !== "repeat" && !visible(el, scope)) continue;

    switch (el.type) {
      case "text": {
        const t = token(style, el.token);
        let text: string;
        let isTodo = false;

        if (el.literal !== undefined) {
          text = el.literal;
        } else {
          const raw = pick(scope, el.bind);
          if (isEmpty(raw)) {
            if (!el.required) continue; // 비어 있고 필수도 아니면 아무것도 안 그린다
            text = TODO_TEXT;
            isTodo = true;
          } else {
            text = String(raw);
          }
        }
        if (!isTodo) text = `${el.prefix ?? ""}${text}${el.suffix ?? ""}`;

        out.push({
          kind: "text",
          x: el.x + dx,
          y: el.y + dy,
          w: el.w,
          h: el.h,
          text,
          sizePt: el.size ?? t.size,
          bold: el.bold ?? t.bold ?? false,
          colorHex: isTodo
            ? resolveColor(style, "todo")
            : resolveColor(style, el.color ?? t.color, "ink"),
          align: el.align ?? "left",
          valign: el.valign ?? "top",
          lineSpacingMul: el.lineSpacingMul ?? t.lineSpacingMul,
          charSpacing: el.charSpacing ?? t.charSpacing,
          isTodo,
        });
        break;
      }

      case "line": {
        // 두께를 가진 아주 얇은 사각형으로 그린다. 그래야 PPT 와 화면이 같아진다.
        const weightIn = pt(el.weight ?? style.hairline);
        const horizontal = el.h === 0 || el.h < weightIn;
        out.push({
          kind: "rect",
          x: el.x + dx,
          y: el.y + dy,
          w: horizontal ? el.w : Math.max(el.w, weightIn),
          h: horizontal ? Math.max(el.h, weightIn) : el.h,
          fillHex: resolveColor(style, el.color, "line"),
        });
        break;
      }

      case "rect": {
        out.push({
          kind: "rect",
          x: el.x + dx,
          y: el.y + dy,
          w: el.w,
          h: el.h,
          fillHex: el.fill ? resolveColor(style, el.fill) : undefined,
          fillAlpha: el.alpha,
          strokeHex: el.stroke ? resolveColor(style, el.stroke, "line") : undefined,
          strokeWeightPt: el.stroke ? (el.strokeWeight ?? style.hairline) : undefined,
        });
        break;
      }

      case "scrim": {
        out.push({
          kind: "rect",
          x: el.x + dx,
          y: el.y + dy,
          w: el.w,
          h: el.h,
          fillHex: resolveColor(style, el.color ?? "#000000"),
          fillAlpha: el.alpha,
        });
        break;
      }

      case "image": {
        const src = resolveSrc(pick(scope, el.bind), ctx.assets);
        if (!src) {
          if (el.placeholder !== false) {
            // 사진이 아직 없으면 자리만 얇은 선으로 표시
            out.push({
              kind: "rect",
              x: el.x + dx,
              y: el.y + dy,
              w: el.w,
              h: el.h,
              strokeHex: resolveColor(style, "line"),
              strokeWeightPt: style.hairline,
            });
          }
          break;
        }
        out.push({
          kind: "image",
          x: el.x + dx,
          y: el.y + dy,
          w: el.w,
          h: el.h,
          src,
          fit: el.fit ?? "cover",
        });
        break;
      }

      case "repeat": {
        const arr = pick(scope, el.over);
        if (!Array.isArray(arr) || arr.length === 0) break;
        const items = el.max ? arr.slice(0, el.max) : arr;
        const perRow = el.perRow ?? items.length;

        items.forEach((item, i) => {
          const col = i % perRow;
          const row = Math.floor(i / perRow);
          const ox =
            el.origin.x + col * (el.step.x ?? 0) + row * (el.rowStep?.x ?? 0);
          const oy =
            el.origin.y + col * (el.step.y ?? 0) + row * (el.rowStep?.y ?? 0);

          const itemScope: Content = {
            ...(typeof item === "object" && item !== null ? item : { value: item }),
            $index: i + 1,
            $index2: String(i + 1).padStart(2, "0"),
            $count: items.length,
            // 첫 항목/마지막 항목만 빼고 그리고 싶을 때 쓴다 (칸 사이 구분선 등)
            $notFirst: i > 0 ? "y" : "",
            $notLast: i < items.length - 1 ? "y" : "",
          };
          walk(el.elements, itemScope, ox + dx, oy + dy, ctx, out);
        });
        break;
      }
    }
  }
}

/**
 * 아직 못 채운 칸을 찾는다. 내보내기 전에 경고로 보여주기 위한 것.
 * (기획서 52줄)
 */
export function collectTodos(pageType: PageType, content: Content, slideIndex: number): Todo[] {
  const todos: Todo[] = [];

  const scan = (slots: Slot[], scope: Content, prefix: string) => {
    for (const s of slots) {
      const v = scope?.[s.key];
      if (s.kind === "list") {
        if (Array.isArray(v) && s.itemSlots) {
          v.forEach((item, i) => scan(s.itemSlots!, item ?? {}, `${prefix}${s.label} ${i + 1} · `));
        } else if (s.required && isEmpty(v)) {
          todos.push({ slideIndex, pageTypeName: pageType.name, label: prefix + s.label });
        }
        continue;
      }
      if (s.required && isEmpty(v)) {
        todos.push({ slideIndex, pageTypeName: pageType.name, label: prefix + s.label });
      }
    }
  };

  scan(pageType.slots, content, "");
  return todos;
}
