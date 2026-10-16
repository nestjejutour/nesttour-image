/**
 * 인쇄용 저장이 실제로 쓸 만한 배율로 뜨는가.
 *
 * 화면용 배율(긴 변 2,400점)로 400cm 현수막을 박으면 1점이 1.7mm 다 — 뭉개진다.
 * 인쇄소에 넘길 파일은 달라야 한다. 그걸 여기서 확인한다.
 */
import { chromium } from "playwright";

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1200, height: 800 } });
const 터짐 = [];
pg.on("pageerror", (e) => 터짐.push(e.message));
await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });

const r = await pg.evaluate(async () => {
  const { renderToBlob, 인쇄배율, 인쇄크기말 } = await import("/src/render/canvas.ts");
  const { BUILT_IN_STYLES } = await import("/src/core/style.ts");
  const 기본 = BUILT_IN_STYLES[0];
  const 짜기 = (wIn, hIn) => ({ ...기본, slide: { ...기본.slide, widthIn: wIn, heightIn: hIn } });

  const 재기 = async (wIn, hIn, 이름) => {
    const st = 짜기(wIn, hIn);
    const d = 인쇄배율(st);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 280">
      <rect width="1600" height="280" fill="#8ECAE6"/><rect y="170" width="1600" height="110" fill="#F6D847"/></svg>`;
    const ops = [
      { kind: "image", x: 0, y: 0, w: wIn, h: hIn, fit: "cover",
        src: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg) },
      { kind: "text", x: 1, y: hIn * 0.4, w: wIn - 2, h: hIn * 0.2, text: "제주 유채꽃 축제",
        sizePt: 40, bold: true, colorHex: "#ffffff", align: "center", valign: "middle" },
    ];
    const t0 = performance.now();
    let blob = null, 터진말 = "";
    try { blob = await renderToBlob(ops, st, { type: "image/jpeg", quality: 0.95, dpi: d }); }
    catch (e) { 터진말 = String(e?.message ?? e); }
    return {
      이름, dpi: Math.round(d), 말: 인쇄크기말(st),
      점: [Math.round(wIn * d), Math.round(hIn * d)],
      MB: blob ? +(blob.size / 1024 / 1024).toFixed(2) : null,
      초: +((performance.now() - t0) / 1000).toFixed(1),
      터진말,
      // 1점이 몇 mm 인가. 0.3mm 아래면 인쇄소에서 쓸 만하다
      점크기mm: +(25.4 / d).toFixed(3),
    };
  };

  return [
    await 재기(11.69, 8.27, "A4 문서"),
    await 재기(157.48, 27.56, "현수막 400×70cm"),
    await 재기(196.85, 35.43, "현수막 500×90cm"),
  ];
});

let 통과 = !터짐.length;
for (const x of r) {
  const 좋은가 = x.MB !== null && x.MB < 25 && x.점크기mm <= 0.55 && !x.터진말;
  if (!좋은가) 통과 = false;
  console.log(
    `${좋은가 ? "✓" : "✗"} ${x.이름} — ${x.말}, ${x.MB}MB, ${x.초}초, 1점=${x.점크기mm}mm` +
    (x.터진말 ? `  터짐: ${x.터진말}` : ""),
  );
}
if (터짐.length) console.log("✗ 페이지 오류:", 터짐.join(" | "));
console.log(통과 ? "\n전부 통과" : "\n못 통과한 것이 있다");
await b.close();
process.exit(통과 ? 0 : 1);
