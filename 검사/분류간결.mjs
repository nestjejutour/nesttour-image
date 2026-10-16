import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1700, height: 1000 }, deviceScaleFactor: 1.2 });
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
    out.push((세부 ? "   └ " : "") + (await r.locator(".navitem").first().innerText()).replace(/[⠿\n]/g," ").trim());
  }
  return out;
};

console.log("머리줄 + :", await pg.locator(".secadd").count() ? "있음 ✓" : "없음 ✗");
console.log("줄마다 + :", await pg.locator(".addsub").count(), "개");

// 큰 분류 넣기
await pg.locator(".secadd").click(); await pg.waitForTimeout(400);
console.log("고르는 칸 남았나:", await pg.locator(".dash-nav select").count() ? "남음 ✗" : "없음 ✓");
await pg.locator(".catnew").fill("현수막");
await pg.locator(".catnew").press("Enter"); await pg.waitForTimeout(700);
await pg.locator(".catnew").press("Escape"); await pg.waitForTimeout(400);

// 제안서 안에 세부 분류
await pg.locator(".navrow").nth(0).locator(".addsub").click(); await pg.waitForTimeout(400);
for (const n of ["공공기관", "민간기업"]) {
  await pg.locator(".catnew.세부").fill(n);
  await pg.locator(".catnew.세부").press("Enter"); await pg.waitForTimeout(600);
}
await pg.locator(".catnew.세부").press("Escape"); await pg.waitForTimeout(400);
console.log("\n" + (await 목록()).join("\n"));
await pg.locator(".dash-nav").screenshot({ path: `${OUT}/분류간결.png` });
await b.close();
