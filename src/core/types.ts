// ============================================================
//  공장의 자료 구조
//
//  핵심 생각: 페이지 모양은 "코드"가 아니라 "데이터"다.
//  그래서 새 페이지 타입이 늘어나도 코드를 고칠 필요가 없다.
// ============================================================

// ---------- 창고 1 : 스타일 ----------

/** 글자 규격 한 덩어리. 색은 색 이름(ink/muted/accent)으로 가리킨다. */
export interface TypeToken {
  size: number;
  bold?: boolean;
  color?: string;
  lineSpacingMul?: number;
  charSpacing?: number;
}

/** 스타일을 부분만 덮어쓰기. 이 제안서에만 쓰는 값 */
export interface StyleOverride {
  color?: Record<string, string>;
  type?: Record<string, Partial<TypeToken>>;
  slide?: Partial<StylePreset["slide"]>;
  hairline?: number;
}

export interface StylePreset {
  id: string;
  name: string;
  brand: string;
  version: number;
  slide: { widthIn: number; heightIn: number; marginIn: number };
  font: { family: string; fallback: string[] };
  /** ink, muted, line, background, accent, todo ... */
  color: Record<string, string>;
  /** pageTitle, subtitle, body, caption, keyNumber ... */
  type: Record<string, TypeToken>;
  /** 페이지 번호는 브랜드 규칙이라 스타일이 들고 있다. */
  pageNo: { x: number; y: number; w: number; h: number; size: number; color: string };
  /** 얇은 선의 기본 두께(pt) */
  hairline: number;
  logo?: string;
  updatedAt: string;
}

// ---------- 창고 2 : 페이지 타입(레이아웃) ----------

/** 사람이 채워 넣는 칸의 정의. 편집기 오른쪽 입력폼이 이걸 보고 만들어진다. */
export interface Slot {
  key: string;
  label: string;
  kind: "text" | "textarea" | "image" | "list";
  required?: boolean;
  hint?: string;
  /** kind === "list" 일 때 각 항목이 가지는 칸들 */
  itemSlots?: Slot[];
  max?: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Visibility = {
  /** 이 내용 칸이 채워져 있을 때만 그린다 */
  showIf?: string;
  /** 이 내용 칸이 채워져 있으면 그리지 않는다 */
  hideIf?: string;
};

export interface TextEl extends Box, Visibility {
  type: "text";
  /** 내용에서 가져올 칸 이름. $index / $index2 / $count 는 특수값 */
  bind?: string;
  /** 고정 문구 */
  literal?: string;
  /** 스타일의 글자 규격 이름 */
  token?: string;
  color?: string;
  size?: number;
  bold?: boolean;
  align?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
  /** 비어 있으면 빨간 [ 확인 필요 ] 로 표시 */
  required?: boolean;
  prefix?: string;
  suffix?: string;
  lineSpacingMul?: number;
  charSpacing?: number;
}

/** 얇은 선. w 또는 h 중 하나를 0 으로 두면 그 방향 선이 된다. */
export interface LineEl extends Box, Visibility {
  type: "line";
  color?: string;
  weight?: number;
}

export interface RectEl extends Box, Visibility {
  type: "rect";
  fill?: string;
  alpha?: number;
  stroke?: string;
  strokeWeight?: number;
}

export interface ImageEl extends Box, Visibility {
  type: "image";
  bind: string;
  fit?: "cover" | "contain";
  /** 사진이 없을 때 자리를 표시할지 */
  placeholder?: boolean;
}

/** 사진 위에 깔는 어두운 막 (사진 임팩트 장) */
export interface ScrimEl extends Box, Visibility {
  type: "scrim";
  color?: string;
  alpha: number;
}

/**
 * 같은 묶음을 N번 반복한다. 카드 3열/4열/5열, 숫자 3개, 단계 흐름을
 * 전부 이 하나로 처리한다. 하위 element 의 x/y 는 origin 기준 상대값.
 */
export interface RepeatEl {
  type: "repeat";
  /** 내용에서 반복할 배열 칸 이름 */
  over: string;
  origin: { x: number; y: number };
  step: { x?: number; y?: number };
  max?: number;
  /** 한 줄에 몇 개까지 두고 줄바꿈할지 (2x2 격자용) */
  perRow?: number;
  rowStep?: { x?: number; y?: number };
  elements: Element[];
}

export type Element = TextEl | LineEl | RectEl | ImageEl | ScrimEl | RepeatEl;

export interface PageType {
  id: string;
  name: string;
  description: string;
  /** 보기 좋게 묶는 이름: 표지 / 본문 / 마무리 */
  group: string;
  slots: Slot[];
  elements: Element[];
  sample: Content;
  /** 페이지 번호를 찍을지 (표지·구분장은 보통 안 찍는다) */
  showPageNo?: boolean;
  builtIn?: boolean;
  createdAt: string;
}

export type Content = Record<string, any>;

// ---------- 창고 3 : 규칙 ----------

/**
 * 규칙이 어디까지 적용되는가.
 *
 * 이게 없으면 1회성 지시가 전체로 번지고,
 * 1년 뒤 쌓인 규칙들이 서로 싸운다.
 */
export type RuleScope = "공통" | "스타일" | "분류" | "제안서";

export interface Rule {
  id: string;
  text: string;
  scope: RuleScope;
  /** 범위가 스타일/분류/제안서일 때 그 대상의 id */
  scopeId?: string;
  /** 어디서 나온 규칙인지 */
  source: "기본" | "대표지시" | "직접입력";
  sourceProjectId?: string;
  enabled: boolean;
  createdAt: string;
}

// ---------- 창고 4·5 : 사례 / 수정 기록 ----------

export interface HistoryEntry {
  id: string;
  projectId: string;
  slideIndex: number;
  /** 대표가 한 지시 */
  instruction: string;
  before: Content;
  after: Content;
  /** 규칙으로 승격했는지 */
  promotedRuleId?: string;
  createdAt: string;
}

// ---------- 프로젝트 ----------

/** 화면에서 끌어서 옮긴 자리. 이 페이지에만 적용된다. */
export interface Nudge {
  dx?: number;
  dy?: number;
  dw?: number;
  dh?: number;
}

/** 레이아웃에 없는데 이 페이지에만 더 넣은 것 (사진 추가 등) */
export interface Extra {
  id: string;
  type: "image" | "text";
  x: number;
  y: number;
  w: number;
  h: number;
  /** 사진이면 자산 키나 주소, 글이면 문구 */
  value: string;
  size?: number;
  bold?: boolean;
  color?: string;
}

export interface Slide {
  id: string;
  pageTypeId: string;
  content: Content;
  /** 화면에서 끌어 옮긴 자리들 */
  adjust?: Record<string, Nudge>;
  /** 이 페이지에만 더 넣은 것들 */
  extras?: Extra[];
  /** 이 한 장만 규격을 달리할 때 (시안을 고르면 여기 들어온다) */
  styleOverride?: StyleOverride;
  note?: string;
}

/**
 * 시안 하나.
 *
 * 아직 제안서에 들어가지 않은 "이렇게 하면 어떻겠습니까" 다.
 * 고르면 그때 페이지가 바뀐다.
 */
/**
 * 제안서 한 벌을 통째로 바꾸는 시안.
 *
 * "전체를 두 가지로 보여줘" — 한 장짜리 시안과 다른 점은 범위뿐이다.
 * 역시 고르기 전에는 제안서가 바뀌지 않는다.
 */
export interface DeckDraft {
  id: string;
  name: string;
  why?: string;
  /** 제안서 전체에 걸리는 규격 (색·글자 크기·선) */
  styleOverride?: StyleOverride;
  /** 구성까지 바꾸는 안이면 장을 통째로. 없으면 지금 장을 그대로 두고 규격만 바뀐다 */
  slides?: { pageTypeId: string; content: Content; styleOverride?: StyleOverride }[];
}

export interface Draft {
  id: string;
  /** 사람에게 보여 줄 이름 — "선 하나로 정리", "색 빼고 글자만" */
  name: string;
  /** 왜 이렇게 했는지 한 줄 */
  why?: string;
  pageTypeId: string;
  content: Content;
  /** 이 시안만의 규격 */
  styleOverride?: StyleOverride;
}

// ---------- 창고 6 : 분류(메뉴) ----------

/**
 * 분류는 코드에 박지 않는다. 대표님이 + 버튼으로 늘린다.
 *
 * kind 가 중요하다.
 *  - "우리 결과물": 우리가 만든 것. 구조를 그대로 뼈대로 쓸 수 있다.
 *  - "참고 자료": 남에게 받은 것 중 디자인이 괜찮아 모아둔 것.
 *                 보고 배우는 용도다. 통째로 베끼지 않는다.
 */
export interface Category {
  id: string;
  name: string;
  kind: "우리 결과물" | "참고 자료";
  /** 진열대에서 보이는 순서 */
  order: number;
  builtIn?: boolean;
  /**
   * 위에 걸린 분류. 없으면 큰 분류다.
   *
   * 큰 분류 아래에 세부 분류를 둔다 — "현수막" 아래 "개업", "행사", "계절" 처럼.
   * 제안서는 늘 가장 아래 칸(세부 분류가 있으면 거기)에 담긴다.
   */
  parentId?: string;
  /**
   * 치워 둔 분류.
   *
   * 기본으로 깔리는 분류는 코드에서 매번 다시 깔리므로 지워도 되살아난다.
   * 그래서 "지웠다" 는 사실을 표로 남겨 둔다.
   */
  hidden?: boolean;
}

/** 파일함의 칸. 건별로 원본과 만들 때 쓴 자료를 갈라 둔다. */
export type Folder = "원본" | "제작 자료";

/**
 * 건별 파일함에 넣어 둔 파일 하나.
 *
 * 파일 자체(url)와, 거기서 뽑아낸 글(text)을 함께 들고 있다.
 * 글을 들고 있으면 나중에 AI 가 그 자료를 보고 일할 수 있다.
 */
export interface Doc {
  id: string;
  name: string;
  size: number;
  mime: string;
  folder: Folder;
  /** 파일 본체. data URL 이거나, 회사 서버에 올라간 주소 */
  url?: string;
  /** 뽑아낸 글 (AI 가 읽을 재료) */
  text?: string;
  /** 파일 본체를 못 들고 있는 이유 등 */
  note?: string;
  addedAt: string;
}

export interface Project {
  /** 누가 만들었는가 */
  madeBy?: string;
  madeByName?: string;
  /** 마지막으로 손댄 사람 */
  editedByName?: string;
  id: string;
  title: string;
  client: string;
  /** 분류 id (창고 6) */
  category: string;
  status: "진행 중" | "완료";
  tags: string[];
  summary: string;
  styleId: string;
  styleVersion: number;
  /** 이 제안서에만 적용할 규격 바꿈 (전체로 번지지 않는다) */
  styleOverride?: StyleOverride;
  slides: Slide[];
  /** 사진·로고를 data URL 로 들고 있다 (지금은 내 PC 저장이라서) */
  assets: Record<string, string>;
  notes: string;
  createdAt: string;
  updatedAt: string;
  /** 완료로 표시한 때 */
  completedAt?: string;
  /** 이 건의 파일함 — 원본 파일과 제작 자료 */
  docs?: Doc[];
  /** PDF 로 낼 때 쓸 인쇄 규격 (기본: 화면 그대로) */
  printPaper?: string;
}

// ---------- 그리기 명령 ----------

/**
 * 해석이 끝난 상태. 스타일도 내용도 이미 다 녹아들어가 있고
 * 좌표는 인치, 색은 #RRGGBB, 글자크기는 pt 로 확정되어 있다.
 *
 * 미리보기(HTML)와 PPT 는 "둘 다 이것만" 보고 그린다.
 * 그래서 모양이 달라질 수 없다.
 */
/** 그리기 명령에 붙는 꼬리표 — 화면에서 집어서 고칠 때 쓴다 */
interface Handle {
  /** 레이아웃에서의 자리 (끌어 옮긴 값을 여기에 매단다) */
  at?: string;
  /** 내용에서의 자리 (화면에서 고친 글을 여기에 쓴다). 예: "cards.2.title" */
  bindPath?: string;
  /** 이 페이지에만 더 넣은 것인가 */
  extraId?: string;
}

export type DrawOp =
  | ({
      kind: "text";
      x: number;
      y: number;
      w: number;
      h: number;
      text: string;
      sizePt: number;
      bold: boolean;
      colorHex: string;
      align: "left" | "center" | "right";
      valign: "top" | "middle" | "bottom";
      lineSpacingMul?: number;
      charSpacing?: number;
      isTodo?: boolean;
    } & Handle)
  | ({
      kind: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      fillHex?: string;
      fillAlpha?: number;
      strokeHex?: string;
      strokeWeightPt?: number;
    } & Handle)
  | ({
      kind: "image";
      x: number;
      y: number;
      w: number;
      h: number;
      src: string;
      fit: "cover" | "contain";
    } & Handle);

/** 아직 못 채운 칸 */
export interface Todo {
  slideIndex: number;
  pageTypeName: string;
  label: string;
}


/**
 * 쓰는 사람.
 *
 * 밝혀 두는 것: 이것은 자물쇠가 아니라 이름표다.
 * 암호는 대표용·직원용 둘뿐이고, 이 브라우저 안에 그대로 적혀 있다.
 * 누가 만들고 누가 고쳤는지 남기려는 것이지, 자료를 잠그려는 것이 아니다.
 * 정말 잠가야 하면 회사 서버(Firebase) 로그인을 써야 한다.
 */
export interface Person {
  id: string;
  /** 아이디이자 이름. 직접 적어 넣는다 */
  name: string;
  role: "대표" | "직원";
  createdAt: string;
  /** 마지막으로 들어온 때 */
  lastIn?: string;
}

/** 누가 언제 무엇을 손댔는가 */
export interface Trail {
  id: string;
  at: string;
  who: string;
  whoName: string;
  projectId: string;
  projectTitle: string;
  /** "만듦" · "고침" · "이름 바꿈" · "지움" · "시안 적용" 같은 한마디 */
  what: string;
}


/**
 * 분류에 쌓아 두는 자료 한 장.
 *
 * 현수막 .ai 처럼 "제안서가 아닌 것" 을 분류별로 모아 두고 꺼내 쓰기 위함이다.
 * 담는 것은 미리보기 그림과 이름뿐이다 — 원본은 회사 자료함에 그대로 둔다.
 * (현수막 .ai 한 장이 수십~수백 MB 다. 100개면 몇 GB 라 브라우저에 못 담는다)
 */
export interface LibItem {
  id: string;
  /** 파일 이름 (고칠 수 있다) */
  name: string;
  /** 어느 분류에 담겼는가 (세부 분류면 그 id) */
  categoryId: string;
  /** 원본 파일 이름 — 회사 자료함에서 찾을 때 쓴다 */
  fileName: string;
  /** 원본 크기 (바이트) */
  size: number;
  /** 원본 가로·세로 (아는 경우) */
  w?: number;
  h?: number;
  /** 미리보기를 못 뽑았으면 그 까닭 */
  noThumb?: string;
  /** 찾을 때 쓰는 꼬리표 */
  tags?: string[];
  note?: string;
  addedAt: string;
  byName?: string;
}
