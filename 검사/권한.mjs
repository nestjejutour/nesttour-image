import { chromium } from "playwright";
const OUT = process.argv[2] || "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1700, height: 1000 }, deviceScaleFactor: 1.2 });
pg.on("pageerror", e => console.log("✗ 페이지오류:", e.message));
await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await pg.evaluate(() => localStorage.clear());
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1200);

const 분류 = async () =>
  (await pg.locator(".navrow .navitem b").allTextContents()).map(t=>t.trim());
const 탭 = async () => (await pg.locator(".tabs .tab").allTextContents()).map(t=>t.trim());

// ── 대표로 ──
await pg.locator(".namebox").fill("박시영"); await pg.locator(".pinbox").fill("2230");
await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1500);
// 첫 화면이 "무엇을 만들어 드릴까요?" 작업대로 바뀌었다. 서류함을 보려면 한 번 눌러야 한다.
if (await pg.locator(".시작판").count()) {
  await pg.getByRole("button", { name: /보관함 보기/ }).click();
  await pg.waitForTimeout(700);
}
console.log("[대표] 탭:", (await 탭()).join(" | "));
await pg.locator(".secadd").click(); await pg.waitForTimeout(400);
await pg.locator(".catnew").fill("현수막");
await pg.locator(".catnew").press("Enter"); await pg.waitForTimeout(700);
await pg.locator(".catnew").press("Escape"); await pg.waitForTimeout(400);
console.log("[대표] 분류:", (await 분류()).join(" | "));

// 현수막만 직원에게 보이게
await pg.getByRole("button", { name: "창고" }).click(); await pg.waitForTimeout(700);
await pg.getByRole("button", { name: /^사람/ }).click(); await pg.waitForTimeout(600);
console.log("[대표] 고를 수 있는 분류:", (await pg.locator(".pick span").allTextContents()).join(" | "));
await pg.locator(".pick").filter({ hasText: "현수막" }).locator("input").check(); await pg.waitForTimeout(800);
await pg.locator(".page").screenshot({ path: `${OUT}/권한.png` });

// ── 직원으로 ──
await pg.waitForTimeout(6500);
await pg.getByRole("button", { name: "로그아웃" }).click(); await pg.waitForTimeout(900);
await pg.locator(".namebox").fill("김디자"); await pg.locator(".pinbox").fill("2012");
await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1800);
console.log("\n[직원] 탭:", (await 탭()).join(" | ") || "(없음 ✓)");
console.log("[직원] 분류:", (await 분류()).join(" | "));
console.log("[직원] 큰 분류 만드는 +:", await pg.locator(".secadd").count() ? "보임 ✗" : "안 보임 ✓");

// 직원도 세부 분류는 넣을 수 있어야 한다
const 줄 = pg.locator(".navrow").filter({ hasText: "현수막" }).first();
await 줄.hover(); await pg.waitForTimeout(300);
console.log("[직원] 줄의 단추:", (await 줄.locator(".rowbtn").allTextContents()).join(" ") || "(없음)");
await 줄.locator(".rowbtn").first().click(); await pg.waitForTimeout(400);
await pg.locator(".catnew.세부").fill("개업");
await pg.locator(".catnew.세부").press("Enter"); await pg.waitForTimeout(700);
await pg.locator(".catnew.세부").press("Escape"); await pg.waitForTimeout(400);
console.log("[직원] 세부 넣은 뒤:", (await 분류()).join(" | "));
console.log("[직원] 자료함:", await pg.locator(".lib").count() ? "쓸 수 있음 ✓" : "없음 ✗");
await pg.locator(".dash-nav").screenshot({ path: `${OUT}/권한직원.png` });
await b.close();
