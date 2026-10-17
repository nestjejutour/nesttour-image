import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1700, height: 1000 }, deviceScaleFactor: 1.4 });
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
const 줄 = pg.locator(".navrow").filter({ hasText: "현수막" }).first();
await 줄.hover(); await 줄.locator(".rowbtn").first().click(); await pg.waitForTimeout(400);
for (const n of ["개인", "기업"]) {
  await pg.locator(".catnew.세부").fill(n);
  await pg.locator(".catnew.세부").press("Enter"); await pg.waitForTimeout(600);
}
await pg.locator(".catnew.세부").press("Escape"); await pg.waitForTimeout(400);

// 세부 분류를 고른다
await pg.getByRole("button", { name: /개인/ }).first().click(); await pg.waitForTimeout(600);
const 꼴 = await pg.locator(".navrow.세부 .navitem.on").evaluate((el) => {
  const s = getComputedStyle(el);
  return { 바탕: s.backgroundColor, 글자: s.color, 글: el.innerText.trim() };
});
console.log("고른 세부 분류:", JSON.stringify(꼴));
console.log("글자가 보이나:", 꼴.바탕 !== 꼴.글자 ? "보임 ✓" : "안 보임 ✗");
await pg.locator(".dash-nav").screenshot({ path: `${OUT}/세부색.png` });
await b.close();
