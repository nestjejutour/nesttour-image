import type { PageType, Project, Rule, Slide, StylePreset } from "../core/types";

/**
 * ============================================================
 *  공장의 머리 — 쌓인 걸 전부 읽어서 AI 에게 건넨다
 * ============================================================
 *
 *  이게 "쓸수록 좋아지는" 부분이다.
 *  규칙이 늘면, 사례가 쌓이면, 페이지 타입이 늘면
 *  이 함수가 건네주는 내용이 두꺼워지고 결과가 좋아진다.
 *  AI 쪽 코드는 손대지 않아도 된다.
 */

export interface Brain {
  system: string;
  /** 참고로 넘긴 것들 — 화면에 "무엇을 보고 만들었는지" 보여주기 위함 */
  used: { rules: number; pageTypes: number; examples: number };
}

export function buildBrain(opts: {
  style: StylePreset;
  rules: Rule[];
  pageTypes: PageType[];
  /** 지금까지 만든 제안서들 (사례 창고) */
  pastProjects: Project[];
}): Brain {
  const { style, rules, pageTypes, pastProjects } = opts;
  const on = rules.filter((r) => r.enabled);

  // ── 1. 스타일 규격 ──
  const styleBlock = [
    `브랜드: ${style.brand} / 스타일: ${style.name}`,
    `판 크기: ${style.slide.widthIn} × ${style.slide.heightIn} 인치 (16:9)`,
    `색: ${Object.entries(style.color).map(([k, v]) => `${k}=${v}`).join(", ")}`,
    `글자 규격: ${Object.entries(style.type)
      .map(([k, v]) => `${k}=${v.size}pt${v.bold ? " bold" : ""}`)
      .join(", ")}`,
  ].join("\n");

  // ── 2. 켜진 규칙 (대표가 쌓아온 취향) ──
  const rulesBlock = on.map((r, i) => `${i + 1}. ${r.text}`).join("\n");

  // ── 3. 쓸 수 있는 페이지 타입과 그 칸 구조 ──
  const typesBlock = pageTypes
    .map((t) => {
      const slots = t.slots
        .map((s) => {
          const req = s.required ? "*" : "";
          if (s.kind === "list") {
            const inner = (s.itemSlots ?? [])
              .map((x) => `${x.key}${x.required ? "*" : ""}`)
              .join(", ");
            return `${s.key}${req}: 목록[{${inner}}]${s.max ? ` 최대${s.max}` : ""}`;
          }
          return `${s.key}${req}: ${s.kind}`;
        })
        .join(" / ");
      return `- ${t.id} (${t.name}) — ${t.description}\n  칸: ${slots}`;
    })
    .join("\n");

  // ── 4. 사례 창고 (지난 제안서들의 페이지 구성) ──
  const examples = pastProjects.filter((p) => p.slides.length > 0).slice(0, 5);
  const examplesBlock = examples.length
    ? examples
        .map(
          (p) =>
            `· "${p.title}" (${p.client || "고객사 없음"}, ${p.category}) — ` +
            p.slides.map((s) => s.pageTypeId).join(" → "),
        )
        .join("\n")
    : "(아직 없음. 제안서를 만들수록 여기가 채워지고 결과가 좋아진다)";

  const system = `당신은 ${style.brand}의 제안서를 만드는 디자이너다.
좌표와 디자인은 이미 레이아웃이 책임진다. 당신은 "어떤 페이지를 어떤 순서로 놓고, 각 칸에 무슨 글을 넣을지"만 정한다.

[스타일 규격]
${styleBlock}

[반드시 지킬 원칙 — 대표가 정한 것이다. 어기지 마라]
${rulesBlock}

[쓸 수 있는 페이지 타입]
${typesBlock}

[지난 제안서들의 페이지 구성 — 이 흐름을 참고하라]
${examplesBlock}

[글쓰기]
- 한국어. 간결하고 단정하게. 과장·형용사 남발 금지.
- 숫자는 천 단위 쉼표를 넣는다.
- 모르는 숫자나 사실은 지어내지 마라. 그 칸은 빈 문자열("")로 두어라. 화면에 빨간 [ 확인 필요 ]로 표시된다.
- accent(코랄) 강조는 한 페이지에 최대 하나다. 강조할 항목에만 "accent": "y" 를 넣어라.

[대답 형식]
JSON만 출력하라. 설명·인사말·코드펜스 금지.`;

  return {
    system,
    used: { rules: on.length, pageTypes: pageTypes.length, examples: examples.length },
  };
}

/** 초안 만들기 요청문 */
export function draftRequest(sourceText: string, hint: string): string {
  return `아래 자료로 제안서 한 건의 페이지 구성을 짜라.

[자료]
${sourceText}

[요청]
${hint || "표지부터 마무리까지, 8~14장 정도로."}

[형식]
{"slides":[{"pageTypeId":"...","content":{...}}]}
content 의 열쇠(key)는 위 "쓸 수 있는 페이지 타입"에 적힌 칸 이름을 정확히 그대로 써라.`;
}

/** 한 페이지 고치기 요청문 */
export function editRequest(
  pageType: PageType,
  slide: Slide,
  instruction: string,
): string {
  return `아래 페이지를 지시대로 고쳐라.

[페이지 타입] ${pageType.id} (${pageType.name})
[지금 내용]
${JSON.stringify(slide.content, null, 1)}

[대표의 지시]
${instruction}

[형식]
{"content":{...}}
칸 이름은 그대로 유지하라. 지시와 상관없는 칸은 건드리지 마라.`;
}

/** 이 지시가 "앞으로도 적용할 원칙"인지 판별 요청문 */
export function rulePromotionRequest(instruction: string): string {
  return `대표가 방금 이런 지시를 했다: "${instruction}"

이 지시가 (가) 이번 한 번만 적용할 일회성인지, (나) 앞으로 모든 제안서에 적용할 원칙인지 판단하라.

[형식]
{"isRule":true 또는 false,"ruleText":"원칙이라면 한 문장으로 다듬어서. 아니면 빈 문자열"}`;
}
