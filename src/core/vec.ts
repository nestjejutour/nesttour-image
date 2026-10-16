/**
 * AI 가 그린 그림 (SVG)
 *
 * ── 왜 이게 필요한가
 *
 * 현수막은 사진이 아니라 "그림" 이다. 대표님 창고에 쌓인 현수막 파일이
 * 전부 .ai (일러스트레이터) 인 것이 그 증거다. 일러스트레이터가 하는 일은
 * 선·면·색을 좌표로 적어 두는 것이고, 그건 글로 적을 수 있다.
 *
 * SVG 가 바로 그 글이다. AI 는 그림을 "찍지" 못하지만 "적을" 수는 있다.
 * 유채꽃 들판, 한라산 그림자, 하늘 그러데이션 — 전부 좌표와 색의 글이다.
 *
 * ── 덤으로 따라오는 것
 *
 * 1. 아무리 키워도 안 깨진다. 400cm 현수막이든 10m 간판이든 선은 선이다.
 *    인쇄소에 넘길 때 해상도를 걱정할 일이 없다. 이게 가장 큰 이득이다.
 * 2. 바깥 인터넷에 안 나간다. 남의 사진을 함부로 쓰는 일이 없다.
 *    인쇄물은 한번 박으면 수백 장이 나간다. 저작권 사고를 낼 자리가 아니다.
 * 3. 고칠 수 있다. 색 하나 글자 하나를 다시 적으면 그만이다.
 *
 * ── 한 가지 규칙: 글자는 SVG 에 넣지 않는다
 *
 * SVG 를 <img> 로 띄우면 그 안은 바깥 글꼴을 못 불러온다.
 * SVG 안에 쓴 한글은 엉뚱한 글꼴로 나오고, 고칠 수도 없다.
 * 그래서 글자는 늘 바깥 "칸" 에 둔다. 그림과 글자를 갈라 두면
 * 글꼴도 지켜지고, 대표님이 글만 따로 고칠 수도 있다.
 */

/**
 * 이 값이 그림(SVG) 인가 — 사진 주소가 아니라.
 *
 * "v is string" 으로 적지 않는다. 그렇게 적으면 아닌 쪽 갈래에서
 * 타입이 never 로 좁혀져 버려서, 이미 string 인 값을 더 쓸 수 없게 된다.
 */
export function 벡터인가(v: unknown): boolean {
  return typeof v === "string" && v.trimStart().startsWith("<svg");
}

/**
 * 위험한 것을 걷어낸다.
 *
 * <img> 안에서는 SVG 의 스크립트가 돌지 않는다. 그래도 걷어낸다 —
 * 언젠가 이 그림을 화면에 직접 붙이는 날이 오면 그때는 돈다.
 * 바깥 주소(http) 도 막는다. 그림이 남의 서버에 전화를 걸 일은 없다.
 */
export function 벡터씻기(svg: string): string {
  return svg
    .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/<\s*script[^>]*\/\s*>/gi, "")
    .replace(/<\s*foreignObject[\s\S]*?<\s*\/\s*foreignObject\s*>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/(href|xlink:href)\s*=\s*"(?:https?:|\/\/)[^"]*"/gi, '$1="#"')
    .replace(/javascript:/gi, "");
}

/**
 * 그림을 주소로 바꾼다.
 *
 * btoa 는 한글에서 깨진다 (유채꽃 같은 글자가 들어갈 수 있다).
 * 그래서 encodeURIComponent 로 싼다 — 느리지도 않고 안 깨진다.
 */
export function 벡터주소(svg: string): string {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(벡터씻기(svg));
}

/** 그림이 제대로 된 글인가. 깨진 글은 화면에서 그냥 빈칸으로 나와서, 미리 걸러낸다 */
export function 벡터성한가(svg: string): boolean {
  if (typeof DOMParser === "undefined") return true;
  try {
    const d = new DOMParser().parseFromString(벡터씻기(svg), "image/svg+xml");
    return !d.querySelector("parsererror") && d.documentElement?.tagName === "svg";
  } catch {
    return false;
  }
}

/**
 * 그림을 사진으로 떠낸다 (PPT 용, 그리고 인쇄용).
 *
 * PPT 는 SVG 를 제대로 못 받는다. 그래서 넣기 전에 한 번 떠 둔다.
 * 긴 변을 몇 점으로 뜰지 정할 수 있다 — 인쇄용은 크게, 화면용은 작게.
 */
export async function 벡터를사진으로(
  svg: string,
  긴변 = 2000,
): Promise<string | null> {
  const img = new Image();
  img.decoding = "sync";
  const ok = await new Promise<boolean>((res) => {
    img.onload = () => res(true);
    img.onerror = () => res(false);
    img.src = 벡터주소(svg);
  });
  if (!ok) return null;

  const 비율 = img.naturalWidth && img.naturalHeight
    ? img.naturalWidth / img.naturalHeight
    : 4;
  const w = 비율 >= 1 ? 긴변 : Math.round(긴변 * 비율);
  const h = 비율 >= 1 ? Math.round(긴변 / 비율) : 긴변;

  const c = document.createElement("canvas");
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}
