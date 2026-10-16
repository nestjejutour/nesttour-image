import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const OUT = process.argv[2] || "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad";
const 터 = "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad/현수막";
const 짐 = (이름들) => 이름들.map((n) => ({ name: n, b64: readFileSync(`${터}/${n}`).toString("base64") }));
const 놓기 = async (pg, 곳, 것) => {
  await pg.locator(곳).evaluate((el, 것) => {
    const dt = new DataTransfer();
    for (const f of 것) {
      const bin = atob(f.b64); const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      dt.items.add(new File([u8], f.name, { type: "application/octet-stream" }));
    }
    el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, 것);
};

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1700, height: 1050 }, deviceScaleFactor: 1.2 });
pg.on("pageerror", e => console.log("✗ 페이지오류:", e.message));
await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await pg.evaluate(() => localStorage.clear());
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1200);
await pg.locator(".namebox").fill("박시영"); await pg.locator(".pinbox").fill("2230");
await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1500);

// 제안서 분류에 분류 자료 2개를 담는다
await pg.getByRole("button", { name: /^제안서/ }).first().click(); await pg.waitForTimeout(700);
await 놓기(pg, ".libdrop", 짐(["현수막-1.ai", "현수막-2.ai"]));
await pg.waitForFunction(() => document.querySelectorAll(".libcard").length >= 2, null, { timeout: 40000 });
await pg.waitForTimeout(800);
console.log("분류 자료함:", await pg.locator(".libcard").count(), "개");

// 제안서 한 건을 연다
await pg.locator(".cardwrap").first().click(); await pg.waitForTimeout(1200);
console.log("\n한 건 열림:", await pg.locator(".browse").count() ? "예 ✓" : "아니오 ✗");
console.log("장 수:", await pg.locator(".filmstrip .frame").count());
console.log("이 건의 자료함:", await pg.locator(".browse-docs .lib").count() ? "있음 ✓" : "없음 ✗");
console.log("머리말:", (await pg.locator(".browse-docs .libhead b").innerText()).trim());
console.log("이 건의 자료 수:", await pg.locator(".browse-docs .libcard").count(), "← 0 이어야 한다 (분류 자료와 섞이면 안 된다)");

// 이 건에 자료 3개를 담는다
await 놓기(pg, ".browse-docs .libdrop", 짐(["현수막-3.ai", "현수막-4.ai", "현수막-5.ai"]));
await pg.waitForFunction(() => document.querySelectorAll(".browse-docs .libcard").length >= 3, null, { timeout: 40000 });
await pg.waitForTimeout(900);
console.log("담은 뒤 이 건의 자료:", await pg.locator(".browse-docs .libcard").count(), "개");
await pg.locator(".browse-docs").scrollIntoViewIfNeeded();
await pg.screenshot({ path: `${OUT}/건별자료함.png` });

// 분류로 돌아가면 분류 자료만 보여야 한다
await pg.getByRole("button", { name: "← 보관함" }).click(); await pg.waitForTimeout(1000);
console.log("\n분류로 돌아온 뒤 분류 자료:", await pg.locator(".libcard").count(), "개 ← 2 여야 한다");

// 다시 열면 그 건의 자료가 그대로
await pg.locator(".cardwrap").first().click(); await pg.waitForTimeout(1200);
console.log("다시 연 뒤 이 건의 자료:", await pg.locator(".browse-docs .libcard").count(), "개 ← 3 이어야 한다");
await pg.waitForTimeout(6500);
console.log("저장된 모습:", await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  const 건 = (d.library || []).filter((x) => x.projectId).length;
  const 분 = (d.library || []).filter((x) => !x.projectId).length;
  return `건별 ${건}개 · 분류 ${분}개`;
}));
await b.close();
