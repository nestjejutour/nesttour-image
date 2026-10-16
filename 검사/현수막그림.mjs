/**
 * AI 가 그린 그림(SVG)이 판에 실제로 그려지는가.
 *
 * 그림이 안 그려지면 화면은 그냥 빈칸으로 나온다 — 오류도 안 난다.
 * 그래서 색을 집어서 확인한다. 노란 들판이 노랗게 찍혔는지.
 */
import { chromium } from "playwright";

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const 터짐 = [];
pg.on("pageerror", (e) => 터짐.push(e.message));
await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });

const 결과 = await pg.evaluate(async () => {
  const { interpret } = await import("/src/core/interpret.ts");
  const { renderToBlob } = await import("/src/render/canvas.ts");
  const { BUILT_IN_STYLES } = await import("/src/core/style.ts");
  const { MORE_PAGE_TYPES } = await import("/src/core/pageTypes.more.ts");
  const 틀들 = MORE_PAGE_TYPES;
  const 틀 = 틀들.find((t) => t.id === "banner-ai");
  const 잼 = {};
  잼.틀있나 = !!틀;
  if (!틀) return 잼;

  // 400 × 70 cm
  const 기본 = BUILT_IN_STYLES[0];
  const style = { ...기본, slide: { ...기본.slide, widthIn: 157.48, heightIn: 27.56 } };

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 280">
    <rect width="1600" height="280" fill="#8ECAE6"/>
    <rect y="170" width="1600" height="110" fill="#F6D847"/>
  </svg>`;

  const ops = interpret(틀, { art: svg, 주제목: "제주 유채꽃 축제", 부제목: "봄", 덧말: "" }, { style });
  const 그림칸 = ops.filter((o) => o.kind === "image");
  잼.그림칸수 = 그림칸.length;
  잼.주소머리 = 그림칸[0]?.src.slice(0, 30) ?? "(없음)";
  잼.글자수 = ops.filter((o) => o.kind === "text" && o.text).length;
  // 자유판이니 그림이 판을 꽉 채워야 한다
  잼.꽉찼나 =
    그림칸[0] &&
    Math.abs(그림칸[0].w - 157.48) < 0.5 &&
    Math.abs(그림칸[0].h - 27.56) < 0.5;

  const blob = await renderToBlob(ops, style, { type: "image/jpeg", quality: 0.9 });
  잼.크기MB = blob ? +(blob.size / 1024 / 1024).toFixed(3) : null;

  // 떠낸 그림에서 색을 집는다
  const img = new Image();
  await new Promise((r) => { img.onload = r; img.onerror = r; img.src = URL.createObjectURL(blob); });
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const 집기 = (fx, fy) => {
    const d = ctx.getImageData(Math.round(c.width * fx), Math.round(c.height * fy), 1, 1).data;
    return `#${[d[0], d[1], d[2]].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  };
  잼.점 = { 하늘: 집기(0.08, 0.15), 들판: 집기(0.08, 0.9) };
  잼.하늘색맞나 = 집기(0.08, 0.15).startsWith("#8") || 집기(0.08, 0.15).startsWith("#9");
  잼.들판노랗나 = (() => {
    const d = ctx.getImageData(Math.round(c.width * 0.08), Math.round(c.height * 0.9), 1, 1).data;
    return d[0] > 200 && d[1] > 170 && d[2] < 140;
  })();

  // 깨진 그림은 걸러져야 한다
  const { 벡터성한가 } = await import("/src/core/vec.ts");
  잼.깨진것걸러냄 = 벡터성한가("<svg><rect fill=") === false;
  잼.성한것통과 = 벡터성한가(svg) === true;
  return 잼;
});

const 줄 = (k, ok, v) => console.log(`${ok ? "✓" : "✗"} ${k}${v !== undefined ? ` — ${v}` : ""}`);
줄("현수막 틀이 있다", 결과.틀있나);
줄("그림칸이 하나 생겼다", 결과.그림칸수 === 1, 결과.그림칸수);
줄("SVG 가 주소로 바뀌었다", String(결과.주소머리).startsWith("data:image/svg+xml"), 결과.주소머리);
줄("글자 칸도 같이 섰다", 결과.글자수 >= 2, `${결과.글자수}개`);
줄("그림이 판을 꽉 채운다", !!결과.꽉찼나);
줄("떠낸 그림이 20MB 아래다", 결과.크기MB !== null && 결과.크기MB < 20, `${결과.크기MB}MB`);
줄("하늘이 하늘색으로 찍혔다", !!결과.하늘색맞나, 결과.점?.하늘);
줄("들판이 노랗게 찍혔다", !!결과.들판노랗나, 결과.점?.들판);
줄("깨진 그림은 걸러낸다", !!결과.깨진것걸러냄);
줄("성한 그림은 통과한다", !!결과.성한것통과);
if (터짐.length) console.log("✗ 페이지 오류:", 터짐.join(" | "));

const 통과 =
  결과.틀있나 && 결과.그림칸수 === 1 && 결과.꽉찼나 && 결과.들판노랗나 &&
  결과.하늘색맞나 && 결과.크기MB < 20 && 결과.깨진것걸러냄 && 결과.성한것통과 && !터짐.length;
console.log(통과 ? "\n전부 통과" : "\n못 통과한 것이 있다");
await b.close();
process.exit(통과 ? 0 : 1);
