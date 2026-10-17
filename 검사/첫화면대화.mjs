/**
 * 첫 화면에서 말만 하면 현수막이 나오는가.
 *
 * 대표님 화면에서 본 것: 보관함에서 "세미나실에 걸 현수막 디자인해봐" 했더니
 * AI 가 "두 가지 안으로 만들었습니다" 라고 말만 하고 화면에는 아무것도 안 나왔다.
 * 보관함에는 현수막을 만들 수단이 없었기 때문이다.
 */
import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad/첫화면";
import { mkdirSync } from "node:fs";
mkdirSync(OUT, { recursive: true });
const 탈 = [];
const 적 = (ok, 말, 덧 = "") => { console.log(`${ok ? "✓" : "✗"} ${말}${덧 ? ` — ${덧}` : ""}`); if (!ok) 탈.push(말); };

const 그림 = (하늘, 들) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 280"><rect width="1200" height="280" fill="${하늘}"/><path d="M0 200 Q300 180 600 200 T1200 190 V280 H0 Z" fill="${들}"/></svg>`;

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1700, height: 1050 } });
const 터짐 = [];
pg.on("pageerror", (e) => 터짐.push(e.message));

let 받은지시 = "";
await pg.route("**/api/ai", async (route) => {
  try { 받은지시 = JSON.parse(route.request().postDataBuffer()?.toString("utf8") || "{}").system || ""; } catch { /* */ }
  const reply = { say: "두 가지로 만들었습니다. 300 × 70 cm 로 잡았습니다.", actions: [
    { do: "새인쇄물", title: "제주워크숍 현수막 (안 1)", 가로cm: 300, 세로cm: 70,
      content: { art: 그림("#1E3A2B", "#FFD93D"), 주제목: "26년 초우량 대표농가 VIP 제주워크숍",
                 부제목: "2026. 06. 24", 덧말: "", 자리: "가운데" } },
  ] };
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: JSON.stringify(reply) }) });
});

await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await pg.evaluate(() => localStorage.clear());
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1300);
await pg.locator(".namebox").fill("박시영"); await pg.locator(".pinbox").fill("2230");
await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1800);

/* ① 첫 화면이 작업대인가 */
적(await pg.locator(".시작판").count() > 0, "첫 화면이 묻는 칸으로 열린다");
const 제목 = await pg.locator(".시작판 h1").innerText().catch(() => "");
적(제목.includes("무엇을"), "무엇을 만들지 묻는다", 제목.trim());
적(await pg.locator(".cards .card").count() === 0, "서류함 목록이 앞을 막지 않는다");
적(await pg.locator(".시작보기 .보기칩").count() >= 3, "예시가 있다");
await pg.screenshot({ path: `${OUT}/1-첫화면.png` });

/* ② 말로 시킨다 */
await pg.locator(".시작칸 textarea").fill("26년 초우량 대표농가 VIP 제주워크숍 2026.06.24 문구로 세미나실에 걸 현수막 디자인해봐");
await pg.locator(".시작칸 textarea").press("Enter");
await pg.waitForTimeout(4500);
적(받은지시.includes("새인쇄물"), "보관함 지시에 현수막 만드는 수단이 있다");
적(받은지시.includes("viewBox"), "그림 그리는 법까지 알려 준다");

/* ③ 진짜로 만들어졌는가 */
const 만든것 = await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  const p = (d.projects || []).find((x) => String(x.title).includes("제주워크숍"));
  if (!p) return null;
  const s = p.styleOverride?.slide;
  return { 이름: p.title, 치수: s ? `${Math.round(s.widthIn * 2.54)} × ${Math.round(s.heightIn * 2.54)} cm` : "(없음)",
           틀: p.slides?.[0]?.pageTypeId, 그림: String(p.slides?.[0]?.content?.art || "").slice(0, 10) };
});
적(!!만든것, "말만 했는데 현수막이 만들어졌다", 만든것 ? `${만든것.이름} · ${만든것.치수}` : "안 만들어졌다");
적(만든것?.틀 === "banner-ai", "현수막 틀로 열렸다", String(만든것?.틀));
적(만든것?.그림.startsWith("<svg"), "AI 가 그린 그림이 들어 있다");
await pg.waitForTimeout(1200);
적(await pg.locator(".stage-inner").count() > 0, "바로 작업 화면으로 들어간다");
await pg.screenshot({ path: `${OUT}/2-만들어짐.png` });

/* ④ 보관함도 여전히 갈 수 있는가 */
await pg.getByRole("button", { name: "← 보관함" }).click().catch(() => {});
await pg.waitForTimeout(1200);
적(await pg.locator(".시작판").count() > 0, "돌아오면 다시 작업대다");
await pg.getByRole("button", { name: /보관함 보기/ }).click().catch(() => {});
await pg.waitForTimeout(900);
적(await pg.locator(".시작판").count() === 0 && await pg.locator(".dash-top h1").count() > 0,
   "'보관함 보기' 를 누르면 서류함이 나온다");
await pg.screenshot({ path: `${OUT}/3-보관함.png` });

if (터짐.length) { console.log("✗ 터짐:", [...new Set(터짐)].slice(0, 3).join(" | ").slice(0, 150)); 탈.push("화면 오류"); }
console.log(탈.length ? `\n막히는 데 ${탈.length}곳` : "\n막히는 데 없음");
await b.close();
process.exit(탈.length ? 1 : 0);
