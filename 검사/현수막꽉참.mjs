import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const OUT = "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad";
const 터 = "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad/현수막";
const 짐 = [{ name: "현수막-1.ai", b64: readFileSync(`${터}/현수막-1.ai`).toString("base64") }];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1700, height: 1050 }, deviceScaleFactor: 1.2 });
pg.on("pageerror", e => console.log("✗ 페이지오류:", e.message));
await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await pg.evaluate(() => localStorage.clear());
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1200);
await pg.locator(".namebox").fill("박시영"); await pg.locator(".pinbox").fill("2230");
await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1500);
await pg.locator(".secadd").click(); await pg.waitForTimeout(400);
await pg.locator(".catnew").fill("현수막");
await pg.locator(".catnew").press("Enter"); await pg.waitForTimeout(700);
await pg.locator(".catnew").press("Escape"); await pg.waitForTimeout(400);
await pg.getByRole("button", { name: /현수막/ }).first().click(); await pg.waitForTimeout(700);
await pg.locator(".빈자리").evaluate((el, 짐) => {
  const dt = new DataTransfer();
  for (const f of 짐) {
    const bin = atob(f.b64); const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    dt.items.add(new File([u8], f.name, { type: "application/octet-stream" }));
  }
  el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
}, 짐);
await pg.waitForFunction(() => document.querySelectorAll(".dash-main .cardwrap").length >= 1, null, { timeout: 60000 });
await pg.waitForTimeout(1200);
await pg.locator(".cardwrap").first().click(); await pg.waitForTimeout(1800);

const 잼 = await pg.evaluate(() => {
  const 판 = document.querySelector(".browse-stage .stage-inner > *");
  const 그림 = document.querySelector(".browse-stage .stage-inner img");
  if (!판 || !그림) return null;
  const a = 판.getBoundingClientRect(), b = 그림.getBoundingClientRect();
  return {
    판: `${Math.round(a.width)}×${Math.round(a.height)}`,
    그림: `${Math.round(b.width)}×${Math.round(b.height)}`,
    꽉참: Math.abs(b.width - a.width) < 3 && Math.abs(b.height - a.height) < 3,
  };
});
console.log("판:", 잼?.판, "· 그림:", 잼?.그림, 잼?.꽉참 ? "← 꽉 참 ✓" : "← 안 참 ✗");
await pg.locator(".browse-stage").screenshot({ path: `${OUT}/꽉참.png` });
await b.close();
