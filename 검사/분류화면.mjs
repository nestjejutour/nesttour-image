import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const OUT = process.argv[2] || ".";
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

const 꼴 = async (이름) => {
  const 머리 = await pg.locator(".dash-main section .rowhead .sec").allTextContents();
  const 건수 = await pg.locator(".dash-main section .rowhead .cnt").allTextContents();
  const 카드 = await pg.locator(".dash-main .cards .cardwrap, .dash-main .strip .cardwrap").count();
  const 빈 = await pg.locator(".빈자리").count();
  const 자료 = await pg.locator(".lib").count();
  return `${이름}: 제안서칸[${머리.join(",")} ${건수.join(",")}] 카드${카드} 빈자리${빈} 자료칸${자료}`;
};

// 제안서 분류 — 본보기
await pg.getByRole("button", { name: /^제안서/ }).first().click(); await pg.waitForTimeout(700);
console.log(await 꼴("제안서"));

// 현수막 분류를 만들고 자료를 넣는다
await pg.locator(".secadd").click(); await pg.waitForTimeout(400);
await pg.locator(".catnew").fill("현수막");
await pg.locator(".catnew").press("Enter"); await pg.waitForTimeout(700);
await pg.locator(".catnew").press("Escape"); await pg.waitForTimeout(400);
await pg.getByRole("button", { name: /현수막/ }).first().click(); await pg.waitForTimeout(700);
console.log(await 꼴("현수막(빈)"), "← 제안서칸이 서야 한다");

await pg.locator(".libdrop").evaluate((el, 짐) => {
  const dt = new DataTransfer();
  for (const f of 짐) {
    const bin = atob(f.b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    dt.items.add(new File([u8], f.name, { type: "application/octet-stream" }));
  }
  el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
}, 짐);
await pg.waitForFunction(() => document.querySelectorAll(".libcard").length >= 2, null, { timeout: 40000 });
await pg.waitForTimeout(900);
console.log(await 꼴("현수막(자료2)"));
console.log("빈자리 단추:", (await pg.locator(".빈자리 .btn").allTextContents()).join(" | "));
console.log("옆줄 숫자:", (await pg.locator(".navrow .navitem").allTextContents()).map(t=>t.replace(/\n/g," ").trim()).join(" | "));
await pg.screenshot({ path: `${OUT}/분류화면.png`, clip: { x: 0, y: 60, width: 1300, height: 900 } });

// 제안서를 현수막으로 옮긴다
await pg.getByRole("button", { name: /^제안서/ }).first().click(); await pg.waitForTimeout(700);
await pg.locator(".cardwrap").first().hover(); await pg.waitForTimeout(300);
console.log("\n옮기기 단추:", await pg.locator(".cardmove").count() ? "있음 ✓" : "없음 ✗");
await pg.locator(".cardmove").first().click(); await pg.waitForTimeout(400);
console.log("고를 수 있는 곳:", (await pg.locator(".cardask select option").allTextContents()).join(" / "));
await pg.locator(".cardask select").selectOption({ label: "현수막" }); await pg.waitForTimeout(900);
console.log("옮긴 뒤 제안서 분류:", await 꼴("제안서"));
await pg.getByRole("button", { name: /현수막/ }).first().click(); await pg.waitForTimeout(700);
console.log("옮긴 뒤 현수막 분류:", await 꼴("현수막"), "← 카드 1 이어야 한다");
await pg.waitForTimeout(6500);
console.log("기록:", await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  return (d.trail || []).slice(-1).map((t) => `${t.whoName} ${t.what} ${t.projectTitle}`)[0] ?? "(없음)";
}));

// 전체에서는 빈 분류가 접혀 있어야 한다
await pg.getByRole("button", { name: /^전체/ }).first().click(); await pg.waitForTimeout(700);
console.log(await 꼴("전체"), "← 빈 분류는 접혀 있어야 한다");
await b.close();
