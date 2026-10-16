import { chromium } from "playwright";
const OUT = process.argv[2] || ".";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1700, height: 1000 }, deviceScaleFactor: 1.2 });
pg.on("pageerror", e => console.log("✗ 페이지오류:", e.message));

await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await pg.evaluate(() => localStorage.clear());
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1800);

const 목록 = async () => {
  const rows = await pg.locator(".navrow").all();
  const out = [];
  for (const r of rows) {
    const 세부 = (await r.getAttribute("class") || "").includes("세부");
    const t = (await r.locator(".navitem").first().innerText()).replace(/[⠿\n]/g, " ").trim();
    out.push((세부 ? "   └ " : "") + t);
  }
  return out;
};

// 첫 분류에 세부 분류 세 개를 넣는다
await pg.locator(".navrow .navitem").first().dblclick(); await pg.waitForTimeout(400);
await pg.getByRole("button", { name: "+ 세부 분류" }).click(); await pg.waitForTimeout(400);
for (const 이름 of ["개업", "행사", "계절"]) {
  await pg.locator(".catedit.세부 input").fill(이름);
  await pg.locator(".catedit.세부 input").press("Enter");
  await pg.waitForTimeout(500);
}
await pg.getByRole("button", { name: "닫기" }).first().click(); await pg.waitForTimeout(500);
console.log("넣은 뒤:\n" + (await 목록()).join("\n"));

// 세부 분류끼리 차례 바꾸기 (계절을 개업 자리로)
await pg.locator(".navrow.세부").nth(2).dragTo(pg.locator(".navrow.세부").nth(0));
await pg.waitForTimeout(800);
console.log("\n세부 차례 바꾼 뒤:\n" + (await 목록()).join("\n"));

// 세부 분류를 큰 분류 자리로 끌면 안 움직여야 한다
const 전 = (await 목록()).join("|");
await pg.locator(".navrow.세부").nth(0).dragTo(pg.locator(".navrow").nth(4));
await pg.waitForTimeout(700);
console.log("\n큰 분류 자리로 끌었을 때:", (await 목록()).join("|") === 전 ? "안 움직임 ✓" : "움직임 ✗");

await pg.waitForTimeout(6500);
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1800);
console.log("\n새로고침 뒤:\n" + (await 목록()).join("\n"));
await pg.locator(".dash-nav").screenshot({ path: `${OUT}/세부분류.png` });
await b.close();
