import { chromium } from "playwright";
const OUT = process.argv[2] || ".";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1700, height: 1000 }, deviceScaleFactor: 1.2 });
pg.on("pageerror", e => console.log("✗ 페이지오류:", e.message));

await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await pg.evaluate(() => localStorage.clear());
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1800);

const 차례 = async () =>
  (await pg.locator(".navrow .navitem").allTextContents()).map(t => t.replace(/[⠿\d참고\s]/g, "")).filter(Boolean);
console.log("처음:", (await 차례()).join(" → "));

// ① 끌어서 옮긴다 — 셋째 줄을 첫째 자리로
const 끌것 = pg.locator(".navrow").nth(2);
const 놓을곳 = pg.locator(".navrow").nth(0);
await 끌것.dragTo(놓을곳);
await pg.waitForTimeout(900);
console.log("끌어 옮긴 뒤:", (await 차례()).join(" → "));

// ② 이름 칸의 위로·아래로
await pg.locator(".navrow .navitem").nth(1).dblclick(); await pg.waitForTimeout(500);
await pg.getByRole("button", { name: "↓ 아래로" }).click(); await pg.waitForTimeout(700);
console.log("아래로 누른 뒤:", (await 차례()).join(" → "));

// ③ 새로고침해도 남는가
await pg.waitForTimeout(6500);
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1800);
console.log("새로고침 뒤:", (await 차례()).join(" → "));
await pg.locator(".dash-nav").screenshot({ path: `${OUT}/분류차례.png` });
await b.close();
