import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const OUT = process.argv[2] || "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad";
const 터 = "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad/현수막";
const 짐 = ["현수막-1.ai", "현수막-2.ai", "현수막-3.ai"].map((n) => ({ name: n, b64: readFileSync(`${터}/${n}`).toString("base64") }));

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

// 현수막 분류를 만들고 인쇄물로
await pg.locator(".secadd").click(); await pg.waitForTimeout(400);
await pg.locator(".catnew").fill("현수막");
await pg.locator(".catnew").press("Enter"); await pg.waitForTimeout(700);
await pg.locator(".catnew").press("Escape"); await pg.waitForTimeout(400);
const 줄 = pg.locator(".navrow").filter({ hasText: "현수막" }).first();
await 줄.hover(); await 줄.locator(".rowbtn").last().click(); await pg.waitForTimeout(400);
// 이름이 "현수막" 이면 만들 때 이미 인쇄물로 잡힌다. 그러면 이 메뉴가 없다.
if (await pg.getByRole("button", { name: "인쇄물(현수막) 분류로" }).count()) {
  await pg.getByRole("button", { name: "인쇄물(현수막) 분류로" }).click();
} else {
  await pg.keyboard.press("Escape");   // 메뉴만 닫는다
}
await pg.waitForTimeout(700);
await pg.getByRole("button", { name: /현수막/ }).first().click(); await pg.waitForTimeout(700);

// 빈 자리에 완성본 3장을 끌어다 놓는다 → 위 칸에 3건이 서야 한다
await pg.locator(".빈자리").evaluate((el, 짐) => {
  const dt = new DataTransfer();
  for (const f of 짐) {
    const bin = atob(f.b64); const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    dt.items.add(new File([u8], f.name, { type: "application/octet-stream" }));
  }
  el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
}, 짐);
await pg.waitForFunction(() => document.querySelectorAll(".dash-main .cardwrap").length >= 3, null, { timeout: 60000 });
await pg.waitForTimeout(1200);

console.log("위 칸 작업물:", await pg.locator(".dash-main .cardwrap").count(), "건 ← 3 이어야 한다");
console.log("이름:", (await pg.locator(".card .meta b").allTextContents()).map(t=>t.trim()).join(" | "));
console.log("아래 자료함:", await pg.locator(".lib .libcard").count(), "개 ← 0 이어야 한다 (위로 갔으니)");
console.log("머리말:", (await pg.locator(".dash-main section .rowhead").first().innerText()).replace(/\n/g," ").trim());
await pg.screenshot({ path: `${OUT}/완성본등록.png`, clip: { x: 230, y: 60, width: 1070, height: 760 } });

await pg.waitForTimeout(7000);
const 잰것 = await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  return (d.projects || []).filter((p) => p.styleOverride?.slide).map((p) => {
    const s = p.styleOverride.slide;
    return `${p.title} ${(s.widthIn*2.54).toFixed(0)}×${(s.heightIn*2.54).toFixed(0)}cm`;
  });
});
console.log("\n저장된 규격:", 잰것.join(" | "));
console.log("건별 자료(원본):", await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  return (d.library || []).filter((x) => x.projectId && x.hasFile).length;
}), "개 ← 3 이어야 한다");

// 한 건을 열면 그 그림이 보이고 그 건의 자료에 원본이 있어야 한다
await pg.locator(".cardwrap").first().click(); await pg.waitForTimeout(1500);
console.log("연 뒤 이 건의 자료:", await pg.locator(".browse-docs .libcard").count(), "개 ← 1 이어야 한다");
// 화면에 들어가는가 — 400×90cm 가 네 배 크게 나오면 안 된다
const 담김 = await pg.evaluate(() => {
  const 무대 = document.querySelector(".browse-stage");
  const 판 = document.querySelector(".browse-stage .stage-inner > *");
  if (!무대 || !판) return null;
  const a = 무대.getBoundingClientRect(), b = 판.getBoundingClientRect();
  return { 무대: Math.round(a.width), 판: Math.round(b.width), 넘치나: b.width > a.width + 2 };
});
console.log("무대 너비:", 담김?.무대, "· 판 너비:", 담김?.판, 담김?.넘치나 ? "← 넘침 ✗" : "← 들어감 ✓");
await pg.screenshot({ path: `${OUT}/완성본열기.png` });
await b.close();
