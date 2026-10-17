import { chromium } from "playwright";
const OUT = process.argv[2] || "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1700, height: 1000 }, deviceScaleFactor: 1.2 });
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

const 고른분류 = () => pg.locator(".navrow .navitem.on b, .dash-nav > .navitem.on b").first().innerText();
console.log("머리줄 단추:", (await pg.locator(".topbar .btn.primary").innerText()).trim());
console.log("보관함 단추:", (await pg.locator(".dash-main .row .btn").allTextContents()).slice(0,3).map(t=>t.trim()).join(" | "));

// 현수막을 만들고 고른다
await pg.locator(".secadd").click(); await pg.waitForTimeout(400);
await pg.locator(".catnew").fill("현수막");
await pg.locator(".catnew").press("Enter"); await pg.waitForTimeout(700);
await pg.locator(".catnew").press("Escape"); await pg.waitForTimeout(400);
await pg.getByRole("button", { name: /현수막/ }).first().click(); await pg.waitForTimeout(700);
console.log("\n고른 분류:", await 고른분류());
console.log("빈자리 단추:", (await pg.locator(".빈자리 .btn").allTextContents()).map(t=>t.trim()).join(" | "));

// 신규 등록 → 취소 → 제자리로 돌아와야 한다
await pg.locator(".빈자리").getByRole("button", { name: "신규 등록" }).click(); await pg.waitForTimeout(900);
console.log("등록 화면 제목:", (await pg.locator("h1").first().innerText()).trim());
// 인쇄물 분류면 곧장 치수를 묻는다. 그 화면에는 .startrow 가 없다.
console.log("등록 화면 단추:",
  (await pg.locator(".startrow .btn").count())
    ? (await pg.locator(".startrow .btn").first().innerText()).trim()
    : (await pg.locator(".pick span").count()) ? "치수 묻는 화면" : "(없음)");
await pg.getByRole("button", { name: "취소" }).first().click(); await pg.waitForTimeout(1200);
console.log("취소하고 돌아온 분류:", await 고른분류(), "← 현수막 이어야 한다");

// 머리줄 신규 등록도 보고 있던 분류로
await pg.locator(".topbar .btn.primary").click(); await pg.waitForTimeout(1000);
await pg.getByRole("button", { name: "취소" }).first().click(); await pg.waitForTimeout(1200);
console.log("머리줄로 들어갔다 나온 분류:", await 고른분류(), "← 현수막 이어야 한다");
// 자료를 넣고 보관함을 떠났다 와도 제자리인가
await pg.getByRole("button", { name: "설정", exact: true }).click(); await pg.waitForTimeout(700);
await pg.getByRole("button", { name: "보관함" }).click(); await pg.waitForTimeout(900);
console.log("창고 갔다 온 뒤 분류:", await 고른분류(), "← 현수막 이어야 한다");
await pg.screenshot({ path: `${OUT}/말과자리.png`, clip: { x: 0, y: 0, width: 1300, height: 700 } });
await b.close();
