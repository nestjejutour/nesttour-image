import { chromium } from "playwright";
import { readdirSync, readFileSync } from "node:fs";
const OUT = process.argv[2] || ".";
const 터 = "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad/현수막";
const 짐 = readdirSync(터).map((n) => ({ name: n, b64: readFileSync(`${터}/${n}`).toString("base64") }));

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1700, height: 1000 } });
pg.on("pageerror", e => console.log("✗ 페이지오류:", e.message));
await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await pg.evaluate(() => localStorage.clear());
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1200);
await pg.locator(".namebox").fill("박시영"); await pg.locator(".pinbox").fill("2230");
await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1500);

// 현수막 > 개인 을 만든다
await pg.locator(".secadd").click(); await pg.waitForTimeout(400);
await pg.locator(".catnew").fill("현수막");
await pg.locator(".catnew").press("Enter"); await pg.waitForTimeout(700);
await pg.locator(".catnew").press("Escape"); await pg.waitForTimeout(400);
const 줄 = pg.locator(".navrow").filter({ hasText: "현수막" }).first();
await 줄.hover(); await 줄.locator(".rowbtn").first().click(); await pg.waitForTimeout(400);
await pg.locator(".catnew.세부").fill("개인");
await pg.locator(".catnew.세부").press("Enter"); await pg.waitForTimeout(600);
await pg.locator(".catnew.세부").press("Escape"); await pg.waitForTimeout(400);
await pg.getByRole("button", { name: /개인/ }).first().click(); await pg.waitForTimeout(600);

// "+ 파일 추가" 로 고른 것과 똑같은 일을 일으킨다 (input.files 에 꽂고 change)
console.log("고르기 창 열리나:", await (async () => {
  const 창 = pg.waitForEvent("filechooser", { timeout: 8000 });
  await pg.getByText("+ 파일 추가").click();
  const fc = await 창;
  return fc.isMultiple() ? "열림 · 여러 개 ✓" : "열림 · 하나만 ✗";
})());
await pg.keyboard.press("Escape"); await pg.waitForTimeout(300);

const 꽂혔나 = await pg.locator(".libhead input[type=file]").evaluate((el, 짐) => {
  const dt = new DataTransfer();
  for (const f of 짐) {
    const bin = atob(f.b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    dt.items.add(new File([u8], f.name, { type: "application/octet-stream" }));
  }
  el.files = dt.files;                               // 고르기 창이 돌려주는 것과 같다
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return el.files.length;
}, 짐);
console.log("칸에 꽂힌 파일:", 꽂혔나, "개");

await pg.waitForFunction(() => document.querySelectorAll(".libcard").length >= 6, null, { timeout: 60000 });
await pg.waitForTimeout(1000);
console.log("담긴 자료:", await pg.locator(".libcard").count(), "개");
console.log("알림:", (await pg.locator(".libhead .방금").innerText().catch(() => "(없음)")).trim());

// 어느 분류에 들어갔는가 — 이게 핵심이다
await pg.waitForTimeout(6500);
const 들어간곳 = await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  const 이름 = (id) => (d.categories || []).find((c) => c.id === id)?.name ?? id;
  const 셈 = {};
  for (const x of d.library || []) 셈[이름(x.categoryId)] = (셈[이름(x.categoryId)] ?? 0) + 1;
  return 셈;
});
console.log("들어간 분류:", JSON.stringify(들어간곳), "← 개인 이어야 한다");
console.log("원본 품은 수:", await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  return (d.library || []).filter((x) => x.hasFile).length;
}));
await pg.locator(".lib").screenshot({ path: `${OUT}/파일추가.png` });
await b.close();
