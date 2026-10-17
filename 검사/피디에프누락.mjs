/**
 * PDF 를 만들다 한 장을 못 그리면 어떻게 되는가.
 *
 * 전에는 그 장을 조용히 건너뛰었다. 10장짜리가 9장으로 나오는데
 * 파일은 멀쩡해 보인다. 그대로 인쇄소에 넘어가면 그제야 안다.
 *
 * 지시대로 10장 중 5장째를 일부러 실패시켜 본다.
 */
import { chromium } from "playwright";
const 탈 = [];
const 적 = (ok, 말, 덧 = "") => { console.log(`${ok ? "✓" : "✗"} ${말}${덧 ? ` — ${덧}` : ""}`); if (!ok) 탈.push(말); };

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1200, height: 800 } });
const 터짐 = [];
pg.on("pageerror", (e) => 터짐.push(e.message));
await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });

const r = await pg.evaluate(async () => {
  const { downloadPdf } = await import("/src/render/pdf.ts");
  const { BUILT_IN_STYLES } = await import("/src/core/style.ts");
  const style = BUILT_IN_STYLES[0];

  // 10장짜리 제안서
  const 장만들기 = (n) => ({ ops: [
    { kind: "rect", x: 0, y: 0, w: 10, h: 5.625, fillHex: "#ffffff" },
    { kind: "text", x: 1, y: 2.4, w: 8, h: 1, text: `${n}번째 장`,
      sizePt: 40, bold: true, colorHex: "#222222", align: "center", valign: "middle" },
  ]});
  const 열장 = Array.from({ length: 10 }, (_, i) => 장만들기(i + 1));

  // 내려받기를 가로채 크기만 잰다
  const 원래클릭 = HTMLAnchorElement.prototype.click;
  const 원래URL = URL.createObjectURL;
  let 받은크기 = null;
  URL.createObjectURL = function (blob) { 받은크기 = blob.size; return 원래URL.call(URL, blob); };
  HTMLAnchorElement.prototype.click = function () { /* 안 받는다 */ };

  // ① 정상 — 10장 다 나와야 한다
  받은크기 = null;
  const 정상 = await downloadPdf(열장, style, "검사-정상");
  const 정상크기 = 받은크기;

  /*
    ② 5번째 장만 실패시킨다.

    renderToBlob 을 바꿔 끼울 수는 없다 — ES 모듈이 가져간 이름은 못 바꾼다.
    그래서 그 안에서 실제로 쓰는 canvas.toBlob 을 건드린다.
    캔버스가 그림을 못 떠내는 상황(메모리 부족 등)과 같은 길이다.
  */
  const 원래toBlob = HTMLCanvasElement.prototype.toBlob;
  let 몇번째 = 0;
  HTMLCanvasElement.prototype.toBlob = function (cb, ...rest) {
    몇번째++;
    if (몇번째 === 5) { cb(null); return; }   // 못 떠낸 것으로
    return 원래toBlob.call(this, cb, ...rest);
  };
  받은크기 = null;
  const 깨짐 = await downloadPdf(열장, style, "검사-깨짐");
  const 깨짐크기 = 받은크기;

  /*
    ③ 인쇄용에서도 같은가.

    인쇄용은 한 번 실패하면 배율을 반씩 낮추며 다시 해 본다(일부러 그렇게 뒀다 —
    400cm 현수막이 캔버스 한계에 걸릴 때 아예 못 뽑는 것보다 낫다).
    그래서 "끝내 못 그리는" 상황을 만들려면 그 장의 재시도까지 전부 실패시켜야 한다.
  */
  몇번째 = 0;
  let 계속실패 = 0;
  HTMLCanvasElement.prototype.toBlob = function (cb, ...rest) {
    몇번째++;
    if (몇번째 === 5) 계속실패 = 6;        // 5번째 장부터 재시도까지 전부
    if (계속실패 > 0) { 계속실패--; cb(null); return; }
    return 원래toBlob.call(this, cb, ...rest);
  };
  받은크기 = null;
  const 인쇄깨짐 = await downloadPdf(열장, style, "검사-인쇄", undefined, "screen", true);
  const 인쇄크기 = 받은크기;

  // ④ 인쇄용에서 한 번만 실패하면? → 배율을 낮춰 살아나야 한다 (의도한 동작)
  몇번째 = 0;
  HTMLCanvasElement.prototype.toBlob = function (cb, ...rest) {
    몇번째++;
    if (몇번째 === 5) { cb(null); return; }
    return 원래toBlob.call(this, cb, ...rest);
  };
  받은크기 = null;
  const 인쇄살아남 = await downloadPdf(열장, style, "검사-인쇄2", undefined, "screen", true);
  const 살아남크기 = 받은크기;

  HTMLCanvasElement.prototype.toBlob = 원래toBlob;
  HTMLAnchorElement.prototype.click = 원래클릭;
  URL.createObjectURL = 원래URL;

  return {
    정상ok: 정상.ok, 정상크기,
    깨짐ok: 깨짐.ok, 깨짐말: 깨짐.error ?? "", 깨짐크기,
    인쇄ok: 인쇄깨짐.ok, 인쇄말: 인쇄깨짐.error ?? "", 인쇄크기,
    살아남ok: 인쇄살아남.ok, 살아남크기,
  };
});

적(r.정상ok && r.정상크기 > 0, "정상일 때 10장이 나온다", `${(r.정상크기/1024).toFixed(0)}KB`);
적(r.깨짐ok === false, "5장째가 실패하면 저장이 실패로 끝난다");
적(r.깨짐크기 === null, "9장짜리 파일을 내주지 않는다", r.깨짐크기 === null ? "파일 안 만듦" : `${r.깨짐크기}바이트 내줌 ✗`);
적(r.깨짐말.includes("5"), "몇 번째 장이 문제인지 알려 준다", r.깨짐말.slice(0, 70));
적(/다시|손본|재/.test(r.깨짐말), "어떻게 하라고 안내한다");
적(r.인쇄ok === false && r.인쇄크기 === null, "인쇄용 PDF 도 끝내 못 그리면 실패로 끝난다", r.인쇄말.slice(0, 55));
적(r.살아남ok && r.살아남크기 > 0, "인쇄용은 한 번 실패하면 배율을 낮춰 살려 낸다 (의도한 동작)",
   r.살아남크기 ? `${(r.살아남크기/1024).toFixed(0)}KB` : "못 살림");

if (터짐.length) { console.log("✗ 터짐:", [...new Set(터짐)].slice(0,3).join(" | ").slice(0,140)); 탈.push("화면 오류"); }
console.log(탈.length ? `\n문제 ${탈.length}곳` : "\n빠진 장이 있는 파일은 안 나간다");
await b.close();
process.exit(탈.length ? 1 : 0);
