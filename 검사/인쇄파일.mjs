/**
 * 인쇄용 PDF 가 실제로 만들어지는가.
 *
 * 배율을 재는 것(인쇄해상도.mjs)과 파일이 나오는 것은 다른 이야기다.
 * 13,093 × 2,291 점짜리 그림을 PDF 안에 넣는 데서 터질 수 있다.
 * 인쇄소에 넘길 파일이라 여기서 터지면 일이 멈춘다.
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1200, height: 800 } });
const 터짐 = [];
pg.on("pageerror", (e) => 터짐.push(e.message));
await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });

const r = await pg.evaluate(async () => {
  const { BUILT_IN_STYLES } = await import("/src/core/style.ts");
  const { interpret } = await import("/src/core/interpret.ts");
  const { MORE_PAGE_TYPES } = await import("/src/core/pageTypes.more.ts");
  const { 인쇄배율 } = await import("/src/render/canvas.ts");
  const { jsPDF } = await import("jspdf");
  const { renderToBlob } = await import("/src/render/canvas.ts");

  const 틀 = MORE_PAGE_TYPES.find((t) => t.id === "banner-ai");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 280">
    <rect width="1600" height="280" fill="#8ECAE6"/><rect y="170" width="1600" height="110" fill="#F6D847"/></svg>`;

  const 하나 = async (가로in, 세로in, 이름) => {
    const 기본 = BUILT_IN_STYLES[0];
    const style = { ...기본, slide: { ...기본.slide, widthIn: 가로in, heightIn: 세로in } };
    const ops = interpret(틀, { art: svg, 주제목: "제주 유채꽃 축제", 부제목: "봄", 덧말: "가시리" }, { style });
    const t0 = performance.now();
    const d = 인쇄배율(style);
    let 말 = "";
    let MB = null;
    try {
      const blob = await renderToBlob(ops, style, { type: "image/jpeg", quality: 0.95, dpi: d });
      if (!blob) throw new Error("그림을 못 떴다");
      const url = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
      const doc = new jsPDF({ orientation: 가로in >= 세로in ? "landscape" : "portrait", unit: "in", format: [가로in, 세로in] });
      doc.addImage(url, "JPEG", 0, 0, 가로in, 세로in);
      const out = doc.output("blob");
      MB = +(out.size / 1024 / 1024).toFixed(2);
    } catch (e) { 말 = String(e?.message ?? e); }
    return { 이름, dpi: Math.round(d), MB, 초: +((performance.now() - t0) / 1000).toFixed(1), 말 };
  };

  return [
    await 하나(11.69, 8.27, "A4 문서"),
    await 하나(157.48, 27.56, "현수막 400×70cm"),
    await 하나(196.85, 35.43, "현수막 500×90cm"),
    await 하나(39.37, 70.87, "엑스배너 100×180cm"),
  ];
});

let 통과 = !터짐.length;
for (const x of r) {
  const ok = x.MB !== null && !x.말 && x.MB < 60;
  if (!ok) 통과 = false;
  console.log(`${ok ? "✓" : "✗"} ${x.이름} — ${x.dpi}dpi, PDF ${x.MB}MB, ${x.초}초${x.말 ? `  터짐: ${x.말}` : ""}`);
}
if (터짐.length) console.log("✗ 페이지오류:", 터짐.slice(0, 2).join(" | "));
console.log(통과 ? "\n전부 통과" : "\n못 통과한 것이 있다");
await b.close();
process.exit(통과 ? 0 : 1);
