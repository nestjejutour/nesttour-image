import { chromium } from "playwright";
const OUT = process.argv[2] || "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1700, height: 1050 }, deviceScaleFactor: 1.2 });
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

// 제안서 14건을 만들어 둔다 (씨앗 1 + 13 복제)
await pg.evaluate(() => {
  const KEY = "mtmb-studio-v1";
  const d = JSON.parse(localStorage.getItem(KEY) || "{}");
  const 씨 = d.projects[0];
  const cats = d.categories.map((c) => c.id);
  for (let i = 1; i <= 13; i++) {
    d.projects.push({ ...씨, id: "p" + i, title: `시험 제안서 ${i}`,
      category: cats[i % cats.length],
      updatedAt: new Date(Date.now() - i * 60000).toISOString() });
  }
  localStorage.setItem(KEY, JSON.stringify(d));
});
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1800);
// 새로고침하면 다시 작업대로 열린다. 서류함을 보려면 한 번 눌러야 한다.
if (await pg.locator(".시작판").count()) {
  await pg.getByRole("button", { name: /보관함 보기/ }).click();
  await pg.waitForTimeout(800);
}

console.log("[전체] 머리말:", (await pg.locator(".dash-main section .rowhead").first().innerText()).replace(/\n/g," ").trim());
console.log("[전체] 카드 수:", await pg.locator(".dash-main .cardwrap").count(), "← 10 이어야 한다");
console.log("[전체] 분류 이름 붙었나:", (await pg.locator(".card .meta small b.어디").allTextContents()).slice(0,4).join(" | ") || "(없음 ✗)");
console.log("[전체] 더 있다는 안내:", (await pg.locator(".dash-main section .lede").innerText().catch(() => "(없음)")).trim());
console.log("[전체] 분류별 묶음 수:", await pg.locator(".dash-main section").count(), "← 1 이어야 한다");
await pg.screenshot({ path: `${OUT}/전체화면.png`, clip: { x: 0, y: 60, width: 1300, height: 900 } });

// 분류를 고르면 그 분류 것이 다 보인다
await pg.getByRole("button", { name: /^제안서/ }).first().click(); await pg.waitForTimeout(800);
console.log("\\n[제안서] 머리말:", (await pg.locator(".dash-main section .rowhead").first().innerText()).replace(/\n/g," ").trim());
console.log("[제안서] 카드 수:", await pg.locator(".dash-main .cardwrap").count());
await b.close();
