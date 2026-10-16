/**
 * 판 크기와 인쇄 규격
 *
 * 페이지 모양(좌표)은 모두 10 × 5.625 인치(16:9) 를 기준으로 그려져 있다.
 * 판 크기를 바꾸면 그 기준판을 통째로 줄이거나 늘려 새 판 가운데에 놓는다.
 * 그래서 어떤 규격을 골라도 디자인이 흐트러지지 않는다.
 */

/** 모든 페이지 모양이 그려진 기준 판 */
export const DESIGN = { widthIn: 10, heightIn: 5.625 };

export interface Paper {
  id: string;
  name: string;
  widthIn: number;
  heightIn: number;
  note: string;
}

/** 문서 자체의 판 크기 */
export const SLIDE_SIZES: Paper[] = [
  { id: "16:9", name: "와이드 16:9", widthIn: 10, heightIn: 5.625, note: "요즘 가장 많이 쓰는 발표 규격입니다. 기본값으로 두시면 됩니다." },
  { id: "16:10", name: "16:10", widthIn: 10, heightIn: 6.25, note: "노트북 화면에 맞는 규격입니다." },
  { id: "4:3", name: "4:3", widthIn: 10, heightIn: 7.5, note: "오래된 빔프로젝터·관공서 서식에 쓰입니다." },
  { id: "a4-yoko", name: "A4 가로", widthIn: 11.69, heightIn: 8.27, note: "인쇄해서 제출하는 제안서에 쓰입니다." },
  { id: "a4-tate", name: "A4 세로", widthIn: 8.27, heightIn: 11.69, note: "보고서·공문 형태로 낼 때 쓰입니다." },
];

/** PDF 로 낼 때 얹을 종이 */
export const PRINT_SIZES: Paper[] = [
  { id: "screen", name: "화면 그대로", widthIn: 0, heightIn: 0, note: "지금 보이는 판 크기 그대로 PDF 를 만듭니다. 화면으로 돌려볼 때 가장 좋습니다." },
  { id: "a4-yoko", name: "A4 가로", widthIn: 11.69, heightIn: 8.27, note: "A4 용지에 가로로 앉힙니다. 가장 흔한 인쇄 규격입니다." },
  { id: "a4-tate", name: "A4 세로", widthIn: 8.27, heightIn: 11.69, note: "A4 용지 세로. 위아래 여백이 생깁니다." },
  { id: "letter-yoko", name: "레터 가로", widthIn: 11, heightIn: 8.5, note: "미국·해외 제출용 용지입니다." },
  { id: "b4-yoko", name: "B4 가로", widthIn: 14.33, heightIn: 10.12, note: "크게 뽑아 펼쳐 보여줄 때 씁니다." },
];

export const slideSize = (id: string | undefined) =>
  SLIDE_SIZES.find((s) => s.id === id) ?? SLIDE_SIZES[0];

export const printSize = (id: string | undefined) =>
  PRINT_SIZES.find((s) => s.id === id) ?? PRINT_SIZES[0];

/** 어떤 판 크기가 쓰이고 있는지 (너비·높이로 되짚는다) */
export function slideSizeOf(widthIn: number, heightIn: number): Paper {
  const near = (a: number, b: number) => Math.abs(a - b) < 0.02;
  return SLIDE_SIZES.find((s) => near(s.widthIn, widthIn) && near(s.heightIn, heightIn)) ?? {
    id: "직접", name: `${widthIn} × ${heightIn} 인치`, widthIn, heightIn, note: "직접 넣은 크기입니다.",
  };
}

/**
 * 기준판(10 × 5.625) 을 주어진 판 안에 가장 크게, 가운데 놓는 셈.
 * 같은 크기면 1배·여백 0 이 나오므로 아무 일도 하지 않는다.
 */
export function fitToPaper(widthIn: number, heightIn: number) {
  const scale = Math.min(widthIn / DESIGN.widthIn, heightIn / DESIGN.heightIn);
  return {
    scale,
    dx: (widthIn - DESIGN.widthIn * scale) / 2,
    dy: (heightIn - DESIGN.heightIn * scale) / 2,
    plain: Math.abs(scale - 1) < 0.001 && Math.abs(widthIn - DESIGN.widthIn) < 0.02,
  };
}


/**
 * 화면에 맞추는 배율의 아래 끝.
 *
 * 16:9 한 장(10인치)만 생각하고 0.25 로 막아 두었더니
 * 400×90cm 현수막(157인치)이 네 배 크게 나와 화면을 넘쳤다.
 * 큰 판도 들어가야 하므로 끝까지 열어 둔다.
 */
export const 작게끝 = 0.02;
