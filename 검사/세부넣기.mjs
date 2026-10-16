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

// ① + 분류 추가 → "제안서 안에 넣기"
await pg.getByRole("button", { name: "+ 분류 추가" }).click(); await pg.waitForTimeout(400);
console.log("넣을 자리 고르는 칸:", await pg.locator(".catedit select").first().count() ? "있음 ✓" : "없음 ✗");
console.log("고를 수 있는 자리:", (await pg.locator(".catedit select").first().locator("option").allTextContents()).join(" / "));
await pg.locator(".catedit select").first().selectOption({ label: "제안서 안에 넣기" }); await pg.waitForTimeout(300);
for (const n of ["공공기관", "민간기업"]) {
  await pg.locator(".catedit input").fill(n);
  await pg.locator(".catedit input").press("Enter");
  await pg.waitForTimeout(600);
}
await pg.getByRole("button", { name: "닫기" }).first().click(); await pg.waitForTimeout(500);
console.log("\n넣은 뒤:\n" + (await 목록()).join("\n"));

// ② 줄 끝의 + 로도 되는가
await pg.locator(".navrow").nth(3).hover(); await pg.waitForTimeout(300);
await pg.locator(".navrow").nth(3).locator(".addsub").click(); await pg.waitForTimeout(400);
await pg.locator(".catedit.세부 input").fill("연회");
await pg.locator(".catedit.세부 input").press("Enter"); await pg.waitForTimeout(700);
await pg.locator(".catedit.세부").getByRole("button", { name: "닫기" }).click(); await pg.waitForTimeout(500);
console.log("\n줄 끝 + 로 넣은 뒤:\n" + (await 목록()).join("\n"));
await pg.locator(".dash-nav").screenshot({ path: `${OUT}/세부넣기.png` });
await b.close();
