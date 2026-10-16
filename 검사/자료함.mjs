import { chromium } from "playwright";
import { readdirSync, readFileSync } from "node:fs";
const OUT = process.argv[2] || ".";
const 터 = "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad/현수막";
const 파일들 = readdirSync(터).map((n) => `${터}/${n}`);

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1700, height: 1050 }, deviceScaleFactor: 1.2 });
pg.on("pageerror", e => console.log("✗ 페이지오류:", e.message));
await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await pg.evaluate(() => localStorage.clear());
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1200);
await pg.locator(".namebox").fill("박시영"); await pg.locator(".pinbox").fill("2230");
await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1500);

// 현수막 분류를 만들고 고른다
await pg.locator(".secadd").click(); await pg.waitForTimeout(400);
await pg.locator(".catnew").fill("현수막");
await pg.locator(".catnew").press("Enter"); await pg.waitForTimeout(700);
await pg.locator(".catnew").press("Escape"); await pg.waitForTimeout(400);
await pg.getByRole("button", { name: /현수막/ }).first().click(); await pg.waitForTimeout(600);

console.log("자료함 있나:", await pg.locator(".lib").count() ? "있음 ✓" : "없음 ✗");
console.log("놓는 자리 안내:", (await pg.locator(".libdrop small").innerText()).trim().split(".")[0]);

// 파일 넣기 — 진짜로 끌어다 놓는다
const 짐 = 파일들.map((p) => ({ name: p.split("/").pop(), b64: readFileSync(p).toString("base64") }));
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
await pg.waitForTimeout(900);
console.log("담는 중 표시:", await pg.locator(".libbar").count() ? "보임 ✓" : "안 보임");
await pg.waitForFunction(() => document.querySelectorAll(".libcard").length >= 6, null, { timeout: 60000 });
await pg.waitForTimeout(1200);

const 이름들 = (await pg.locator(".libname b").allTextContents()).join(" | ");
console.log("담긴 것:", 이름들);
console.log("머리말:", (await pg.locator(".libhead small").innerText()).trim());
console.log("그림 뽑힌 수:", await pg.locator(".libshot img").count(), "/ 6");
console.log("못 뽑은 것:", (await pg.locator(".nothumb").allTextContents()).join(" | "));
await pg.locator(".lib").screenshot({ path: `${OUT}/자료함.png` });

// 크게 보기
await pg.locator(".libshot").first().click(); await pg.waitForTimeout(700);
console.log("크게 보기:", await pg.locator(".bigview").count() ? "열림 ✓" : "안 열림 ✗");
console.log("크게 머리말:", (await pg.locator(".bigbar").innerText()).replace(/\n/g," ").trim());
await pg.screenshot({ path: `${OUT}/자료크게.png`, clip: { x: 300, y: 100, width: 1100, height: 700 } });
await pg.locator(".bigview").click({ position: { x: 10, y: 10 } }); await pg.waitForTimeout(400);

// 이름으로 찾기
await pg.locator(".libfind").fill("현수막-3"); await pg.waitForTimeout(500);
console.log("찾기:", await pg.locator(".libcard").count(), "개 남음");
await pg.locator(".libfind").fill(""); await pg.waitForTimeout(400);

// 저장 칸을 얼마나 먹나
await pg.waitForTimeout(7000);
const 잰것 = await pg.evaluate(() => {
  const raw = localStorage.getItem("mtmb-studio-v1") || "";
  const d = JSON.parse(raw || "{}");
  return { 전체KB: Math.round(raw.length / 1024), 자료수: (d.library || []).length };
});
console.log("\n저장 칸:", 잰것.전체KB, "KB · 자료", 잰것.자료수, "개 (그림은 따로 IndexedDB)");
console.log("→ 100개 담으면 대략", Math.round(잰것.전체KB / Math.max(1, 잰것.자료수) * 100), "KB");

// 새로고침해도 남는가
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(2000);
await pg.getByRole("button", { name: /현수막/ }).first().click(); await pg.waitForTimeout(1200);
console.log("새로고침 뒤 자료:", await pg.locator(".libcard").count(), "개 · 그림", await pg.locator(".libshot img").count(), "장");
await b.close();
