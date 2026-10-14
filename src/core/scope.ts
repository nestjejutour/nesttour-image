import type { Project, Rule, StyleOverride, StylePreset } from "./types";

/**
 * 범위 고르기 — 공장이 커져도 엉키지 않게 하는 부품
 *
 * 규칙이 200개 쌓여도 한 제안서에 적용되는 건 그중 일부다.
 * AI 에게는 "지금 이 건에 해당하는 것만" 넘긴다.
 */

export function rulesFor(
  rules: Rule[],
  opts: { styleId: string; categoryId: string; projectId?: string | null },
): Rule[] {
  return rules.filter((r) => {
    if (!r.enabled) return false;
    switch (r.scope) {
      case "공통": return true;
      case "스타일": return r.scopeId === opts.styleId;
      case "분류": return r.scopeId === opts.categoryId;
      case "제안서": return !!opts.projectId && r.scopeId === opts.projectId;
      default: return false;
    }
  });
}

/** 범위를 사람이 읽는 말로 */
export function scopeLabel(
  r: Rule,
  look: { styleName?: (id: string) => string; categoryName?: (id: string) => string; projectName?: (id: string) => string },
): string {
  switch (r.scope) {
    case "공통": return "공통";
    case "스타일": return `스타일 · ${look.styleName?.(r.scopeId ?? "") ?? "?"}`;
    case "분류": return `분류 · ${look.categoryName?.(r.scopeId ?? "") ?? "?"}`;
    case "제안서": return `이 제안서만 · ${look.projectName?.(r.scopeId ?? "") ?? "?"}`;
    default: return "?";
  }
}

/**
 * 이 제안서에 실제로 적용되는 규격을 만든다.
 * 기본 스타일 위에 "이 제안서만" 바꾼 값을 덮는다.
 */
export function styleFor(base: StylePreset, o?: StyleOverride): StylePreset {
  if (!o) return base;
  return {
    ...base,
    slide: { ...base.slide, ...(o.slide ?? {}) },
    hairline: o.hairline ?? base.hairline,
    color: { ...base.color, ...(o.color ?? {}) },
    type: Object.fromEntries(
      Object.entries(base.type).map(([k, v]) => [k, { ...v, ...(o.type?.[k] ?? {}) }]),
    ),
  };
}

/** "type.pageTitle.size" 같은 길에 값을 넣은 덮어쓰기 묶음을 만든다 */
export function overrideWith(
  o: StyleOverride | undefined,
  path: string,
  value: number | string,
): StyleOverride {
  const next: StyleOverride = structuredClone(o ?? {});
  const [group, a, b] = path.split(".");
  if (group === "color" && a) {
    next.color = { ...(next.color ?? {}), [a]: String(value) };
  } else if (group === "type" && a && b) {
    next.type = { ...(next.type ?? {}), [a]: { ...(next.type?.[a] ?? {}), [b]: value } as any };
  } else if (group === "hairline") {
    next.hairline = Number(value);
  } else if (group === "slide" && a) {
    next.slide = { ...(next.slide ?? {}), [a]: Number(value) } as any;
  }
  return next;
}
