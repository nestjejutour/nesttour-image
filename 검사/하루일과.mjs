/**
 * 하루 일과를 그대로 해 본다.
 *
 * 대표가 제안서 한 건, 직원이 현수막 한 건.
 * 되는지 안 되는지가 아니라 "막히는 데가 어디인가" 를 본다.
 * 단계마다 몇 번을 눌러야 했는지, 뭘 몰라서 멈추는지를 적는다.
 */
import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad/일과";
import { mkdirSync } from "node:fs";
mkdirSync(OUT, { recursive: true });

const 걸림 = [];
const 적 = (ok, 말, 덧 = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${말}${덧 ? ` — ${덧}` : ""}`); if (!ok) 걸림.push(말 + (덧 ? ` (${덧})` : "")); };
const 메모 = (말) => { console.log(`  · ${말}`); };

const 그림 = (하늘, 들) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 280">
 <rect width="1600" height="280" fill="${하늘}"/>
 <path d="M0 200 Q400 180 800 200 T1600 190 V280 H0 Z" fill="${들}"/></svg>`;

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1700, height: 1050 }, deviceScaleFactor: 1.1 });
const 터짐 = [];
pg.on("pageerror", (e) => 터짐.push(e.message));

let 부른횟수 = 0;
await pg.route("**/api/ai", async (route) => {
  부른횟수++;
  const sys = (() => { try { return JSON.parse(route.request().postDataBuffer()?.toString("utf8") || "{}").system || ""; } catch { return ""; } })();
  const 현수막인가 = sys.includes("여기는 현수막이다");
  const reply = 현수막인가
    ? { say: "세 가지로 해 봤습니다.", actions: [{ do: "시안", options: [
        { name: "꽃밭", why: "유채꽃을 앞쪽에", content: { art: 그림("#8ECAE6", "#F6D847"), 주제목: "제주 유채꽃 축제", 부제목: "봄이 가장 먼저 닿는 곳", 덧말: "서귀포 가시리" } },
        { name: "차분하게", why: "글자가 먼저", content: { art: 그림("#A7C4CF", "#D8C44A"), 주제목: "제주 유채꽃 축제", 부제목: "봄", 덧말: "가시리" } },
      ] }] }
    : { say: "표지 문구를 다듬었습니다.", actions: [{ do: "내용수정", content: { title: "인천시티투어 온라인 판로 확대 제안" } }] };
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: JSON.stringify(reply) }) });
});

await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await pg.evaluate(() => localStorage.clear());
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1300);

/* ───── 대표: 제안서 한 건 ───── */
console.log("\n[대표] 제안서 한 건");
await pg.locator(".namebox").fill("박시영"); await pg.locator(".pinbox").fill("2230");
await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1600);
// 첫 화면이 "무엇을 만들어 드릴까요?" 작업대로 바뀌었다. 서류함을 보려면 한 번 눌러야 한다.
if (await pg.locator(".시작판").count()) {
  await pg.getByRole("button", { name: /보관함 보기/ }).click();
  await pg.waitForTimeout(700);
}

let 누름 = 0;
await pg.locator(".card").first().click(); 누름++; await pg.waitForTimeout(1200);
적(await pg.getByRole("button", { name: "편집하기" }).count() > 0, "지난 제안서를 열면 편집 단추가 있다");
await pg.getByRole("button", { name: "편집하기" }).click(); 누름++; await pg.waitForTimeout(1600);

await pg.locator(".dock-box textarea").first().fill("표지 제목을 더 힘 있게 바꿔줘");
await pg.locator(".dock-box textarea").first().press("Enter"); 누름++;
await pg.waitForTimeout(3500);
const 고쳐졌나 = await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  return JSON.stringify(d.projects?.[0]?.slides?.[0]?.content ?? {}).includes("판로 확대");
});
적(고쳐졌나, "말로 시키면 그 자리에서 고쳐진다", `${누름}번 눌렀다`);
await pg.screenshot({ path: `${OUT}/01-제안서.png` });

/* 되돌리기가 있는가 */
적(await pg.getByRole("button", { name: /되돌리기|실행 취소|↩/ }).count() > 0,
   "잘못 고쳤을 때 되돌릴 데가 있다");

/* 저장은 어떻게 하나 — 직원이 가장 많이 묻는 것 */
const 저장말 = await pg.locator(".savedtag").innerText().catch(() => "");
적(!!저장말.trim(), "저장했는지 화면에 보인다", 저장말.trim() || "안 보인다");

/* PDF 로 뽑기 */
const 내보낼것 = (await pg.locator("button").allTextContents())
  .map((t) => t.trim()).filter((t) => /PDF|PPT/.test(t));
메모(`내보내기 단추: ${내보낼것.join(" | ")}`);
적(내보낼것.length >= 2, "PDF·PPT 로 뽑을 데가 있다");

/* ───── 직원: 현수막 한 건 ───── */
console.log("\n[직원] 현수막 한 건");
await pg.getByRole("button", { name: "← 보관함" }).click(); await pg.waitForTimeout(1000);
await pg.getByRole("button", { name: "로그아웃" }).click(); await pg.waitForTimeout(900);
await pg.locator(".namebox").fill("김민수"); await pg.locator(".pinbox").fill("2012");
await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1600);

// 직원이 현수막 분류를 스스로 만들 수 있나
const 더하기 = await pg.locator(".secadd").count();
적(더하기 > 0, "직원도 분류를 만들 수 있다");
if (더하기) {
  await pg.locator(".secadd").click(); await pg.waitForTimeout(300);
  await pg.locator(".catnew").fill("현수막");
  await pg.locator(".catnew").press("Enter"); await pg.waitForTimeout(700);
  await pg.locator(".catnew").press("Escape").catch(() => {});
}
// 인쇄물 분류로 바꿀 수 있나 — 이게 없으면 현수막을 못 만든다
const 줄 = pg.locator(".navrow").filter({ hasText: "현수막" }).first();
await 줄.hover(); await 줄.locator(".rowbtn").last().click().catch(() => {}); await pg.waitForTimeout(400);
const 메뉴 = (await pg.locator(".rowmenu button").allTextContents()).map((t) => t.trim());
메모(`직원이 쓰는 줄 메뉴: ${메뉴.join(" | ") || "(없음)"}`);
적(메뉴.some((t) => t.includes("인쇄물")), "직원이 현수막 분류로 바꿀 수 있다");
if (메뉴.some((t) => t.includes("인쇄물"))) {
  // 이름이 "현수막" 이면 만들 때 이미 인쇄물로 잡힌다. 그러면 이 메뉴가 없다.
if (await pg.getByRole("button", { name: "인쇄물(현수막) 분류로" }).count()) {
  await pg.getByRole("button", { name: "인쇄물(현수막) 분류로" }).click();
} else {
  await pg.keyboard.press("Escape");   // 메뉴만 닫는다
}
await pg.waitForTimeout(700);
}
await pg.getByRole("button", { name: /현수막/ }).first().click(); await pg.waitForTimeout(800);
await pg.screenshot({ path: `${OUT}/02-현수막분류.png` });

// 만들기
누름 = 0;
const 신규 = pg.locator(".빈자리").getByRole("button", { name: "신규 등록" });
적(await 신규.count() > 0, "현수막을 새로 만들 데가 바로 보인다");
await 신규.click(); 누름++; await pg.waitForTimeout(900);
await pg.locator(".field input").nth(0).fill("400");
await pg.locator(".field input").nth(1).fill("70");
await pg.locator(".field input").nth(2).fill("제주 유채꽃 축제");
await pg.getByRole("button", { name: "이 규격으로 시작" }).click(); 누름++;
await pg.waitForSelector(".pagechip", { timeout: 20000 }); await pg.waitForTimeout(1300);

const 칩 = await pg.locator(".보기칩").count();
적(칩 >= 4, "뭐라고 시킬지 보기가 떠 있다", `${칩}개`);
await pg.locator(".보기칩").first().click(); 누름++;
await pg.locator(".dock-box textarea").first().press("Enter"); 누름++;
await pg.waitForSelector(".draftcard", { timeout: 25000 }).catch(() => {});
await pg.waitForTimeout(1600);
적(await pg.locator(".draftcard").count() >= 3, "시안이 나란히 섰다");
await pg.screenshot({ path: `${OUT}/03-시안.png` });
await pg.locator(".draftcard").nth(1).getByRole("button", { name: "1안으로" }).click(); 누름++;
await pg.waitForTimeout(1800);
메모(`현수막 한 장까지 ${누름}번 눌렀다`);
const 크기 = await pg.evaluate(() => {
  const 판 = document.querySelector(".stage-inner > *");
  const z = [...document.querySelectorAll(".zoom span")].map((e) => e.textContent.trim())[0] || "";
  return 판 ? { 폭: Math.round(판.getBoundingClientRect().width), 배율: z } : null;
});
메모(`미리보기: ${크기?.폭}px (${크기?.배율})`);
적((크기?.폭 ?? 0) >= 800, "현수막이 보면서 일할 만큼 크게 뜬다", `${크기?.폭}px`);
await pg.screenshot({ path: `${OUT}/04-현수막완성.png` });

// 글을 손으로 고칠 수 있나
const 글칸 = await pg.locator(".field input, .field textarea").count();
적(글칸 >= 2, "글을 손으로 고칠 칸이 있다", `${글칸}개`);

// 인쇄소에 넘길 파일
적(await pg.getByRole("button", { name: "인쇄용 PDF" }).count() > 0, "인쇄용 저장 단추가 있다");
const 규격 = await pg.getByRole("button", { name: /cm$/ }).first().innerText().catch(() => "");
적(규격.includes("400 × 70"), "지금 규격이 보인다", 규격.trim());

메모(`AI 를 ${부른횟수}번 불렀다`);
if (터짐.length) { console.log("\n✗ 화면이 터진 자리:"); [...new Set(터짐)].slice(0, 5).forEach((t) => console.log("   ", t.slice(0, 140))); 걸림.push(`화면 오류 ${new Set(터짐).size}건`); }
console.log(걸림.length ? `\n막히는 데 ${걸림.length}곳:\n  ` + 걸림.join("\n  ") : "\n막히는 데 없음");
console.log(`화면: ${OUT}`);
await b.close();
