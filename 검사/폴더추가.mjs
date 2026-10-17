import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const OUT = process.argv[2] || "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad";
const 터 = "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad/현수막폴더";
const 짐 = [
  { 길: "현수막폴더/개인/현수막-1.ai", 실: `${터}/개인/현수막-1.ai` },
  { 길: "현수막폴더/개인/현수막-2.ai", 실: `${터}/개인/현수막-2.ai` },
  { 길: "현수막폴더/기관/현수막-3.ai", 실: `${터}/기관/현수막-3.ai` },
  { 길: "현수막폴더/Thumbs.db",        실: `${터}/Thumbs.db` },
].map((x) => ({ 길: x.길, b64: readFileSync(x.실).toString("base64") }));

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1700, height: 1000 } });
pg.on("pageerror", e => console.log("✗ 페이지오류:", e.message));
await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await pg.evaluate(() => localStorage.clear());
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1200);
await pg.locator(".namebox").fill("박시영"); await pg.locator(".pinbox").fill("2230");
await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1500);
// 첫 화면이 "무엇을 만들어 드릴까요?" 작업대로 바뀌었다. 서류함을 보려면 한 번 눌러야 한다.
if (await pg.locator(".시작판").count()) {
  await pg.getByRole("button", { name: /보관함 보기/ }).click();
  await pg.waitForTimeout(700);
}
await pg.locator(".secadd").click(); await pg.waitForTimeout(400);
await pg.locator(".catnew").fill("현수막");
await pg.locator(".catnew").press("Enter"); await pg.waitForTimeout(700);
await pg.locator(".catnew").press("Escape"); await pg.waitForTimeout(400);
await pg.getByRole("button", { name: /현수막/ }).first().click(); await pg.waitForTimeout(600);

// 폴더 고르는 칸인가
const 폴더칸 = pg.locator(".libhead label", { hasText: "폴더 추가" }).locator("input");
console.log("폴더 고르기 칸:", await 폴더칸.count() ? "있음 ✓" : "없음 ✗");
console.log("폴더로 열리나:", await 폴더칸.evaluate((el) => el.webkitdirectory === true ? "예 ✓" : "아니오 ✗"));

// 폴더를 고른 것과 똑같이 — 길까지 붙여 꽂는다
await 폴더칸.evaluate((el, 짐) => {
  const dt = new DataTransfer();
  for (const f of 짐) {
    const bin = atob(f.b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const file = new File([u8], f.길.split("/").pop(), { type: "application/octet-stream" });
    Object.defineProperty(file, "webkitRelativePath", { value: f.길 });
    dt.items.add(file);
  }
  el.files = dt.files;
  el.dispatchEvent(new Event("change", { bubbles: true }));
}, 짐);

await pg.waitForFunction(() => document.querySelectorAll(".libcard").length >= 3, null, { timeout: 40000 });
await pg.waitForTimeout(1200);
console.log("담긴 자료:", await pg.locator(".libcard").count(), "개 ← 3 (Thumbs.db 는 걸러야 한다)");
console.log("이름:", (await pg.locator(".libname b").allTextContents()).join(" | "));

await pg.waitForTimeout(6500);
const 꼬리표 = await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  return (d.library || []).map((x) => `${x.name}[${(x.tags || []).join("/") || "-"}]`);
});
console.log("폴더 갈래가 꼬리표로:", 꼬리표.join(" | "));
const 분류 = await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  const 이름 = (id) => (d.categories || []).find((c) => c.id === id)?.name ?? id;
  const 셈 = {};
  for (const x of d.library || []) 셈[이름(x.categoryId)] = (셈[이름(x.categoryId)] ?? 0) + 1;
  return 셈;
});
console.log("어느 분류에 들어갔나:", JSON.stringify(분류), "← 개인 2 · 기관 1 이어야 한다");
const 생긴분류 = await pg.locator(".navrow.세부 .navitem b").allTextContents();
console.log("새로 생긴 세부 분류:", 생긴분류.map(t=>t.trim()).join(" | "));
console.log("원본 품은 수:", await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  return (d.library || []).filter((x) => x.hasFile).length;
}));
// 꼬리표로 찾기
await pg.locator(".libfind").fill("기관"); await pg.waitForTimeout(500);
console.log("'기관' 으로 찾기:", await pg.locator(".libcard").count(), "개");
await pg.locator(".lib").screenshot({ path: `${OUT}/폴더추가.png` });
await b.close();
