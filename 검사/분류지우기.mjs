import { chromium } from "playwright";
const OUT = process.argv[2] || ".";
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
    out.push((세부 ? "└ " : "") + (await r.locator(".navitem").first().innerText()).replace(/[⠿\n]/g," ").trim());
  }
  return out;
};
console.log("처음:", (await 목록()).join(" | "));

// ① 비어 있는 기본 분류 지우기 (기획서)
const 메뉴열기 = async (n) => {
  const 줄 = pg.locator(".navrow").nth(n);
  await 줄.hover(); await pg.waitForTimeout(250);
  await 줄.locator(".rowbtn").last().click(); await pg.waitForTimeout(400);
};
await 메뉴열기(3);
console.log("줄 메뉴에 삭제:", await pg.locator(".rowmenu").getByRole("button", { name: "삭제" }).count() ? "있음 ✓" : "없음 ✗");
await pg.locator(".rowmenu").getByRole("button", { name: "삭제" }).click(); await pg.waitForTimeout(700);
console.log("지운 뒤:", (await 목록()).join(" | "));
console.log("치워 둔 칸:", (await pg.locator(".hiddencats .navitem").allTextContents()).map(t=>t.replace(/\s+/g," ").trim()).join(" | "));

// ② 제안서(1건 들어 있음) 지우기 → 그 1건은 살아남아야 한다
const 건수 = await pg.evaluate(() => JSON.parse(localStorage.getItem("mtmb-studio-v1")||"{}").projects?.length ?? "?");
await 메뉴열기(0);
await pg.locator(".rowmenu").getByRole("button", { name: "삭제" }).click(); await pg.waitForTimeout(800);
console.log("지운 뒤:", (await 목록()).join(" | "));
await pg.waitForTimeout(6500);
const 건수후 = await pg.evaluate(() => JSON.parse(localStorage.getItem("mtmb-studio-v1")||"{}").projects?.length ?? "?");
console.log("제안서 건수:", 건수, "→", 건수후, 건수 === 건수후 ? "✓ 안 사라짐" : "✗ 사라짐");

// ③ 되돌리기
await pg.locator(".hiddencats .navitem").first().click(); await pg.waitForTimeout(700);
console.log("되돌린 뒤:", (await 목록()).join(" | "));
await pg.locator(".dash-nav").screenshot({ path: `${OUT}/분류지우기.png` });
await b.close();
