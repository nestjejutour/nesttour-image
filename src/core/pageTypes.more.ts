import type { PageType } from "./types";

/**
 * 페이지 타입 — 늘린 묶음
 *
 * 앞 파일과 똑같이 전부 "데이터"다. 좌표는 기준판 10 × 5.625 인치(16:9) 기준이고,
 * 판 크기를 바꾸면 해석기가 통째로 줄여 맞춘다.
 *
 * 본문 영역은 x 0.6 ~ 9.4 (폭 8.8), 제목 줄은 y 0.42, 내용은 y 1.5 부터 쓴다.
 */

const now = "2026-10-15";

/** 모든 본문 페이지가 같이 쓰는 제목 줄 */
const head = (hasSub = true) => [
  { type: "text" as const, bind: "title", x: 0.6, y: 0.42, w: 8.8, h: 0.55, token: "pageTitle", valign: "middle" as const, required: true },
  ...(hasSub
    ? [{ type: "text" as const, bind: "subtitle", x: 0.6, y: 0.98, w: 8.8, h: 0.3, token: "subtitle", valign: "middle" as const }]
    : []),
];

const headSlots = [
  { key: "title", label: "페이지 제목", kind: "text" as const, required: true },
  { key: "subtitle", label: "한 줄 설명", kind: "text" as const },
];

/** 카드 열 — 2·3·4열을 같은 공식으로 찍어 낸다 */
function cardRow(cols: 2 | 3 | 4): PageType {
  const gap = 0.13;
  const w = (8.8 - gap * (cols - 1)) / cols;
  const step = w + gap;
  const photoH = cols === 2 ? 2.3 : cols === 3 ? 1.95 : 1.9;
  const titleY = photoH + 0.25;
  return {
    id: `cards-${cols}`,
    name: `카드 ${cols}열 (사진)`,
    description: `위쪽 얇은 선 + 사진 + 제목 + 설명을 ${cols}칸으로. 강조 카드는 코랄 선.`,
    group: "본문",
    builtIn: true,
    createdAt: now,
    slots: [
      ...headSlots,
      {
        key: "cards", label: "카드", kind: "list", max: cols, required: true,
        itemSlots: [
          { key: "title", label: "카드 제목", kind: "text", required: true },
          { key: "desc", label: "설명", kind: "textarea" },
          { key: "photo", label: "사진", kind: "image" },
          { key: "accent", label: "코랄 선으로 강조", kind: "text", hint: "강조하려면 y 입력" },
        ],
      },
      { key: "note", label: "아래 한 줄 문장", kind: "text" },
    ],
    elements: [
      ...head(),
      {
        type: "repeat", over: "cards", origin: { x: 0.6, y: 1.5 }, step: { x: step }, max: cols,
        elements: [
          { type: "line", x: 0, y: 0, w, h: 0, color: "lineStrong", hideIf: "accent" },
          { type: "line", x: 0, y: 0, w, h: 0, color: "accent", weight: 1.5, showIf: "accent" },
          { type: "image", bind: "photo", x: 0.08, y: 0.1, w: w - 0.16, h: photoH, fit: "cover" },
          { type: "text", bind: "title", x: 0.12, y: titleY, w: w - 0.24, h: 0.34, token: "cardTitle", valign: "middle", required: true },
          { type: "text", bind: "desc", x: 0.12, y: titleY + 0.38, w: w - 0.24, h: 1.0, size: 10.5, color: "muted", valign: "top" },
        ],
      },
      { type: "text", bind: "note", x: 0.6, y: 4.6, w: 8.8, h: 0.42, size: 12.5, bold: true, align: "center", valign: "middle" },
    ],
    sample: {
      title: cols === 2 ? "두 갈래 제안" : cols === 3 ? "세 가지 축" : "네 가지 실행안",
      subtitle: "각 항목의 핵심만 한 줄로 적습니다.",
      cards: Array.from({ length: cols }, (_, i) => ({
        title: `항목 ${i + 1}`,
        desc: "한두 줄 설명",
        ...(i === 1 ? { accent: "y" } : {}),
      })),
    },
  };
}

export const MORE_PAGE_TYPES: PageType[] = [
  // ════════════════════════════════════ 표지
  {
    id: "cover-type",
    name: "표지 (글자 중심)",
    description: "사진 없이 제목만. 사진이 마땅치 않을 때 가장 단정하다.",
    group: "표지",
    showPageNo: false,
    builtIn: true,
    createdAt: now,
    slots: [
      { key: "recipient", label: "받는 곳", kind: "text", required: true, hint: "예: 인천관광공사 귀중" },
      { key: "title1", label: "제목 첫째 줄", kind: "text", required: true },
      { key: "title2", label: "제목 둘째 줄", kind: "text" },
      { key: "subtitle", label: "부제", kind: "text" },
      { key: "date", label: "날짜", kind: "text", hint: "예: 2026. 10" },
      { key: "logo", label: "로고", kind: "image" },
    ],
    elements: [
      { type: "text", bind: "recipient", x: 0.75, y: 0.9, w: 5.5, h: 0.3, token: "body", bold: true, valign: "middle", required: true },
      { type: "line", x: 0.75, y: 2.05, w: 0.5, h: 0, color: "accent", weight: 2 },
      { type: "text", bind: "title1", x: 0.75, y: 2.2, w: 8.5, h: 0.8, token: "coverTitleBold", valign: "middle", required: true },
      { type: "text", bind: "title2", x: 0.75, y: 2.98, w: 8.5, h: 0.7, token: "coverTitleThin", valign: "middle" },
      { type: "text", bind: "subtitle", x: 0.75, y: 3.8, w: 8.5, h: 0.35, size: 12.5, color: "muted", valign: "middle" },
      { type: "image", bind: "logo", x: 0.75, y: 4.274, w: 1.1, h: 0.426, fit: "contain" },
      { type: "line", x: 2.05, y: 4.426, w: 0, h: 0.24, color: "lineStrong" },
      { type: "text", bind: "date", x: 2.23, y: 4.396, w: 2.0, h: 0.3, token: "subtitle", valign: "middle" },
    ],
    sample: {
      recipient: "인천관광공사 귀중",
      title1: "인천시티투어",
      title2: "온라인 판로 확대 제안",
      subtitle: "핫플트립 판매처 입점 · 위탁판매",
      date: "2026. 10",
    },
  },


  {
    /**
     * 현수막 — AI 가 그림을 그려서 올리는 판.
     *
     * print-full 과 뭐가 다른가: 저쪽은 "이미 만들어진 파일" 을 담는 자리고,
     * 이쪽은 "아직 없는 디자인" 을 만드는 자리다.
     *
     * 글자를 그림(SVG) 안에 넣지 않고 칸으로 빼 둔 까닭:
     *  · 그림 안의 글자는 글꼴이 안 지켜진다 (<img> 는 바깥 글꼴을 못 불러온다)
     *  · 칸으로 빼 두면 직원이 글만 따로 고칠 수 있다
     *  · 글자 크기도 규격으로 조절된다
     *
     * 자리를 가운데로 모아 둔 까닭: 현수막은 400×70 처럼 납작해서
     * 16:9 로 잡은 자리가 위아래로 눌린다. 가운데 모여 있으면 눌려도 안 깨진다.
     */
    id: "banner-ai",
    name: "현수막 (디자인)",
    자유판: true,
    description: "AI 가 바탕 그림을 그리고 그 위에 글을 얹는다. 새로 만드는 현수막·배너·엑스배너.",
    group: "표지",
    showPageNo: false,
    builtIn: true,
    createdAt: now,
    slots: [
      { key: "art", label: "바탕 그림 (AI 가 그린다)", kind: "image" },
      { key: "주제목", label: "큰 글씨", kind: "text" },
      { key: "부제목", label: "작은 글씨", kind: "text" },
      { key: "덧말", label: "날짜 · 장소 · 주최 (없어도 됨)", kind: "text" },
    ],
    sample: {
      주제목: "제주 유채꽃 축제",
      부제목: "봄이 가장 먼저 닿는 곳",
      덧말: "2026. 3. 20 ~ 4. 12  ·  서귀포 가시리",
    },
    elements: [
      { type: "image", bind: "art", x: 0, y: 0, w: 10, h: 5.625, fit: "cover" },
      { type: "text", bind: "주제목", x: 0.6, y: 1.75, w: 8.8, h: 1.3,
        token: "coverTitleBold", color: "white", align: "center", valign: "middle" },
      { type: "text", bind: "부제목", x: 0.6, y: 3.05, w: 8.8, h: 0.75,
        token: "coverTitleThin", color: "white", align: "center", valign: "middle" },
      { type: "text", bind: "덧말", x: 0.6, y: 3.85, w: 8.8, h: 0.6,
        token: "body", color: "white", align: "center", valign: "middle" },
    ],
  },
  {
    /**
     * 인쇄물 한 장.
     *
     * 현수막처럼 "이미 다 만들어진 한 장" 을 담는 틀이다.
     * 판 전체를 그림 하나로 덮고, 그 위에 글자를 얹을 수 있다.
     * 판 크기는 건마다 다르므로(400×90cm 등) 자리는 reframe 이 늘려 준다.
     */
    id: "print-full",
    name: "인쇄물 (전면)",
    자유판: true,
    description: "판 전체를 그림 하나로 덮는다. 현수막·배너처럼 다 만들어진 한 장을 담을 때.",
    group: "표지",
    showPageNo: false,
    builtIn: true,
    createdAt: now,
    slots: [
      { key: "art", label: "바탕 그림", kind: "image" },
      { key: "head", label: "덧붙일 글 (없어도 됨)", kind: "text" },
    ],
    sample: { head: "" },
    elements: [
      { type: "image", bind: "art", x: 0, y: 0, w: 10, h: 5.625, fit: "cover" },
      { type: "text", bind: "head", x: 0.5, y: 0.5, w: 9, h: 0.8, token: "coverTitleBold", color: "white", valign: "middle" },
    ],
  },

  {
    id: "cover-full",
    name: "표지 (사진 전면)",
    description: "사진을 가득 깔고 어두운 막 위에 흰 글씨. 사진이 좋을 때 가장 강하다.",
    group: "표지",
    showPageNo: false,
    builtIn: true,
    createdAt: now,
    slots: [
      { key: "photo", label: "배경 사진", kind: "image", required: true },
      { key: "recipient", label: "받는 곳", kind: "text" },
      { key: "title1", label: "제목 첫째 줄", kind: "text", required: true },
      { key: "title2", label: "제목 둘째 줄", kind: "text" },
      { key: "date", label: "날짜", kind: "text" },
      { key: "logo", label: "로고 (밝은 로고)", kind: "image" },
    ],
    elements: [
      { type: "image", bind: "photo", x: 0, y: 0, w: 10, h: 5.625, fit: "cover" },
      { type: "scrim", x: 0, y: 0, w: 10, h: 5.625, color: "ink", alpha: 0.5 },
      { type: "image", bind: "logo", x: 0.8, y: 0.7, w: 1.1, h: 0.426, fit: "contain" },
      { type: "text", bind: "recipient", x: 0.8, y: 2.85, w: 8.4, h: 0.3, size: 12, color: "white", valign: "middle" },
      { type: "line", x: 0.8, y: 3.22, w: 0.5, h: 0, color: "accent", weight: 2 },
      { type: "text", bind: "title1", x: 0.8, y: 3.38, w: 8.4, h: 0.8, token: "coverTitleBold", color: "white", valign: "middle", required: true },
      { type: "text", bind: "title2", x: 0.8, y: 4.14, w: 8.4, h: 0.6, token: "coverTitleThin", color: "white", valign: "middle" },
      { type: "text", bind: "date", x: 0.8, y: 4.82, w: 4.0, h: 0.3, size: 12, color: "white", valign: "middle" },
    ],
    sample: {
      recipient: "인천관광공사 귀중",
      title1: "인천시티투어",
      title2: "온라인 판로 확대 제안",
      date: "2026. 10",
    },
  },

  {
    id: "index",
    name: "목차",
    description: "번호 + 항목 이름 + 한 줄 설명. 장수가 많을 때 앞에 배치합니다.",
    group: "표지",
    builtIn: true,
    createdAt: now,
    slots: [
      { key: "title", label: "페이지 제목", kind: "text", required: true },
      {
        key: "items", label: "항목", kind: "list", max: 5, required: true,
        itemSlots: [
          { key: "label", label: "항목 이름", kind: "text", required: true },
          { key: "desc", label: "한 줄 설명", kind: "text" },
        ],
      },
    ],
    elements: [
      ...head(false),
      {
        type: "repeat", over: "items", origin: { x: 0.6, y: 1.45 }, step: { y: 0.68 }, max: 5,
        elements: [
          { type: "text", bind: "$index2", x: 0, y: 0.04, w: 0.6, h: 0.34, size: 13, bold: true, color: "accent", valign: "middle" },
          { type: "text", bind: "label", x: 0.7, y: 0, w: 4.0, h: 0.36, token: "keyword", valign: "middle", required: true },
          { type: "text", bind: "desc", x: 4.8, y: 0.03, w: 4.6, h: 0.32, token: "caption", valign: "middle" },
          { type: "line", x: 0, y: 0.56, w: 8.8, h: 0, color: "line" },
        ],
      },
    ],
    sample: {
      title: "목차",
      items: [
        { label: "제안 요약", desc: "무엇을, 왜, 어떻게" },
        { label: "현황 진단", desc: "지금의 판매 구조" },
        { label: "실행 계획", desc: "채널·일정·역할" },
        { label: "기대 효과", desc: "숫자로 본 결과" },
        { label: "회사 소개", desc: "핫플트립이 하는 일" },
      ],
    },
  },

  // ════════════════════════════════════ 본문 — 글
  {
    id: "bullets",
    name: "글머리 목록",
    description: "항목마다 굵은 한 줄 + 설명 한 줄. 가장 읽기 쉬운 본문.",
    group: "본문",
    builtIn: true,
    createdAt: now,
    slots: [
      ...headSlots,
      {
        key: "items", label: "항목", kind: "list", max: 6, required: true,
        itemSlots: [
          { key: "label", label: "항목", kind: "text", required: true },
          { key: "desc", label: "설명", kind: "textarea" },
        ],
      },
    ],
    elements: [
      ...head(),
      {
        type: "repeat", over: "items", origin: { x: 0.6, y: 1.55 }, step: { y: 0.56 }, max: 6,
        elements: [
          { type: "line", x: 0, y: 0.17, w: 0.14, h: 0, color: "accent", weight: 1.5 },
          { type: "text", bind: "label", x: 0.3, y: 0, w: 8.4, h: 0.3, size: 13, bold: true, valign: "middle", required: true },
          { type: "text", bind: "desc", x: 0.3, y: 0.28, w: 8.4, h: 0.26, token: "caption", valign: "middle" },
        ],
      },
    ],
    sample: {
      title: "제안 범위",
      subtitle: "다음 네 가지를 맡아 수행합니다.",
      items: [
        { label: "온라인 판매처 입점", desc: "주요 OTA·플랫폼 입점과 상품 등록" },
        { label: "상품 구성", desc: "타깃별 상품 설계와 가격 설정" },
        { label: "운영 대행", desc: "예약·정산·고객 응대" },
        { label: "성과 보고", desc: "월 단위 판매 실적 보고" },
      ],
    },
  },

  {
    id: "text-two-col",
    name: "글 두 단",
    description: "가운데 선을 두고 글을 좌우 두 단으로. 설명이 길 때.",
    group: "본문",
    builtIn: true,
    createdAt: now,
    slots: [
      ...headSlots,
      { key: "leftTitle", label: "왼쪽 소제목", kind: "text", required: true },
      { key: "leftBody", label: "왼쪽 글", kind: "textarea", required: true },
      { key: "rightTitle", label: "오른쪽 소제목", kind: "text", required: true },
      { key: "rightBody", label: "오른쪽 글", kind: "textarea", required: true },
    ],
    elements: [
      ...head(),
      { type: "line", x: 0.6, y: 1.5, w: 4.1, h: 0, color: "lineStrong" },
      { type: "text", bind: "leftTitle", x: 0.6, y: 1.62, w: 4.1, h: 0.36, token: "keyword", valign: "middle", required: true },
      { type: "text", bind: "leftBody", x: 0.6, y: 2.06, w: 4.1, h: 2.7, token: "body", valign: "top", required: true },
      { type: "line", x: 4.95, y: 1.5, w: 0, h: 3.3, color: "line" },
      { type: "line", x: 5.3, y: 1.5, w: 4.1, h: 0, color: "accent", weight: 1.5 },
      { type: "text", bind: "rightTitle", x: 5.3, y: 1.62, w: 4.1, h: 0.36, token: "keyword", valign: "middle", required: true },
      { type: "text", bind: "rightBody", x: 5.3, y: 2.06, w: 4.1, h: 2.7, token: "body", valign: "top", required: true },
    ],
    sample: {
      title: "현황과 과제",
      subtitle: "지금 무엇이 문제이고, 무엇을 바꿔야 하는지 정리했습니다.",
      leftTitle: "지금의 모습",
      leftBody: "판매가 현장 창구에 몰려 있어\n온라인에서 찾기 어렵습니다.\n\n재방문 고객 자료가 쌓이지 않습니다.",
      rightTitle: "바꿀 방향",
      rightBody: "주요 온라인 판매처에 입점해\n검색되는 상품으로 만듭니다.\n\n예약 자료를 한곳에 모읍니다.",
    },
  },

  {
    id: "quote",
    name: "한 문장 강조",
    description: "하고 싶은 말 한 문장만 크게. 장과 장 사이에서 숨을 돌린다.",
    group: "본문",
    builtIn: true,
    createdAt: now,
    slots: [
      { key: "quote", label: "한 문장", kind: "textarea", required: true },
      { key: "source", label: "출처 · 덧붙임", kind: "text" },
    ],
    elements: [
      { type: "line", x: 0.9, y: 1.9, w: 0.7, h: 0, color: "accent", weight: 2.5 },
      { type: "text", bind: "quote", x: 0.9, y: 2.15, w: 8.2, h: 1.7, size: 28, bold: true, valign: "top", lineSpacingMul: 1.3, required: true },
      { type: "text", bind: "source", x: 0.9, y: 4.05, w: 8.2, h: 0.32, token: "caption", valign: "middle" },
    ],
    sample: {
      quote: "찾아오게 만드는 것보다\n찾아지게 만드는 편이 빠릅니다.",
      source: "온라인 판로 확대의 기본 생각",
    },
  },

  // ════════════════════════════════════ 본문 — 사진
  {
    id: "photo-left",
    name: "사진 왼쪽 + 글",
    description: "왼쪽에 큰 사진, 오른쪽에 설명. 상품 한 가지를 보여줄 때.",
    group: "본문",
    builtIn: true,
    createdAt: now,
    slots: [
      ...headSlots,
      { key: "photo", label: "사진", kind: "image", required: true },
      { key: "heading", label: "소제목", kind: "text", required: true },
      { key: "body", label: "설명", kind: "textarea", required: true },
      { key: "note", label: "아래 한 줄", kind: "text" },
    ],
    elements: [
      ...head(),
      { type: "image", bind: "photo", x: 0.6, y: 1.5, w: 4.3, h: 3.3, fit: "cover" },
      { type: "line", x: 5.25, y: 1.5, w: 4.15, h: 0, color: "accent", weight: 1.5 },
      { type: "text", bind: "heading", x: 5.25, y: 1.64, w: 4.15, h: 0.4, token: "keyword", valign: "middle", required: true },
      { type: "text", bind: "body", x: 5.25, y: 2.12, w: 4.15, h: 2.1, token: "body", valign: "top", required: true },
      { type: "text", bind: "note", x: 5.25, y: 4.35, w: 4.15, h: 0.45, token: "caption", valign: "top" },
    ],
    sample: {
      title: "국내핫플 버스",
      subtitle: "20~40대를 겨냥한 주요 관광 거점 순환 상품입니다.",
      heading: "하루 한 바퀴, 핵심만",
      body: "주요 거점 여덟 곳을 한 바퀴 도는 구성입니다.\n내리고 타기가 자유로워 일정이 느슨한 여행객에게 맞습니다.",
      note: "운행 간격 30분 · 1일권 기준",
    },
  },

  {
    id: "photo-right",
    name: "사진 오른쪽 + 글",
    description: "왼쪽에 설명, 오른쪽에 큰 사진. 앞 장과 좌우를 바꿔 가며 쓴다.",
    group: "본문",
    builtIn: true,
    createdAt: now,
    slots: [
      ...headSlots,
      { key: "photo", label: "사진", kind: "image", required: true },
      { key: "heading", label: "소제목", kind: "text", required: true },
      { key: "body", label: "설명", kind: "textarea", required: true },
      { key: "note", label: "아래 한 줄", kind: "text" },
    ],
    elements: [
      ...head(),
      { type: "line", x: 0.6, y: 1.5, w: 4.15, h: 0, color: "accent", weight: 1.5 },
      { type: "text", bind: "heading", x: 0.6, y: 1.64, w: 4.15, h: 0.4, token: "keyword", valign: "middle", required: true },
      { type: "text", bind: "body", x: 0.6, y: 2.12, w: 4.15, h: 2.1, token: "body", valign: "top", required: true },
      { type: "text", bind: "note", x: 0.6, y: 4.35, w: 4.15, h: 0.45, token: "caption", valign: "top" },
      { type: "image", bind: "photo", x: 5.1, y: 1.5, w: 4.3, h: 3.3, fit: "cover" },
    ],
    sample: {
      title: "시티투어 버스",
      subtitle: "도시의 주요 명소를 편하게 잇는 기본 상품입니다.",
      heading: "처음 온 사람에게",
      body: "노선이 단순해 길을 몰라도 탈 수 있습니다.\n단체 예약과 개별 예약을 함께 받습니다.",
      note: "하루 12회 운행",
    },
  },

  {
    id: "photo-strip",
    name: "사진 띠 (3장)",
    description: "가로로 이어 붙인 사진 석 장과 짧은 설명. 분위기를 보여줄 때.",
    group: "본문",
    builtIn: true,
    createdAt: now,
    slots: [
      ...headSlots,
      {
        key: "shots", label: "사진", kind: "list", max: 3, required: true,
        itemSlots: [
          { key: "photo", label: "사진", kind: "image", required: true },
          { key: "caption", label: "설명", kind: "text" },
        ],
      },
      { key: "note", label: "아래 한 줄 문장", kind: "text" },
    ],
    elements: [
      ...head(),
      {
        type: "repeat", over: "shots", origin: { x: 0.6, y: 1.5 }, step: { x: 2.98 }, max: 3,
        elements: [
          { type: "image", bind: "photo", x: 0, y: 0, w: 2.84, h: 2.6, fit: "cover", placeholder: true },
          { type: "text", bind: "caption", x: 0, y: 2.7, w: 2.84, h: 0.6, token: "caption", valign: "top" },
        ],
      },
      { type: "text", bind: "note", x: 0.6, y: 4.6, w: 8.8, h: 0.42, size: 12.5, bold: true, align: "center", valign: "middle" },
    ],
    sample: {
      title: "현장의 모습",
      subtitle: "운행 중인 차량과 승하차 지점입니다.",
      shots: [
        { caption: "2층 오픈탑 차량" },
        { caption: "주요 승차 지점" },
        { caption: "안내 표지" },
      ],
    },
  },

  {
    id: "screens",
    name: "화면 예시",
    description: "앱·웹 화면 석 장과 캡션. 온라인 판매처 입점 결과를 보여줄 때.",
    group: "본문",
    builtIn: true,
    createdAt: now,
    slots: [
      ...headSlots,
      {
        key: "shots", label: "화면", kind: "list", max: 3, required: true,
        itemSlots: [
          { key: "photo", label: "화면 그림", kind: "image", required: true },
          { key: "label", label: "이름", kind: "text", required: true },
          { key: "caption", label: "설명", kind: "text" },
        ],
      },
    ],
    elements: [
      ...head(),
      {
        type: "repeat", over: "shots", origin: { x: 0.75, y: 1.5 }, step: { x: 2.95 }, max: 3,
        elements: [
          { type: "rect", x: 0, y: 0, w: 2.7, h: 2.5, fill: "#F6F6F6" },
          { type: "image", bind: "photo", x: 0.12, y: 0.12, w: 2.46, h: 2.26, fit: "contain", placeholder: true },
          { type: "text", bind: "label", x: 0, y: 2.62, w: 2.7, h: 0.32, token: "cardTitle", align: "center", valign: "middle", required: true },
          { type: "text", bind: "caption", x: 0, y: 2.96, w: 2.7, h: 0.6, token: "caption", align: "center", valign: "top" },
        ],
      },
    ],
    sample: {
      title: "입점 화면",
      subtitle: "실제로 고객에게 보이는 상품 화면입니다.",
      shots: [
        { label: "핫플트립", caption: "상품 상세" },
        { label: "제휴 플랫폼", caption: "검색 결과" },
        { label: "예약 화면", caption: "날짜 선택" },
      ],
    },
  },

  // ════════════════════════════════════ 본문 — 정리
  cardRow(2),
  cardRow(3),
  cardRow(4),

  {
    id: "grid-2x2",
    name: "네 칸 격자",
    description: "두 줄 두 칸으로 네 가지를 나란히. 사진 없이 글만.",
    group: "본문",
    builtIn: true,
    createdAt: now,
    slots: [
      ...headSlots,
      {
        key: "cells", label: "칸", kind: "list", max: 4, required: true,
        itemSlots: [
          { key: "title", label: "칸 제목", kind: "text", required: true },
          { key: "desc", label: "설명", kind: "textarea" },
          { key: "accent", label: "코랄 선으로 강조", kind: "text", hint: "강조하려면 y 입력" },
        ],
      },
    ],
    elements: [
      ...head(),
      {
        type: "repeat", over: "cells", origin: { x: 0.6, y: 1.55 },
        step: { x: 4.5 }, perRow: 2, rowStep: { y: 1.72 }, max: 4,
        elements: [
          { type: "line", x: 0, y: 0, w: 4.3, h: 0, color: "lineStrong", hideIf: "accent" },
          { type: "line", x: 0, y: 0, w: 4.3, h: 0, color: "accent", weight: 1.5, showIf: "accent" },
          { type: "text", bind: "$index2", x: 0, y: 0.14, w: 0.45, h: 0.26, token: "cardNo", valign: "middle" },
          { type: "text", bind: "title", x: 0.5, y: 0.12, w: 3.8, h: 0.32, token: "cardTitle", valign: "middle", required: true },
          { type: "text", bind: "desc", x: 0.5, y: 0.5, w: 3.8, h: 1.0, size: 10.5, color: "muted", valign: "top" },
        ],
      },
    ],
    sample: {
      title: "네 가지 실행안",
      subtitle: "동시에 진행하되 순서를 두고 움직입니다.",
      cells: [
        { title: "입점", desc: "주요 판매처 등록" },
        { title: "상품화", desc: "타깃별 구성", accent: "y" },
        { title: "운영", desc: "예약·정산 대행" },
        { title: "보고", desc: "월 단위 실적" },
      ],
    },
  },

  {
    id: "table-rows",
    name: "표로 정리",
    description: "항목 · 내용 · 비고 세 칸짜리 표. 조건을 또박또박 적을 때.",
    group: "본문",
    builtIn: true,
    createdAt: now,
    slots: [
      ...headSlots,
      { key: "col1", label: "첫째 칸 이름", kind: "text", hint: "예: 항목" },
      { key: "col2", label: "둘째 칸 이름", kind: "text", hint: "예: 내용" },
      { key: "col3", label: "셋째 칸 이름", kind: "text", hint: "예: 비고" },
      {
        key: "rows", label: "줄", kind: "list", max: 6, required: true,
        itemSlots: [
          { key: "label", label: "항목", kind: "text", required: true },
          { key: "v1", label: "내용", kind: "text" },
          { key: "v2", label: "비고", kind: "text" },
        ],
      },
    ],
    elements: [
      ...head(),
      { type: "text", bind: "col1", x: 0.6, y: 1.5, w: 2.6, h: 0.3, token: "caption", valign: "middle" },
      { type: "text", bind: "col2", x: 3.3, y: 1.5, w: 3.0, h: 0.3, token: "caption", valign: "middle" },
      { type: "text", bind: "col3", x: 6.4, y: 1.5, w: 3.0, h: 0.3, token: "caption", valign: "middle" },
      { type: "line", x: 0.6, y: 1.84, w: 8.8, h: 0, color: "ink", weight: 1.2 },
      {
        type: "repeat", over: "rows", origin: { x: 0.6, y: 1.94 }, step: { y: 0.5 }, max: 6,
        elements: [
          { type: "text", bind: "label", x: 0, y: 0.05, w: 2.6, h: 0.34, token: "rowLabel", valign: "middle", required: true },
          { type: "text", bind: "v1", x: 2.7, y: 0.05, w: 3.0, h: 0.34, token: "body", valign: "middle" },
          { type: "text", bind: "v2", x: 5.8, y: 0.05, w: 3.6, h: 0.34, token: "body", valign: "middle" },
          { type: "line", x: 0, y: 0.45, w: 8.8, h: 0, color: "line" },
        ],
      },
    ],
    sample: {
      title: "운영 조건",
      subtitle: "계약 전 확인이 필요한 항목입니다.",
      col1: "항목", col2: "내용", col3: "비고",
      rows: [
        { label: "계약 기간", v1: "2026. 03 ~ 2026. 12", v2: "10개월" },
        { label: "정산 주기", v1: "월 1회", v2: "익월 10일" },
        { label: "수수료", v1: "판매가의 12%", v2: "부가세 별도" },
        { label: "취소 규정", v1: "출발 1일 전까지 무료", v2: "당일 50%" },
      ],
    },
  },

  {
    id: "compare-2",
    name: "비교 두 칸",
    description: "지금과 바뀐 뒤, 또는 우리와 다른 곳을 나란히 놓고 비교한다.",
    group: "본문",
    builtIn: true,
    createdAt: now,
    slots: [
      ...headSlots,
      { key: "leftLabel", label: "왼쪽 이름", kind: "text", required: true, hint: "예: 지금" },
      {
        key: "leftItems", label: "왼쪽 항목", kind: "list", max: 5, required: true,
        itemSlots: [{ key: "text", label: "한 줄", kind: "text", required: true }],
      },
      { key: "rightLabel", label: "오른쪽 이름", kind: "text", required: true, hint: "예: 제안 이후" },
      {
        key: "rightItems", label: "오른쪽 항목", kind: "list", max: 5, required: true,
        itemSlots: [{ key: "text", label: "한 줄", kind: "text", required: true }],
      },
    ],
    elements: [
      ...head(),
      { type: "text", bind: "leftLabel", x: 0.6, y: 1.5, w: 4.2, h: 0.36, token: "keyword", color: "muted", valign: "middle", required: true },
      { type: "line", x: 0.6, y: 1.94, w: 4.2, h: 0, color: "lineStrong" },
      {
        type: "repeat", over: "leftItems", origin: { x: 0.6, y: 2.1 }, step: { y: 0.52 }, max: 5,
        elements: [
          { type: "text", bind: "text", x: 0, y: 0, w: 4.2, h: 0.4, token: "body", color: "muted", valign: "middle", prefix: "· ", required: true },
        ],
      },
      { type: "text", bind: "rightLabel", x: 5.2, y: 1.5, w: 4.2, h: 0.36, token: "keyword", valign: "middle", required: true },
      { type: "line", x: 5.2, y: 1.94, w: 4.2, h: 0, color: "accent", weight: 1.8 },
      {
        type: "repeat", over: "rightItems", origin: { x: 5.2, y: 2.1 }, step: { y: 0.52 }, max: 5,
        elements: [
          { type: "text", bind: "text", x: 0, y: 0, w: 4.2, h: 0.4, token: "body", valign: "middle", prefix: "· ", required: true },
        ],
      },
    ],
    sample: {
      title: "제안 전후 비교",
      subtitle: "판매 구조가 어떻게 달라지는지 정리했습니다.",
      leftLabel: "지금",
      leftItems: [
        { text: "현장 창구 판매 위주" },
        { text: "온라인 노출이 거의 없음" },
        { text: "고객 자료가 남지 않음" },
      ],
      rightLabel: "제안 이후",
      rightItems: [
        { text: "주요 판매처에 상시 노출" },
        { text: "예약·정산 한곳에서 처리" },
        { text: "월 단위 실적 보고" },
      ],
    },
  },

  {
    id: "kpi-4",
    name: "숫자 네 개",
    description: "핵심 숫자 네 가지를 한 줄로. 성과나 규모를 보여줄 때.",
    group: "본문",
    builtIn: true,
    createdAt: now,
    slots: [
      ...headSlots,
      {
        key: "items", label: "숫자", kind: "list", max: 4, required: true,
        itemSlots: [
          { key: "value", label: "숫자", kind: "text", required: true, hint: "예: 1,200" },
          { key: "unit", label: "단위", kind: "text", hint: "예: 명" },
          { key: "label", label: "이름", kind: "text", required: true },
          { key: "desc", label: "설명", kind: "textarea" },
        ],
      },
      { key: "note", label: "아래 한 줄 문장", kind: "text" },
    ],
    elements: [
      ...head(),
      {
        type: "repeat", over: "items", origin: { x: 0.6, y: 1.75 }, step: { x: 2.23 }, max: 4,
        elements: [
          { type: "line", x: 0, y: 0, w: 2.1, h: 0, color: "lineStrong" },
          { type: "text", bind: "value", x: 0, y: 0.22, w: 1.5, h: 0.7, token: "keyNumber", valign: "middle", required: true },
          { type: "text", bind: "unit", x: 1.5, y: 0.5, w: 0.6, h: 0.4, token: "caption", valign: "middle" },
          { type: "text", bind: "label", x: 0, y: 1.0, w: 2.1, h: 0.32, token: "cardTitle", valign: "middle", required: true },
          { type: "text", bind: "desc", x: 0, y: 1.38, w: 2.1, h: 1.0, size: 10, color: "muted", valign: "top" },
        ],
      },
      { type: "text", bind: "note", x: 0.6, y: 4.6, w: 8.8, h: 0.42, size: 12.5, bold: true, align: "center", valign: "middle" },
    ],
    sample: {
      title: "숫자로 본 규모",
      subtitle: "지난해 기준 실적입니다.",
      items: [
        { value: "12", unit: "개", label: "운영 노선", desc: "수도권·강원" },
        { value: "48,000", unit: "명", label: "연 탑승객", desc: "2025년 누계" },
        { value: "32", unit: "곳", label: "제휴 판매처", desc: "국내·해외" },
        { value: "4.6", unit: "점", label: "평균 만족도", desc: "5점 만점" },
      ],
      note: "숫자는 2025년 12월 기준입니다.",
    },
  },

  {
    id: "timeline",
    name: "일정표",
    description: "단계마다 기간과 할 일을 가로로. 수행 일정을 보여줄 때.",
    group: "본문",
    builtIn: true,
    createdAt: now,
    slots: [
      ...headSlots,
      {
        key: "steps", label: "단계", kind: "list", max: 4, required: true,
        itemSlots: [
          { key: "phase", label: "단계 이름", kind: "text", required: true, hint: "예: 1단계 준비" },
          { key: "period", label: "기간", kind: "text", hint: "예: 2026. 03 ~ 04" },
          { key: "desc", label: "할 일", kind: "textarea" },
          { key: "accent", label: "코랄로 강조", kind: "text", hint: "강조하려면 y 입력" },
        ],
      },
    ],
    elements: [
      ...head(),
      {
        type: "repeat", over: "steps", origin: { x: 0.6, y: 1.6 }, step: { x: 2.23 }, max: 4,
        elements: [
          { type: "text", bind: "phase", x: 0, y: 0, w: 2.1, h: 0.34, token: "cardTitle", valign: "middle", required: true },
          { type: "text", bind: "period", x: 0, y: 0.36, w: 2.1, h: 0.28, token: "caption", valign: "middle" },
          { type: "line", x: 0, y: 0.8, w: 2.1, h: 0, color: "lineStrong", hideIf: "accent" },
          { type: "line", x: 0, y: 0.8, w: 2.1, h: 0, color: "accent", weight: 2, showIf: "accent" },
          { type: "text", bind: "desc", x: 0, y: 0.95, w: 2.1, h: 1.9, size: 10.5, color: "muted", valign: "top" },
        ],
      },
    ],
    sample: {
      title: "수행 일정",
      subtitle: "계약 후 10개월 동안의 진행 계획입니다.",
      steps: [
        { phase: "1단계 준비", period: "2026. 03 ~ 04", desc: "상품 구성\n판매처 협의\n자료 제작" },
        { phase: "2단계 입점", period: "2026. 05 ~ 06", desc: "판매처 등록\n가격 확정\n시범 판매", accent: "y" },
        { phase: "3단계 운영", period: "2026. 07 ~ 11", desc: "예약 운영\n고객 응대\n월 정산" },
        { phase: "4단계 정리", period: "2026. 12", desc: "실적 보고\n개선안 제출" },
      ],
    },
  },

  {
    id: "org",
    name: "조직도",
    description: "총괄 아래에 팀을 나란히. 수행 인력을 보여줄 때.",
    group: "본문",
    builtIn: true,
    createdAt: now,
    slots: [
      ...headSlots,
      { key: "head", label: "총괄", kind: "text", required: true, hint: "예: 총괄 PM 정세종" },
      {
        key: "teams", label: "팀", kind: "list", max: 4, required: true,
        itemSlots: [
          { key: "name", label: "팀 이름", kind: "text", required: true },
          { key: "role", label: "하는 일", kind: "textarea" },
        ],
      },
    ],
    elements: [
      ...head(),
      { type: "rect", x: 3.8, y: 1.55, w: 2.4, h: 0.62, stroke: "lineStrong" },
      { type: "text", bind: "head", x: 3.85, y: 1.55, w: 2.3, h: 0.62, token: "rowLabel", align: "center", valign: "middle", required: true },
      { type: "line", x: 5.0, y: 2.17, w: 0, h: 0.36, color: "lineStrong" },
      { type: "line", x: 1.65, y: 2.53, w: 6.7, h: 0, color: "lineStrong" },
      {
        type: "repeat", over: "teams", origin: { x: 0.6, y: 2.53 }, step: { x: 2.23 }, max: 4,
        elements: [
          { type: "line", x: 1.05, y: 0, w: 0, h: 0.3, color: "lineStrong" },
          { type: "rect", x: 0, y: 0.3, w: 2.1, h: 1.05, stroke: "lineStrong" },
          { type: "text", bind: "name", x: 0.1, y: 0.4, w: 1.9, h: 0.3, token: "cardTitle", align: "center", valign: "middle", required: true },
          { type: "text", bind: "role", x: 0.1, y: 0.72, w: 1.9, h: 0.56, size: 10, color: "muted", align: "center", valign: "top" },
        ],
      },
    ],
    sample: {
      title: "수행 조직",
      subtitle: "전담 인력을 두고 운영합니다.",
      head: "총괄 PM",
      teams: [
        { name: "상품팀", role: "구성 · 가격" },
        { name: "제휴팀", role: "판매처 입점" },
        { name: "운영팀", role: "예약 · 응대" },
        { name: "정산팀", role: "정산 · 보고" },
      ],
    },
  },

  {
    id: "logo-wall",
    name: "로고 모음",
    description: "고객사·제휴처 로고를 격자로. 실적을 한눈에 보여줄 때.",
    group: "본문",
    builtIn: true,
    createdAt: now,
    slots: [
      ...headSlots,
      {
        key: "logos", label: "로고", kind: "list", max: 8, required: true,
        itemSlots: [
          { key: "logo", label: "로고 그림", kind: "image" },
          { key: "name", label: "이름", kind: "text", required: true },
        ],
      },
    ],
    elements: [
      ...head(),
      {
        type: "repeat", over: "logos", origin: { x: 0.6, y: 1.6 },
        step: { x: 2.23 }, perRow: 4, rowStep: { y: 1.5 }, max: 8,
        elements: [
          { type: "rect", x: 0, y: 0, w: 2.1, h: 1.0, stroke: "line" },
          { type: "image", bind: "logo", x: 0.25, y: 0.15, w: 1.6, h: 0.7, fit: "contain" },
          { type: "text", bind: "name", x: 0, y: 1.08, w: 2.1, h: 0.26, token: "caption", align: "center", valign: "middle", required: true },
        ],
      },
    ],
    sample: {
      title: "함께 일한 곳",
      subtitle: "공공기관과 민간 플랫폼 양쪽에서 수행했습니다.",
      logos: [
        { name: "인천관광공사" }, { name: "한국관광공사" },
        { name: "서울시" }, { name: "강원관광재단" },
        { name: "제휴 플랫폼 A" }, { name: "제휴 플랫폼 B" },
        { name: "여행사 C" }, { name: "여행사 D" },
      ],
    },
  },

  {
    id: "price",
    name: "비용 표",
    description: "항목 · 수량 · 금액과 합계. 견적을 낼 때.",
    group: "본문",
    builtIn: true,
    createdAt: now,
    slots: [
      ...headSlots,
      {
        key: "rows", label: "비용 줄", kind: "list", max: 5, required: true,
        itemSlots: [
          { key: "item", label: "항목", kind: "text", required: true },
          { key: "qty", label: "수량 · 기간", kind: "text" },
          { key: "amount", label: "금액", kind: "text", required: true },
        ],
      },
      { key: "totalLabel", label: "합계 이름", kind: "text", hint: "예: 합계 (부가세 별도)" },
      { key: "total", label: "합계 금액", kind: "text", required: true },
      { key: "note", label: "아래 단서", kind: "text" },
    ],
    elements: [
      ...head(),
      { type: "line", x: 0.6, y: 1.5, w: 8.8, h: 0, color: "ink", weight: 1.2 },
      {
        type: "repeat", over: "rows", origin: { x: 0.6, y: 1.6 }, step: { y: 0.54 }, max: 5,
        elements: [
          { type: "text", bind: "item", x: 0, y: 0.05, w: 4.6, h: 0.34, token: "rowLabel", valign: "middle", required: true },
          { type: "text", bind: "qty", x: 4.7, y: 0.05, w: 1.6, h: 0.34, token: "caption", align: "right", valign: "middle" },
          { type: "text", bind: "amount", x: 6.4, y: 0.05, w: 2.4, h: 0.34, token: "body", align: "right", valign: "middle", required: true },
          { type: "line", x: 0, y: 0.48, w: 8.8, h: 0, color: "line" },
        ],
      },
      { type: "line", x: 0.6, y: 4.38, w: 8.8, h: 0, color: "ink", weight: 1.2 },
      { type: "text", bind: "totalLabel", x: 0.6, y: 4.48, w: 4.6, h: 0.4, token: "rowLabel", valign: "middle" },
      { type: "text", bind: "total", x: 6.0, y: 4.44, w: 2.8, h: 0.46, size: 18, bold: true, align: "right", valign: "middle", required: true },
      { type: "text", bind: "note", x: 0.6, y: 4.96, w: 8.8, h: 0.28, token: "caption", valign: "middle" },
    ],
    sample: {
      title: "소요 비용",
      subtitle: "제안 범위 전체를 수행하는 기준입니다.",
      rows: [
        { item: "상품 구성 · 자료 제작", qty: "1식", amount: "12,000,000원" },
        { item: "판매처 입점 대행", qty: "8곳", amount: "16,000,000원" },
        { item: "운영 대행", qty: "10개월", amount: "30,000,000원" },
        { item: "성과 보고", qty: "10회", amount: "5,000,000원" },
      ],
      totalLabel: "합계 (부가세 별도)",
      total: "63,000,000원",
      note: "별도 협의 항목은 포함하지 않았습니다.",
    },
  },

  // ════════════════════════════════════ 마무리
  {
    id: "contact",
    name: "담당자 연락처",
    description: "맨 끝 장. 누구에게 연락하면 되는지 또렷하게.",
    group: "마무리",
    builtIn: true,
    createdAt: now,
    slots: [
      { key: "title", label: "페이지 제목", kind: "text", required: true },
      { key: "subtitle", label: "한 줄 설명", kind: "text" },
      {
        key: "people", label: "담당자", kind: "list", max: 3, required: true,
        itemSlots: [
          { key: "name", label: "이름", kind: "text", required: true },
          { key: "role", label: "직함 · 담당", kind: "text" },
          { key: "phone", label: "전화", kind: "text" },
          { key: "mail", label: "메일", kind: "text" },
        ],
      },
      { key: "company", label: "회사 한 줄", kind: "text" },
      { key: "logo", label: "로고", kind: "image" },
    ],
    elements: [
      ...head(),
      {
        type: "repeat", over: "people", origin: { x: 0.6, y: 1.75 }, step: { x: 2.98 }, max: 3,
        elements: [
          { type: "line", x: 0, y: 0, w: 2.84, h: 0, color: "lineStrong" },
          { type: "text", bind: "name", x: 0, y: 0.18, w: 2.84, h: 0.36, token: "keyword", valign: "middle", required: true },
          { type: "text", bind: "role", x: 0, y: 0.56, w: 2.84, h: 0.28, token: "caption", valign: "middle" },
          { type: "text", bind: "phone", x: 0, y: 0.95, w: 2.84, h: 0.3, token: "body", valign: "middle" },
          { type: "text", bind: "mail", x: 0, y: 1.27, w: 2.84, h: 0.3, token: "body", valign: "middle" },
        ],
      },
      { type: "line", x: 0.6, y: 4.2, w: 8.8, h: 0, color: "line" },
      { type: "image", bind: "logo", x: 0.6, y: 4.42, w: 1.1, h: 0.426, fit: "contain" },
      { type: "text", bind: "company", x: 1.9, y: 4.42, w: 7.5, h: 0.43, token: "caption", valign: "middle" },
    ],
    sample: {
      title: "연락처",
      subtitle: "궁금한 점은 아래로 연락 주시기 바랍니다.",
      people: [
        { name: "정세종", role: "대표이사", phone: "010-0000-0000", mail: "nestjeju@gmail.com" },
        { name: "담당자", role: "운영 총괄", phone: "010-0000-0000", mail: "" },
      ],
      company: "핫플트립 · 네스트투어",
    },
  },
];
