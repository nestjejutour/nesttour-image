import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const OUT = process.argv[2] || "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad";
const 터 = "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad/현수막";
const 짐 = ["현수막-1.ai", "현수막-2.ai"].map((n) => ({ name: n, b64: readFileSync(`${터}/${n}`).toString("base64") }));

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

// 현수막 분류를 만들고 "인쇄물" 로 바꾼다
await pg.locator(".secadd").click(); await pg.waitForTimeout(400);
await pg.locator(".catnew").fill("현수막");
await pg.locator(".catnew").press("Enter"); await pg.waitForTimeout(700);
await pg.locator(".catnew").press("Escape"); await pg.waitForTimeout(400);
const 줄 = pg.locator(".navrow").filter({ hasText: "현수막" }).first();
await 줄.hover(); await 줄.locator(".rowbtn").last().click(); await pg.waitForTimeout(400);
console.log("메뉴:", (await pg.locator(".rowmenu button").allTextContents()).map(t=>t.trim()).join(" / "));
// 이름이 "현수막" 이면 만들 때 이미 인쇄물로 잡힌다. 그러면 이 메뉴가 없다.
if (await pg.getByRole("button", { name: "인쇄물(현수막) 분류로" }).count()) {
  await pg.getByRole("button", { name: "인쇄물(현수막) 분류로" }).click();
} else {
  await pg.keyboard.press("Escape");   // 메뉴만 닫는다
}
await pg.waitForTimeout(700);
await pg.getByRole("button", { name: /현수막/ }).first().click(); await pg.waitForTimeout(700);
console.log("머리말:", (await pg.locator(".dash-main section .rowhead").first().innerText()).replace(/\n/g," ").trim());
console.log("빈자리 말:", (await pg.locator(".빈자리 b").innerText()).trim());

// 자료를 담아 치수가 cm 로 나오는지
await pg.locator(".libdrop").evaluate((el, 짐) => {
  const dt = new DataTransfer();
  for (const f of 짐) {
    const bin = atob(f.b64); const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    dt.items.add(new File([u8], f.name, { type: "application/octet-stream" }));
  }
  el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
}, 짐);
await pg.waitForFunction(() => document.querySelectorAll(".libcard").length >= 2, null, { timeout: 40000 });
await pg.waitForTimeout(900);
console.log("자료 규격:", (await pg.locator(".libname small").allTextContents()).map(t=>t.trim()).join(" | "));

// 신규 등록 → 규격을 묻는가
await pg.locator(".빈자리").getByRole("button", { name: "신규 등록" }).click(); await pg.waitForTimeout(900);
console.log("\n규격 화면 제목:", (await pg.locator("h1").first().innerText()).trim());
console.log("흔한 규격:", (await pg.locator(".pick span").allTextContents()).join(" | "));
await pg.locator(".pick").filter({ hasText: "300 × 70" }).click(); await pg.waitForTimeout(300);
await pg.locator(".field input").nth(2).fill("정가네 식구들 제주여행");
await pg.screenshot({ path: `${OUT}/규격묻기.png`, clip: { x: 230, y: 60, width: 1070, height: 620 } });
await pg.getByRole("button", { name: "이 규격으로 시작" }).click(); await pg.waitForTimeout(2000);

const 판 = await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  const p = (d.projects || []).find((x) => x.title.includes("정가네"));
  const s = p?.styleOverride?.slide;
  return p ? { 이름: p.title, 가로인치: s?.widthIn, 세로인치: s?.heightIn } : null;
});
await pg.waitForTimeout(6500);
const 판2 = await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  const p = (d.projects || []).find((x) => x.title.includes("정가네"));
  const s = p?.styleOverride?.slide;
  return p ? `${p.title} — ${(s.widthIn*2.54).toFixed(1)}×${(s.heightIn*2.54).toFixed(1)}cm` : "(없음)";
});
console.log("만들어진 작업물:", 판2, "← 300.0×70.0cm 여야 한다");
await b.close();
