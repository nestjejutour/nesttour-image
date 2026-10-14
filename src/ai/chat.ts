import type { Content, PageType, Slide, StylePreset } from "../core/types";

/**
 * 화면을 보면서 하는 대화.
 *
 * AI 에게 ① 공장에 쌓인 것 ② 지금 페이지의 데이터 ③ 지금 페이지의 그림 을 준다.
 * AI 는 말 한마디와 함께 "할 일 목록"을 돌려준다.
 */

/** AI 가 할 수 있는 일 */
export type Action =
  | { do: "내용수정"; content: Content }
  | { do: "타입바꾸기"; pageTypeId: string; content: Content }
  | { do: "페이지추가"; pageTypeId: string; content: Content; at?: number }
  | { do: "페이지삭제"; at: number }
  | { do: "페이지이동"; from: number; to: number }
  /* 아래 둘은 전체에 영향을 주므로 대표님 확인을 받는다 */
  | { do: "스타일제안"; path: string; value: number | string; why: string }
  | { do: "규칙제안"; text: string };

export interface Reply {
  /** 사람에게 하는 말. 한두 문장 */
  say: string;
  actions: Action[];
}

/** 확인을 받아야 하는 일인가 (전체에 영향을 주는 것) */
export const needsOk = (a: Action) => a.do === "스타일제안" || a.do === "규칙제안";

export function chatSystem(opts: {
  brain: string;
  style: StylePreset;
  pageTypes: PageType[];
  pageType: PageType;
  slide: Slide;
  slideIndex: number;
  totalSlides: number;
}): string {
  const { brain, style, pageType, pageTypes, slide, slideIndex, totalSlides } = opts;

  const slotHelp = pageType.slots
    .map((s) => {
      if (s.kind === "list") {
        const inner = (s.itemSlots ?? []).map((x) => x.key).join(", ");
        return `  ${s.key}: 목록[{${inner}}]${s.max ? ` (최대 ${s.max})` : ""}`;
      }
      return `  ${s.key}: ${s.kind}`;
    })
    .join("\n");

  const typeList = pageTypes.map((t) => `${t.id}(${t.name})`).join(", ");

  const sizeTokens = Object.entries(style.type)
    .map(([k, v]) => `type.${k}.size=${v.size}`)
    .join(", ");

  return `${brain}

────────────────────────────────
지금 대표가 보고 있는 화면

${slideIndex + 1}번째 페이지 (전체 ${totalSlides}장)
페이지 타입: ${pageType.id} (${pageType.name}) — ${pageType.description}

이 타입이 가진 칸:
${slotHelp}

지금 들어 있는 내용:
${JSON.stringify(slide.content, null, 1)}

함께 보낸 그림이 바로 이 페이지의 현재 모습이다. 그림을 보고 판단하라.
그림이 없으면 데이터만 보고 판단하되, 보이지 않는 것을 단정하지 마라.

────────────────────────────────
네가 할 수 있는 일

{"do":"내용수정","content":{...}}
   — 이 페이지의 글·숫자를 바꾼다. 가장 많이 쓴다. 칸 이름은 그대로 두어라.
{"do":"타입바꾸기","pageTypeId":"...","content":{...}}
   — 페이지 틀 자체가 안 맞을 때. 쓸 수 있는 틀: ${typeList}
{"do":"페이지추가","pageTypeId":"...","content":{...},"at":숫자}
   — at 은 넣을 자리(0부터). 빼면 맨 뒤.
{"do":"페이지삭제","at":숫자}
{"do":"페이지이동","from":숫자,"to":숫자}
{"do":"스타일제안","path":"type.pageTitle.size","value":26,"why":"이유"}
   — 글자 크기·색을 바꾼다. 모든 제안서에 영향을 주므로 대표의 확인을 받는다.
     쓸 수 있는 값: ${sizeTokens}, color.ink, color.muted, color.accent, color.line
{"do":"규칙제안","text":"..."}
   — 지시가 "앞으로도 이렇게"로 들릴 때만. 매번 제안하지 마라.

────────────────────────────────
어떻게 답할지

{"say":"대표에게 할 말 한두 문장","actions":[ ... ]}

- say 는 한국어로 짧고 단정하게. 인사말·사과 없이 무엇을 바꿨는지만.
- 고칠 게 없거나 질문이면 actions 를 빈 배열로 두고 say 에만 답하라.
- 추측해서 숫자를 지어내지 마라. 모르면 그 칸은 "" 로 두고 say 에서 물어라.
- 위에 적힌 "반드시 지킬 원칙"을 어기는 요청이면, 그대로 하지 말고 왜 그런지 한 문장으로 말하고 대안을 제시하라.
- JSON 만 출력하라. 설명·코드펜스 금지.`;
}
