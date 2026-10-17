import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1700, height: 1000 }, deviceScaleFactor: 1.2 });
pg.on("pageerror", e => console.log("✗ 페이지오류:", e.message));
await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await pg.evaluate(() => localStorage.clear());
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1200);

console.log("체크박스:", await pg.locator(".remember input").count() ? "있음 ✓" : "없음 ✗");
console.log("처음 상태:", await pg.locator(".remember input").isChecked() ? "켜짐 ✓" : "꺼짐");
console.log("문구 남았나:", await pg.locator(".gatenote").count() ? "남음 ✗" : "지워짐 ✓");
await pg.screenshot({ path: `${OUT}/로그인화면.png`, clip: { x: 560, y: 300, width: 580, height: 400 } });

// ① 켠 채로 로그인 → 이름이 남는다
await pg.locator(".namebox").fill("박시영"); await pg.locator(".pinbox").fill("2230");
await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1500);
// 첫 화면이 "무엇을 만들어 드릴까요?" 작업대로 바뀌었다. 서류함을 보려면 한 번 눌러야 한다.
if (await pg.locator(".시작판").count()) {
  await pg.getByRole("button", { name: /보관함 보기/ }).click();
  await pg.waitForTimeout(700);
}
await pg.getByRole("button", { name: "로그아웃" }).click(); await pg.waitForTimeout(800);
console.log("\n켜고 로그인 뒤 이름:", `"${await pg.locator(".namebox").inputValue()}"`);

// ② 체크를 끄면 그 자리에서 지워진다
await pg.locator(".remember input").uncheck(); await pg.waitForTimeout(400);
console.log("체크 끈 직후 저장된 이름:", JSON.stringify(await pg.evaluate(() => localStorage.getItem("mtmb-지난이름"))));

// ③ 끈 채로 로그인했다 나오면 비어 있다
await pg.locator(".namebox").fill("김디자"); await pg.locator(".pinbox").fill("2012");
await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1500);
await pg.getByRole("button", { name: "로그아웃" }).click(); await pg.waitForTimeout(800);
console.log("끄고 로그인 뒤 이름:", `"${await pg.locator(".namebox").inputValue()}"`);
console.log("체크 상태 기억하나:", await pg.locator(".remember input").isChecked() ? "켜짐 ✗" : "꺼짐 ✓");
await b.close();
