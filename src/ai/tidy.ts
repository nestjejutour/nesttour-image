import type { Category, Project, Rule, StylePreset } from "../core/types";

/**
 * 규칙 정리 도우미
 *
 * 규칙은 쌓이기만 하면 썩는다. 중복이 생기고, 서로 싸우고,
 * 1회성 지시가 공통으로 올라가 전체를 망친다.
 * AI 에게 한 번 훑게 하고, 대표님은 체크만 한다.
 */

export type Proposal =
  | { kind: "범위이동"; ruleId: string; to: "공통" | "스타일" | "분류" | "제안서"; why: string }
  | { kind: "중복"; keepId: string; removeIds: string[]; why: string }
  | { kind: "충돌"; ruleIds: string[]; why: string; suggestion: string }
  | { kind: "다듬기"; ruleId: string; text: string; why: string };

export interface TidyReply {
  say: string;
  proposals: Proposal[];
}

/** 공통 규칙은 적을수록 세다. 이 수를 넘으면 정리를 권한다. */
export const COMMON_LIMIT = 12;

export function tidySystem(opts: {
  rules: Rule[];
  styles: StylePreset[];
  categories: Category[];
  projects: Project[];
}): string {
  const { rules, styles, categories, projects } = opts;

  const name = (r: Rule) => {
    if (r.scope === "공통") return "공통";
    if (r.scope === "스타일") return `스타일:${styles.find((s) => s.id === r.scopeId)?.name ?? "?"}`;
    if (r.scope === "분류") return `분류:${categories.find((c) => c.id === r.scopeId)?.name ?? "?"}`;
    return `제안서:${projects.find((p) => p.id === r.scopeId)?.title ?? "?"}`;
  };

  const list = rules.map((r) => `[${r.id}] (${name(r)}) ${r.text}`).join("\n");

  return `당신은 디자인 규칙을 정리하는 사람이다.

아래는 지금까지 쌓인 규칙 전부다. 범위가 괄호 안에 있다.

${list}

────────────────────────────────
범위의 뜻

- 공통   : 어떤 문서든 지키는 것. 글쓰기 태도, 군더더기 금지 같은 보편적인 것만.
           여기는 적을수록 좋다. ${COMMON_LIMIT}개를 넘기지 않는 게 목표다.
- 스타일 : 이 브랜드 규격에만 해당. 색·로고·CI 처럼 브랜드마다 다른 것.
- 분류   : 이 문서 종류에만 해당 (입찰기획서, 회사소개서 …).
- 제안서 : 이 건 하나에만. 1회성 요청.

────────────────────────────────
찾아야 할 것

1. 범위가 틀린 규칙
   - 브랜드 색·로고 얘기가 "공통"에 있으면 "스타일"로 내려야 한다.
   - 한 고객사 사정으로 생긴 규칙이 위로 올라가 있으면 "제안서"로 내려야 한다.
2. 중복 — 같은 말을 다르게 쓴 것. 하나만 남기고 나머지는 지운다.
3. 충돌 — 둘 다 지킬 수 없는 것. 어느 쪽을 택할지 제안한다.
4. 다듬기 — 말이 길거나 모호해서 AI 가 지키기 어려운 것. 짧고 분명하게 고쳐 쓴다.

멀쩡한 규칙은 건드리지 마라. 고칠 게 없으면 proposals 를 빈 배열로 두어라.

────────────────────────────────
대답 형식 (JSON 만)

{"say":"한두 문장 요약",
 "proposals":[
  {"kind":"범위이동","ruleId":"...","to":"스타일","why":"짧은 이유"},
  {"kind":"중복","keepId":"...","removeIds":["...","..."],"why":"짧은 이유"},
  {"kind":"충돌","ruleIds":["...","..."],"why":"짧은 이유","suggestion":"어떻게 할지"},
  {"kind":"다듬기","ruleId":"...","text":"고쳐 쓴 문장","why":"짧은 이유"}
 ]}`;
}
