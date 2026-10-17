import type { Content, PageType, Slide, StylePreset } from "../core/types";
import { 비신뢰원칙 } from "./brain";

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
  /* 아직 넣지 않고 "이렇게 하면 어떻겠습니까" 로 보여 준다 */
  | { do: "시안"; options: {
      name: string; why?: string; pageTypeId?: string;
      content: Content; style?: Record<string, number | string>;
    }[] }
  /* 제안서 한 벌을 통째로 — 역시 고르기 전에는 안 바뀐다 */
  | { do: "전체시안"; options: {
      name: string; why?: string;
      style?: Record<string, number | string>;
      slides?: { pageTypeId: string; content: Content; style?: Record<string, number | string> }[];
    }[] }
  /* 보관함에서 — 제안서 자체를 새로 만든다 */
  | { do: "새제안서"; title: string; client?: string; category?: string;
      slides: { pageTypeId: string; content: Content }[] }
  /* 보관함에서 — 현수막·배너를 치수까지 정해 만든다 */
  | { do: "새인쇄물"; title: string; category?: string;
      가로cm: number; 세로cm: number; content: Content };

export interface Reply {
  /** 사람에게 하는 말. 한두 문장 */
  say: string;
  actions: Action[];
}

/** 확인을 받아야 하는 일인가 (전체에 영향을 주는 것) */
export const needsOk = (a: Action) => a.do === "스타일제안" || a.do === "규칙제안";

/** 인터넷 검색을 쥐여 줬을 때 덧붙이는 말 */
export const WEB_NOTE = `
────────────────────────────────
인터넷 검색

찾아보는 연장을 쓸 수 있다. 둘은 찾는 곳이 다르니 가려 써라.

· "인터넷검색" · "웹페이지읽기" — 기본으로 이걸 쓴다. 생각보다 넓다.

  검색어에 site:주소 를 붙이면 그 사이트 안만 뒤진다. 이게 제일 쓸모 있다.
    site:g2b.go.kr      나라장터 — 입찰 공고와 제안요청서 본문까지 잡힌다
    site:blog.naver.com 네이버 블로그 — 후기·가격·현장 이야기가 본문째로
    site:<발주처 주소>   그 기관의 공고·보도자료만

  관공서 공고, 보도자료, 뉴스, 기업 공식 홈페이지, 해외 자료 모두 잡힌다.
  네이버 카페만 로그인 벽이라 이 길로는 안 잡힌다.

· "네이버검색" — 네이버 정식 창구 (켜져 있을 때)
  바깥 검색으로 못 가는 곳에 쓴다 — 카페글, 지역 업체(주소·전화),
  쇼핑 가격, 지식iN. 최신순으로 훑을 때(sort=date)도 이쪽이 낫다.

· "구글검색" — 가장 넓게
  앞의 둘로 못 찾았을 때 한 번 더. 한 사이트 안에서만 찾을 때(site),
  최근 것만 볼 때(기간). 하루 쓸 횟수가 적으니 아껴 쓰고,
  한 번에 제대로 된 검색어를 넣어라.

발주처가 뭘 하겠다고 공표했는지, 사람들이 어떻게 받아들이는지 — 둘 다 찾아 맞춰 보라.
앞의 것은 공식 자료, 뒤의 것은 블로그 후기에 있다.

지금의 사실이 필요할 때만 쓴다 — 시세, 최근 소식, 경쟁사 현황, 통계, 공고 내용.
글을 다듬거나 구성을 짜는 일에는 쓰지 마라. 그건 찾아보지 않아도 된다.
찾은 뒤에는 출처와 기준 날짜를 say 에 밝혀라.
찾아도 확실하지 않으면 지어내지 말고 모른다고 말하라.`;

/**
 * 현수막·배너를 만들 때만 붙는 안내.
 *
 * 현수막은 PPT 가 아니다. 종이가 400×70cm 처럼 납작하고,
 * 사진을 끼우는 게 아니라 그림을 그려야 한다.
 * 그래서 AI 에게 "그림을 글로 적는 법" 을 따로 가르쳐야 한다.
 */
function 현수막안내(style: StylePreset): string {
  const 가로cm = Math.round(style.slide.widthIn * 2.54);
  const 세로cm = Math.round(style.slide.heightIn * 2.54);
  const vbW = 가로cm * 4;
  const vbH = 세로cm * 4;

  return `
────────────────────────────────
여기는 현수막이다 — 제안서가 아니다

종이 크기: ${가로cm} × ${세로cm} cm
이건 실제 인쇄 크기다. 길쭉한 천에 박아서 벽에 거는 것이다.

[현수막이 제안서와 다른 점]
· 지나가며 3초 안에 읽힌다. 글이 많으면 실패한 현수막이다.
  큰 글씨 한 줄, 작은 글씨 한 줄, 날짜·장소 한 줄. 이게 끝이다.
· 바탕에 깔 사진이 없다. 네가 그림을 그려야 한다.
· 멀리서 본다. 글씨는 크고 굵게, 색은 또렷하게.

[바탕 그림은 네가 그린다 — "art" 칸에 SVG 를 적어라]
사진 칸("art")에 사진 이름 대신 SVG 를 그대로 적으면 그게 바탕 그림이 된다.
너는 사진을 찍지는 못하지만 그림은 적을 수 있다. 현수막은 원래 그림이다 —
일러스트레이터로 만드는 것이고, 그건 선과 면과 색의 좌표다. 그걸 적으면 된다.
선으로 적은 그림은 아무리 키워도 안 깨진다. 인쇄소에 넘길 때 이게 결정적이다.

반드시 지킬 것:
1. 첫 줄은 정확히 이렇게 — <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}">
   이 종이 비율에 맞춘 값이다. 다른 숫자를 쓰면 그림이 늘어진다.
2. **그림 안에 글자를 넣지 마라.** <text> 금지.
   글자는 "주제목"·"부제목"·"덧말" 칸에 따로 적는다. 그래야 글꼴이 지켜지고
   직원이 글만 따로 고칠 수 있다. 그림에 글을 박으면 둘 다 못 한다.
3. 바깥 주소(http://…)·<image>·<script>·글꼴 불러오기 금지. 안 나온다.
4. 쓸 수 있는 것: rect, circle, ellipse, path, polygon, line,
   linearGradient, radialGradient, g, opacity, filter(blur) — 넉넉하다.
5. 글자가 앉을 가운데 띠(세로 ${Math.round(vbH * 0.3)}~${Math.round(vbH * 0.72)} 쯤)는
   어둡게나 밝게 고르게 깔아라. 거기에 흰 글씨가 올라간다.
   꽃이나 무늬를 그 자리에 빽빽이 두면 글자가 묻힌다.
6. 400~900자 정도로 적어라. 짧으면 허전하고, 너무 길면 화면이 버벅인다.

[잘 나오는 짜임새]
· 하늘 → 먼 산 → 들판 → 앞쪽 꽃 — 이렇게 층을 쌓으면 깊이가 생긴다.
· 같은 색을 3단으로 (진한 것·중간·연한 것) 겹치면 손으로 그린 맛이 난다.
· 한쪽에 색을 모으고 반대쪽을 비우면 글자 자리가 생긴다.
· 꽃·잎은 작은 동그라미를 흩뿌리듯 여러 개 두면 된다. 하나하나 그리지 마라.

[보기 — 제주 유채꽃, 그대로 베끼지 말고 짜임새만 보라]
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}">
 <defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
   <stop offset="0" stop-color="#8ECAE6"/><stop offset="1" stop-color="#E8F4D9"/>
  </linearGradient>
  <linearGradient id="ddm" x1="0" y1="0" x2="0" y2="1">
   <stop offset="0" stop-color="#1B3A2B" stop-opacity="0"/>
   <stop offset=".55" stop-color="#1B3A2B" stop-opacity=".55"/>
   <stop offset="1" stop-color="#1B3A2B" stop-opacity="0"/>
  </linearGradient>
 </defs>
 <rect width="${vbW}" height="${vbH}" fill="url(#sky)"/>
 <path d="M0 ${Math.round(vbH * 0.62)} L${Math.round(vbW * 0.3)} ${Math.round(vbH * 0.3)} L${Math.round(vbW * 0.42)} ${Math.round(vbH * 0.36)} L${Math.round(vbW * 0.55)} ${Math.round(vbH * 0.26)} L${vbW} ${Math.round(vbH * 0.6)} Z" fill="#7FA9B8" opacity=".45"/>
 <path d="M0 ${Math.round(vbH * 0.72)} Q${Math.round(vbW * 0.25)} ${Math.round(vbH * 0.63)} ${Math.round(vbW * 0.5)} ${Math.round(vbH * 0.71)} T${vbW} ${Math.round(vbH * 0.68)} V${vbH} H0 Z" fill="#E3C53A"/>
 <path d="M0 ${Math.round(vbH * 0.82)} Q${Math.round(vbW * 0.3)} ${Math.round(vbH * 0.74)} ${Math.round(vbW * 0.62)} ${Math.round(vbH * 0.83)} T${vbW} ${Math.round(vbH * 0.8)} V${vbH} H0 Z" fill="#F6D847"/>
 <path d="M0 ${Math.round(vbH * 0.92)} Q${Math.round(vbW * 0.35)} ${Math.round(vbH * 0.86)} ${Math.round(vbW * 0.7)} ${Math.round(vbH * 0.93)} T${vbW} ${Math.round(vbH * 0.9)} V${vbH} H0 Z" fill="#FFE97A"/>
 <g fill="#FFF3A8" opacity=".9">
  <circle cx="${Math.round(vbW * 0.05)}" cy="${Math.round(vbH * 0.88)}" r="${Math.round(vbH * 0.035)}"/>
  <circle cx="${Math.round(vbW * 0.11)}" cy="${Math.round(vbH * 0.95)}" r="${Math.round(vbH * 0.028)}"/>
  <circle cx="${Math.round(vbW * 0.88)}" cy="${Math.round(vbH * 0.9)}" r="${Math.round(vbH * 0.032)}"/>
  <circle cx="${Math.round(vbW * 0.95)}" cy="${Math.round(vbH * 0.96)}" r="${Math.round(vbH * 0.026)}"/>
 </g>
 <rect width="${vbW}" height="${vbH}" fill="url(#ddm)"/>
</svg>
맨 끝 "ddm" 한 겹이 글자 자리를 어둡게 깔아 준다. 이걸 꼭 마지막에 두어라.

[글자 자리와 크기]
· "자리" 칸에 가운데 / 왼쪽 / 오른쪽 중 하나를 적으면 글이 그쪽으로 붙는다.
  그림을 한쪽에 몰았으면 글은 반대쪽으로 보내라. 겹쳐 두지 마라.
  예) 꽃을 오른쪽에 그렸으면 {"자리":"왼쪽"}
· 글자 크기는 규격으로 바꾼다 — {"do":"스타일제안","path":"type.coverTitleBold.size", ...}
  현수막 글씨는 기본이 크게 잡혀 있다. 웬만하면 그대로 두어라.

[무슨 말에 무엇으로 답하나]
· "현수막 만들어줘", "유채꽃 넣어서", "예쁘게", "다시", "다른 느낌으로"
  → 전부 {"do":"시안"} 이다. 2~3개를 내라. 바로 고쳐 버리지 마라.
  시안마다 art 에 **서로 다른 그림**을 적어라. 색만 바꾼 걸 셋 내지 마라.
  (예: 하나는 꽃밭, 하나는 큰 꽃 한 송이 접사 느낌, 하나는 색면만으로 단정하게)
· "글자 더 크게", "제목 키워" → {"do":"스타일제안","path":"type.coverTitleBold.size", …}
· "글씨를 왼쪽으로", "오른쪽으로 몰아줘" → {"do":"내용수정","content":{"자리":"왼쪽"}}
· "글 바꿔줘" → {"do":"내용수정"}
· 그림은 그대로 두고 글만 고칠 때는 art 를 content 에서 빼라. 그러면 지금 그림이 남는다.
  art 를 "" 로 적으면 그림이 지워진다. 조심하라.
`;
}

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
  /** 인터넷 검색을 쓸 수 있는가 */
  web?: boolean;
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

${pageType.자유판 ? 현수막안내(style) : ""}
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
{"do":"시안","options":[{"name":"...","why":"...","pageTypeId":"...","content":{...},"style":{...}}]}
   — 디자인을 바꿔 달라고 할 때 쓴다. 바로 고치지 말고 시안을 2~3개 내놓아라.
     대표가 화면에서 나란히 보고 고른다. 고른 것만 페이지에 들어간다.
     "다시 디자인해줘", "세련되게", "색 빼고", "간결하게", "다르게 해봐" → 전부 이것이다.
     · name: 한눈에 구분되는 이름. "선 하나로 정리", "색 빼고 글자만", "사진을 크게"
     · why: 왜 이렇게 했는지 한 줄
     · pageTypeId: 틀을 바꿀 거면 넣는다. 그대로 두면 지금 틀을 쓴다.
       틀을 바꾸면 content 는 그 틀의 칸 이름에 맞춰야 한다.
     · content: 그 틀에 들어갈 내용. 지금 글을 그대로 옮기되 길이만 다듬어라.
       글을 지어내지 마라. 숫자는 절대 바꾸지 마라.
     · style: 이 한 장만의 규격. 예) {"type.pageTitle.size":20,"color.accent":"#2B2B2B"}
       색을 빼라고 하면 accent 를 ink 색과 같게 두면 된다.
     세 개는 서로 뚜렷이 달라야 한다. 비슷한 걸 세 개 내놓지 마라.
{"do":"전체시안","options":[{"name":"...","why":"...","style":{...},"slides":[...]}]}
   — 한 장이 아니라 제안서 한 벌을 두세 가지로 보여 줄 때.
     "전체를 두 가지로", "제안서 통째로 다시", "전부 다른 느낌으로" → 이것이다.
     대표가 화면에서 안마다 전체 장을 훑어보고 고른다. 고른 것만 들어간다.
     보관함에 새 제안서를 만들지 마라. 보던 제안서가 그 자리에서 바뀐다.
     · style: 제안서 전체 규격. 예) {"color.accent":"#2B2B2B","type.pageTitle.size":20}
     · slides: 구성까지 바꿀 때만 넣는다. 지금 ${totalSlides}장의 글과 숫자를
       그대로 옮겨 담아라. 빼거나 합칠 거면 왜 그랬는지 why 에 적어라.
       넣지 않으면 장은 그대로 두고 규격만 바뀐다 — 색만 빼 달라는 말에는 이게 맞다.
     · 글을 지어내지 마라. 숫자는 절대 바꾸지 마라.
     두세 가지는 서로 뚜렷이 달라야 한다.
{"do":"규칙제안","text":"...","scope":"스타일"}
   — 지시가 "앞으로도 이렇게"로 들릴 때만. 매번 제안하지 마라.
     scope: "공통"=어떤 문서든 / "스타일"=이 브랜드만 / "분류"=이 문서 종류만 / "제안서"=이 건만.
     어디까지 번져야 할지 애매하면 좁은 쪽을 고르라.

────────────────────────────────
어떻게 답할지

{"say":"대표에게 할 말 한두 문장","actions":[ ... ]}

- say 는 짧게. 세 줄을 넘기지 마라. 인사말·사과 없이 무엇을 했는지만.
  길게 설명하고 싶으면 그 말은 시안의 why 에 적어라. 대화창이 아니라 시안 옆에 붙는다.
  여러 가지를 말할 때는 줄을 나누고 "- " 로 시작하라. 글 덩어리로 쏟지 마라.
  "안 1", "참고", "확인해 주실 것" 은 줄 맨 앞에 두면 제목으로 보인다.
- 디자인을 바꿔 달라는 말에는 시안으로 답하라. 바로 고쳐 버리지 마라.
  한 장 얘기면 "시안", 제안서 한 벌 얘기면 "전체시안" 이다.
  "이 페이지", "이 장" → 시안 / "전체", "제안서 통째로", "전부" → 전체시안.
  시안은 화면에 그림으로 바로 보인다. "보여드릴 수 없다" 고 말하지 마라.
- 고칠 게 없거나 질문이면 actions 를 빈 배열로 두고 say 에만 답하라.
- 추측해서 숫자를 지어내지 마라. 모르면 그 칸은 "" 로 두고 say 에서 물어라.
- 위에 적힌 "반드시 지킬 원칙"을 어기는 요청이면, 그대로 하지 말고 왜 그런지 한 문장으로 말하고 대안을 제시하라.
- JSON 만 출력하라. 설명·코드펜스 금지.
${비신뢰원칙}${opts.web ? WEB_NOTE : ""}`;
}


/**
 * 보관함에서 하는 대화 — 아직 연 제안서가 없을 때.
 *
 * "인천관광공사 제안서 하나 만들어줘" 라고 하면 바로 만들어 준다.
 * 제안서를 열어야만 말을 걸 수 있으면 대화창이 아니다.
 */
export function librarySystem(opts: {
  brain: string;
  /** 인터넷 검색을 쓸 수 있는가 */
  web?: boolean;
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
{"do":"새인쇄물","title":"...","category":"...","가로cm":400,"세로cm":70,
 "content":{"art":"<svg …>","주제목":"...","부제목":"...","덧말":"...","자리":"가운데"}}
   — 현수막·배너·엑스배너를 만든다. 만든 것은 대화창에 그림으로 바로 보인다.
     "현수막 만들어줘", "세미나실에 걸 현수막", "배너 디자인해봐" → 전부 이것이다.
     말로 설명만 하지 마라. 그림을 그려서 내놓아라.
     안을 두세 가지 보여 줄 때는 "새인쇄물" 을 그만큼 넣고 제목 끝에 "(안 1)" 을 붙여라.

     · 가로cm · 세로cm: 대표가 말하지 않았으면 쓰임새로 정하라.
       실내 세미나실·강당 벽 300×70 / 건물 바깥·도로변 400×90 /
       무대 뒤 500×90 / 작은 안내 200×45 / 세워 두는 엑스배너 60×180.
       정한 치수를 say 에 한 줄로 알려라. 바꾸고 싶으시면 바꾸신다.
     · category: 위 분류 중 인쇄물에 맞는 것. 없으면 빼라.
     · art: 바탕 그림을 SVG 로 적는다. 아래 규칙을 지켜라.
     · 자리: 가운데 · 왼쪽 · 오른쪽 중 하나. 그림을 한쪽에 몰았으면 글은 반대쪽.

     [바탕 그림(SVG) 규칙 — 현수막은 원래 그림이다. 네가 그린다]
     1. viewBox 는 "0 0 (가로cm×4) (세로cm×4)". 300×70 이면 "0 0 1200 280".
        비율이 다르면 그림이 늘어진다.
     2. **그림 안에 글자를 넣지 마라.** <text> 금지.
        글자는 주제목·부제목·덧말 칸에 따로 적는다.
     3. 바깥 주소(http)·<image>·<script>·글꼴 불러오기 금지. 안 나온다.
     4. 쓸 것: rect, circle, ellipse, path, polygon, line,
        linearGradient, radialGradient, g, opacity.
     5. 글자가 앉을 가운데 띠는 어둡게(또는 밝게) 고르게 깔아라.
        맨 끝에 위아래로 투명해지는 그러데이션 한 겹을 덮으면 흰 글씨가 산다.
     6. 400~900자. 하늘→먼 산→들판처럼 층을 쌓으면 깊이가 생긴다.
        같은 색 3단(진한 것·중간·연한 것)을 겹치면 손으로 그린 맛이 난다.

{"do":"규칙제안","text":"...","scope":"공통"}
   — 대화 중 "앞으로도 이렇게" 가 나왔을 때만.

{"say":"대표에게 할 말","actions":[ ... ]}

- 대표가 "이 페이지", "현재 페이지", "이 장" 이라고 하면 보고 있는 한 장을 말하는 것이다.
  지금은 보관함이라 그 한 장이 무엇인지 알 수 없다. 제안서를 통째로 새로 만들지 마라.
  어느 제안서 몇 번째 장인지 한 줄로 되물어라.
- say 는 짧게. 세 줄을 넘기지 마라. 여러 가지는 줄을 나누고 "- " 로 시작하라.
- 묻는 말이면 actions 를 비우고 say 로만 답하라.
- 현수막·배너를 만들라고 하면 "새인쇄물" 로 그림까지 그려 내놓아라.
  "이렇게 만들면 됩니다" 하고 말로 설명하고 끝내지 마라 — 화면에 아무것도 안 나온다.
  장소나 주최가 빠졌으면 일단 만들어 보여 주고, 빠진 것은 say 에서 물어라.
- 제안서를 만들라고 하면 바로 만들어라. 다시 묻지 마라.
  다만 고객사·주제처럼 꼭 필요한 게 없으면 그것만 짧게 물어라.
- JSON 만 출력하라.
${비신뢰원칙}${opts.web ? WEB_NOTE : ""}`;
}