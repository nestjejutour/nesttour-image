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
const 현수막줄 = pg.locator(".navrow").filter({ hasText: "현수막" }).first();
await 현수막줄.hover();
await 현수막줄.locator(".rowbtn").first().click(); await pg.waitForTimeout(400);
await pg.locator(".catnew.세부").fill("개인");
await pg.locator(".catnew.세부").press("Enter"); await pg.waitForTimeout(600);
await pg.locator(".catnew.세부").press("Escape"); await pg.waitForTimeout(400);
await pg.getByRole("button", { name: /개인/ }).first().click(); await pg.waitForTimeout(600);

console.log("자료함 있나:", await pg.locator(".lib").count() ? "있음 ✓" : "없음 ✗");
// 분류를 고르기 전에는 받지 않아야 한다 — 어디로 갔는지 모르게 되면 안 된다
await pg.getByRole("button", { name: /^전체/ }).first().click(); await pg.waitForTimeout(500);
console.log("전체일 때 놓는 자리:", (await pg.locator(".libdrop b").innerText()).trim());
console.log("전체일 때 잠겼나:", (await pg.locator(".libdrop").getAttribute("class") || "").includes("잠김") ? "잠김 ✓" : "안 잠김 ✗");
await pg.getByRole("button", { name: /개인/ }).first().click(); await pg.waitForTimeout(500);
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
console.log("머리말:", (await pg.locator(".libhead small").first().innerText()).trim());
console.log("담았다는 알림:", (await pg.locator(".libhead .방금").innerText().catch(() => "(없음)")).trim());
console.log("그림 뽑힌 수:", await pg.locator(".libshot img").count(), "/ 6");
console.log("못 뽑은 것:", (await pg.locator(".nothumb").allTextContents()).join(" | "));
await pg.locator(".lib").screenshot({ path: `${OUT}/자료함.png` });

// 저장하기 — 고른 것만 원본 그대로
console.log("전체 체크 처음:", await pg.locator(".allpick input").isChecked() ? "켜짐 ✓" : "꺼짐 ✗");
console.log("저장 단추:", (await pg.getByRole("button", { name: /내 PC로 저장/ }).innerText()).trim());
console.log("삭제 단추:", (await pg.getByRole("button", { name: /^삭제 \d/ }).innerText()).trim());
// 원본 못 담은 것은 고를 수 없어야 한다
console.log("선택 수:", (await pg.locator(".골랐수").innerText()).trim());
// 둘만 남기고 체크를 푼다
await pg.locator(".allpick input").uncheck(); await pg.waitForTimeout(300);
await pg.locator(".libcard").nth(0).locator(".libpick input").check();
await pg.locator(".libcard").nth(1).locator(".libpick input").check(); await pg.waitForTimeout(300);
console.log("둘만 고른 뒤:", (await pg.getByRole("button", { name: /내 PC로 저장/ }).innerText()).trim(), "/", (await pg.locator(".골랐수").innerText()).trim());
const 받음 = pg.waitForEvent("download", { timeout: 30000 });
await pg.getByRole("button", { name: /내 PC로 저장/ }).click();
const 파일 = await 받음;
console.log("내려받은 것:", 파일.suggestedFilename());
await 파일.saveAs(`${OUT}/${파일.suggestedFilename()}`);

// 하나만 고르면 원본 그대로
await pg.locator(".libcard").nth(1).locator(".libpick input").uncheck(); await pg.waitForTimeout(300);
const 받음2 = pg.waitForEvent("download", { timeout: 30000 });
await pg.getByRole("button", { name: /내 PC로 저장/ }).click();
const 파일2 = await 받음2;
console.log("하나만:", 파일2.suggestedFilename());
await pg.locator(".allpick input").check(); await pg.waitForTimeout(300);

// 옮기기 메뉴
await pg.locator(".libmore").first().click(); await pg.waitForTimeout(400);
const 묶음 = await pg.locator(".movepick optgroup").evaluateAll((els) =>
  els.map((e) => `${e.getAttribute("label")}: ${[...e.children].map((o) => o.textContent).join(", ")}`));
console.log("폴더 이동 묶음:", 묶음.join(" | ") || "(없음)");
console.log("메뉴 글자:", (await pg.locator(".rowmenu").innerText()).replace(/\n+/g," / ").trim());
await pg.screenshot({ path: `${OUT}/옮기기.png`, clip: { x: 250, y: 150, width: 820, height: 560 } });
await pg.locator(".libhead b").click({ force: true }); await pg.waitForTimeout(400);

// 한 장 열어 보기
await pg.locator(".libshot").first().click(); await pg.waitForTimeout(800);
console.log("한 장 화면:", await pg.locator(".한장").count() ? "열림 ✓" : "안 열림 ✗");
console.log("머리말:", (await pg.locator(".한장머리").innerText()).replace(/\n/g," ").trim());
console.log("항목:", (await pg.locator(".한장표 dt").allTextContents()).join(" | "));
console.log("단추:", (await pg.locator(".한장옆 .btn").allTextContents()).join(" | "));
// 메모를 적어 본다
await pg.locator(".한장옆 textarea").fill("야외용 · 400x90");
await pg.locator(".한장옆 textarea").blur(); await pg.waitForTimeout(500);
// 옆으로 넘긴다
await pg.locator(".넘김").last().click(); await pg.waitForTimeout(600);
console.log("넘긴 뒤:", (await pg.locator(".한장머리").innerText()).replace(/\n/g," ").trim());
await pg.screenshot({ path: `${OUT}/자료한장.png` });
await pg.locator(".한장").click({ position: { x: 10, y: 10 } }); await pg.waitForTimeout(400);
await pg.waitForTimeout(6500);
console.log("메모 남았나:", await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  return (d.library || []).find((x) => x.note)?.note ?? "(없음)";
}));

// 이름으로 찾기
await pg.locator(".libfind").fill("현수막-3"); await pg.waitForTimeout(500);
console.log("찾기:", await pg.locator(".libcard").count(), "개 남음");
await pg.locator(".libfind").fill(""); await pg.waitForTimeout(400);

// 일괄 삭제 — 둘만 고르고 지운다
pg.on("dialog", (d) => { console.log("✗ 브라우저 창이 떴다(틀 안에서는 막힌다):", d.message()); d.dismiss(); });
await pg.locator(".allpick input").uncheck(); await pg.waitForTimeout(300);
await pg.locator(".libcard").nth(0).locator(".libpick input").check();
await pg.locator(".libcard").nth(1).locator(".libpick input").check(); await pg.waitForTimeout(300);
await pg.getByRole("button", { name: /^삭제 \d/ }).click(); await pg.waitForTimeout(400);
console.log("한 번 더 묻나:", (await pg.locator(".정말 b").innerText().catch(() => "(안 물음 ✗)")).trim());
await pg.locator(".정말").getByRole("button", { name: "삭제" }).click(); await pg.waitForTimeout(1200);
console.log("\n일괄 삭제 뒤 남은 자료:", await pg.locator(".libcard").count(), "개 (6 → 4 여야 한다)");

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
