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
  | { do: "다른장수정"; at: number; content: Content }
  | { do: "타입바꾸기"; pageTypeId: string; content: Content }
  | { do: "페이지추가"; pageTypeId: string; content: Content; at?: number }
  | { do: "페이지삭제"; at: number }
  | { do: "페이지이동"; from: number; to: number }
  /* 아래 둘은 범위를 고르는 확인을 받는다 */
  | { do: "스타일제안"; path: string; value: number | string; why: string; scope?: "제안서" | "스타일" }
  | { do: "규칙제안"; text: string; scope?: "공통" | "스타일" | "분류" | "제안서" }
  /* 보관함에서 — 제안서 자체를 새로 만든다 */
  | { do: "새제안서"; title: string; client?: string; category?: string;
      slides: { pageTypeId: string; content: Content }[] };

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
  /** 같은 제안서의 다른 장들 — 흐름을 보고 판단하라고 준다 */
  deck?: { pageTypeId: string; pageTypeName: string; content: Content }[];
}): string {
  const { brain, style, pageType, pageTypes, slide, slideIndex, totalSlides, deck = [] } = opts;

  // 이 제안서 전체의 뼈대. 한 장만 보고 고치면 앞뒤 흐름이 어긋난다.
  const deckBlock = deck.length
    ? deck
        .map((d, i) => {
          const mark = i === slideIndex ? " ← 지금 보는 장" : "";
          const body = JSON.stringify(d.content);
          return `${i + 1}. ${d.pageTypeId}(${d.pageTypeName})${mark}\n   ${body.length > 420 ? body.slice(0, 420) + "…" : body}`;
        })
        .join("\n")
    : "(한 장뿐이다)";

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

────────────────────────────────
이 제안서 전체 (${totalSlides}장)

${deckBlock}

앞뒤 흐름·말투·숫자가 서로 맞는지 여기를 보고 판단하라.
다른 장의 숫자와 어긋나면 그 사실을 먼저 알려라.

함께 보낸 그림 중 첫 장이 바로 이 페이지의 현재 모습이다. 그림을 보고 판단하라.
그림이 없으면 데이터만 보고 판단하되, 보이지 않는 것을 단정하지 마라.

[대표가 사진을 올렸을 때]
대표의 말 끝에 "사진 칸에 넣을 이름: 올린사진-1, …" 이 붙어 오면,
그 뒤의 그림들이 방금 올린 사진이고 이미 제안서에 등록되어 있다는 뜻이다.
사진을 넣으려면 "내용수정" 으로 사진 칸(kind 가 image 인 칸)에 그 이름을 그대로 적어라.
  예) {"do":"내용수정","content":{ ... ,"photo":"올린사진-1"}}
 · 사진을 보고 어느 칸에 맞는지 판단하라. 대표가 칸을 지정했으면 그대로 따르라.
 · 사진이 여러 장이면 순서대로 빈 사진 칸부터 채워라. 목록(카드 등)이면 각 항목의 사진 칸에.
 · 그 칸에 이미 사진이 있으면 바꿔 끼운다. 바꿨다는 사실을 say 에 적어라.
 · 이름을 지어내지 마라. 위에 적힌 이름만 쓸 수 있다.
 · 넣을 사진 칸이 없는 페이지면, 넣지 말고 어느 페이지로 보낼지 say 에서 물어라.

────────────────────────────────
네가 할 수 있는 일

{"do":"내용수정","content":{...}}
   — 지금 보는 페이지의 글·숫자를 바꾼다. 가장 많이 쓴다. 칸 이름은 그대로 두어라.
{"do":"다른장수정","at":숫자,"content":{...}}
   — 다른 장을 고친다. at 은 장 번호(0부터). 여러 장을 한 번에 고칠 수 있다.
     대표가 "전체", "다 바꿔줘", "앞 장들도" 라고 할 때 쓴다.
     그 장의 칸 구조에 맞춰야 한다. 위의 전체 목록에서 타입을 확인하라.
{"do":"타입바꾸기","pageTypeId":"...","content":{...}}
   — 페이지 틀 자체가 안 맞을 때. 쓸 수 있는 틀: ${typeList}
{"do":"페이지추가","pageTypeId":"...","content":{...},"at":숫자}
   — at 은 넣을 자리(0부터). 빼면 맨 뒤.
{"do":"페이지삭제","at":숫자}
{"do":"페이지이동","from":숫자,"to":숫자}
{"do":"스타일제안","path":"type.pageTitle.size","value":26,"why":"이유","scope":"제안서"}
   — 글자 크기·색을 바꾼다. 대표의 확인을 받는다.
     scope: "제안서"=이 제안서만 / "스타일"=이 브랜드 규격 전체.
     확신이 없으면 "제안서"로 제안하라. 1회성 지시가 전체로 번지면 안 된다.
     쓸 수 있는 값: ${sizeTokens}, color.ink, color.muted, color.accent, color.line
{"do":"규칙제안","text":"...","scope":"스타일"}
   — 지시가 "앞으로도 이렇게"로 들릴 때만. 매번 제안하지 마라.
     scope: "공통"=어떤 문서든 / "스타일"=이 브랜드만 / "분류"=이 문서 종류만 / "제안서"=이 건만.
     어디까지 번져야 할지 애매하면 좁은 쪽을 고르라.

────────────────────────────────
어떻게 답할지

{"say":"대표에게 할 말 한두 문장","actions":[ ... ]}

- say 는 한국어로 짧고 단정하게. 인사말·사과 없이 무엇을 바꿨는지만.
- 고칠 게 없거나 질문이면 actions 를 빈 배열로 두고 say 에만 답하라.
- 추측해서 숫자를 지어내지 마라. 모르면 그 칸은 "" 로 두고 say 에서 물어라.
- 위에 적힌 "반드시 지킬 원칙"을 어기는 요청이면, 그대로 하지 말고 왜 그런지 한 문장으로 말하고 대안을 제시하라.
- JSON 만 출력하라. 설명·코드펜스 금지.`;
}


/**
 * 보관함에서 하는 대화 — 아직 연 제안서가 없을 때.
 *
 * "인천관광공사 제안서 하나 만들어줘" 라고 하면 바로 만들어 준다.
 * 제안서를 열어야만 말을 걸 수 있으면 대화창이 아니다.
 */
export function librarySystem(opts: {
  brain: string;
  categories: { id: string; name: string }[];
  projects: {
    id: string; title: string; client: string;
    slides: { pageTypeId: string; content: Content }[];
  }[];
}): string {
  const cats = opts.categories.map((c) => `${c.id}(${c.name})`).join(", ");

  // 최근 것부터 몇 건은 "안에 뭐가 쓰여 있는지"까지 보여 준다.
  // 제목만 보고 "원본 글을 볼 수 없다" 고 답하면 쓸모가 없다.
  const DEEP = 4;
  const shelf = opts.projects.length
    ? opts.projects
        .map((p, i) => {
          const head = `· [${p.id}] "${p.title}" — ${p.client || "고객사 없음"} · ${p.slides.length}장`;
          if (i >= DEEP) return `${head}  (구성: ${p.slides.map((s2) => s2.pageTypeId).join(" → ")})`;
          const body = p.slides
            .map((s2, k) => {
              const t = JSON.stringify(s2.content);
              return `    ${k + 1}. ${s2.pageTypeId}  ${t.length > 360 ? t.slice(0, 360) + "…" : t}`;
            })
            .join("\n");
          return `${head}\n${body}`;
        })
        .join("\n")
    : "(아직 없음)";

  return `${opts.brain}

────────────────────────────────
지금 대표는 보관함(첫 화면)을 보고 있다. 아직 연 제안서가 없다.

[보관함에 있는 것 — 앞의 몇 건은 안에 쓰인 글까지 그대로다]
${shelf}

지난 제안서를 다시 꾸미라고 하면, 위에 적힌 그 글을 그대로 옮겨 담아라.
"원본 글을 볼 수 없다" 고 답하지 마라. 여기 다 적혀 있다.

[분류] ${cats}

────────────────────────────────
네가 할 수 있는 일

{"do":"새제안서","title":"...","client":"...","category":"proposal",
 "slides":[{"pageTypeId":"...","content":{...}}]}
   — 제안서를 통째로 만든다. 만든 것은 대화창에 그림으로 바로 보인다.
     안을 두세 가지 보여 줄 때는 "새제안서" 를 그만큼 넣어라. 다 만들어진다.
     제목 끝에 "(안 1)", "(안 2)" 처럼 붙여 구분해 주어라.
     자료가 부족하면 지어내지 말고, 먼저 무엇이 필요한지 물어라.
     대표의 말 끝에 "사진 칸에 넣을 이름: 올린사진-1, …" 이 붙어 오면,
     그 사진들은 새로 만들 제안서에 함께 들어간다. 사진 칸에 그 이름을 그대로 적어라.
     이름을 지어내지 마라.
{"do":"규칙제안","text":"...","scope":"공통"}
   — 대화 중 "앞으로도 이렇게" 가 나왔을 때만.

{"say":"대표에게 할 말","actions":[ ... ]}

- 묻는 말이면 actions 를 비우고 say 로만 답하라.
- 제안서를 만들라고 하면 바로 만들어라. 다시 묻지 마라.
  다만 고객사·주제처럼 꼭 필요한 게 없으면 그것만 짧게 물어라.
- JSON 만 출력하라.`;
}