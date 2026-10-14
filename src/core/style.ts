import type { StylePreset } from "./types";

/**
 * 창고 1 — 스타일
 *
 * 기획서 7장에서 대표님이 확정한 값 그대로다.
 * 올려주신 v10.pptx 에서 뽑은 색과도 일치한다 (2B2B2B / 8C8C8C / FF6D6A / E3E3E3).
 *
 * 이 파일의 숫자를 바꾸면 모든 페이지가 한 번에 바뀐다.
 * 페이지 쪽에서는 색이나 크기를 절대 직접 쓰지 않고, 여기 이름만 가리킨다.
 */
export const HOTPLTRIP_MINIMAL: StylePreset = {
  id: "hotpltrip-minimal",
  name: "핫플트립 미니멀",
  brand: "핫플트립",
  version: 1,

  slide: { widthIn: 10, heightIn: 5.625, marginIn: 0.6 },

  font: { family: "Pretendard", fallback: ["Noto Sans KR", "맑은 고딕", "Malgun Gothic", "sans-serif"] },

  color: {
    ink: "#2B2B2B",        // 본문 글자
    muted: "#8C8C8C",      // 흐린 글자 (부제, 설명)
    line: "#E3E3E3",       // 얇은 구분선
    lineStrong: "#CFCFCF", // 조금 진한 선
    background: "#FFFFFF",
    accent: "#FF6D6A",     // 코랄. 임팩트에만 쓴다
    white: "#FFFFFF",
    todo: "#E03131",       // [ 확인 필요 ] 표시용. 디자인 색이 아니다
  },

  type: {
    // 표지
    coverTitleBold: { size: 36, bold: true, color: "ink", lineSpacingMul: 1.15 },
    coverTitleThin: { size: 30, color: "ink", lineSpacingMul: 1.15 },

    // 본문 페이지
    pageTitle: { size: 24, bold: true, color: "ink" },
    subtitle: { size: 10.5, color: "muted", lineSpacingMul: 1.4 },
    body: { size: 11, color: "ink", lineSpacingMul: 1.45 },
    caption: { size: 10, color: "muted", lineSpacingMul: 1.35 },

    // 임팩트
    keyNumber: { size: 26, bold: true, color: "ink" },
    keyNumberBig: { size: 44, bold: true, color: "ink" },
    sectionNo: { size: 44, bold: true, color: "accent" },

    // 요약·카드
    keyword: { size: 16, bold: true, color: "ink" },
    rowLabel: { size: 11, bold: true, color: "ink" },
    cardNo: { size: 10, bold: true, color: "muted" },
    cardTitle: { size: 13, bold: true, color: "ink" },

    // 사진 위 흰 글씨
    overlay: { size: 20, bold: true, color: "white", lineSpacingMul: 1.3 },
  },

  // 페이지 번호만 오른쪽 아래 아주 작게 (기획서 99줄)
  pageNo: { x: 8.9, y: 5.16, w: 0.5, h: 0.22, size: 8, color: "muted" },

  // 영역은 얇은 선으로만 구분 (기획서 95줄). 0.75pt
  hairline: 0.75,

  logo: "assets/logo/hotpltrip.png",
  updatedAt: "2026-10-14",
};

export const BUILT_IN_STYLES: StylePreset[] = [HOTPLTRIP_MINIMAL];

/** 색 이름을 실제 색으로 바꾼다. 이미 #RRGGBB 면 그대로 둔다. */
export function resolveColor(style: StylePreset, name: string | undefined, fallback = "ink"): string {
  const key = name ?? fallback;
  if (key.startsWith("#")) return key;
  return style.color[key] ?? style.color[fallback] ?? "#2B2B2B";
}
