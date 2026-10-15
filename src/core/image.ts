/**
 * 사진 줄이기
 *
 * 넣는 사진을 원본 그대로 두면 저장소가 금방 찬다.
 * 제안서는 10×5.625인치짜리라 긴 변 1600px 이면 넘치도록 충분하다.
 * (기획서 10장: "긴 변 2400px" — 화면용이라 1600 으로 더 줄인다)
 */

const LONG_EDGE = 1600;
const QUALITY = 0.86;

export async function shrink(dataUrl: string): Promise<string> {
  // 작은 그림(로고 등)은 그대로 둔다. 투명 배경을 지켜야 한다.
  if (dataUrl.length < 300_000) return dataUrl;

  const img = await load(dataUrl);
  if (!img) return dataUrl;

  const long = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = long > LONG_EDGE ? LONG_EDGE / long : 1;
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;

  // 투명한 자리는 흰색으로 (JPEG 는 투명을 못 담는다)
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const out = canvas.toDataURL("image/jpeg", QUALITY);
  return out.length < dataUrl.length ? out : dataUrl;
}

/** 파일을 읽어 바로 줄인 값을 돌려준다 */
export async function readShrunk(file: File): Promise<string> {
  const raw = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  return shrink(raw);
}

function load(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

export const prettyBytes = (n: number) =>
  n < 1024 ? `${n}B` : n < 1048576 ? `${Math.round(n / 1024)}KB` : `${(n / 1048576).toFixed(1)}MB`;
