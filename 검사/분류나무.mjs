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

const 목록 = async () => {
  const rows = await pg.locator(".navrow").all();
  const out = [];
  for (const r of rows) {
    const 세부 = (await r.getAttribute("class") || "").includes("세부");
    out.push((세부 ? "  └ " : "") + (await r.locator(".navitem b").first().innerText()).trim());
  }
  return out;
};

// 세부 분류 넣기
await pg.locator(".navrow").nth(0).hover();
await pg.locator(".navrow").nth(0).locator(".rowbtn").first().click(); await pg.waitForTimeout(400);
for (const n of ["공공기관", "민간기업"]) {
  await pg.locator(".catnew.세부").fill(n);
  await pg.locator(".catnew.세부").press("Enter"); await pg.waitForTimeout(600);
}
await pg.locator(".catnew.세부").press("Escape"); await pg.waitForTimeout(400);
console.log("세부 넣은 뒤:\n" + (await 목록()).join("\n"));

// 접기
await pg.locator(".navrow").nth(0).locator(".twist").click(); await pg.waitForTimeout(500);
console.log("\n접은 뒤:", (await 목록()).join(" | "));
await pg.locator(".navrow").nth(0).locator(".twist").click(); await pg.waitForTimeout(500);
console.log("편 뒤:", (await 목록()).join(" | "));

// ⋯ 메뉴
await pg.locator(".navrow").nth(0).hover();
await pg.locator(".navrow").nth(0).locator(".rowbtn").last().click(); await pg.waitForTimeout(500);
console.log("\n메뉴:", (await pg.locator(".rowmenu button").allTextContents()).map(t=>t.replace(/\s+/g," ").trim()).join(" / "));
await pg.screenshot({ path: `${OUT}/분류메뉴.png`, clip: { x: 0, y: 60, width: 300, height: 400 } });

// 이름 바꾸기
await pg.getByRole("button", { name: "이름 변경" }).click(); await pg.waitForTimeout(400);
await pg.locator(".catrename").fill("제안서(수정)");
await pg.locator(".catrename").press("Enter"); await pg.waitForTimeout(700);
console.log("이름 바꾼 뒤:", (await 목록())[0]);

// 지우기
await pg.locator(".navrow").nth(0).hover();
await pg.locator(".navrow").nth(0).locator(".rowbtn").last().click(); await pg.waitForTimeout(400);
await pg.getByRole("button", { name: "삭제" }).click(); await pg.waitForTimeout(700);
console.log("지운 뒤:", (await 목록()).join(" | "));
console.log("치워 둔 칸:", (await pg.locator(".hiddencats .navitem").allTextContents()).map(t=>t.replace(/\s+/g," ").trim()).join(" | "));
await pg.locator(".dash-nav").screenshot({ path: `${OUT}/분류나무.png` });
await b.close();
