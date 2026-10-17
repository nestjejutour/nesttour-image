/**
 * 작업자 입장에서 처음부터 끝까지 써 본다.
 *
 * 검사 하나하나는 "이 기능이 되는가" 를 본다. 이건 다르다 —
 * 아무것도 모르는 직원이 앉아서 순서대로 눌렀을 때 막히는 데가 있는가를 본다.
 * 화면도 단계마다 찍어 둔다. 글자가 안 보이거나 줄이 어긋난 건 숫자로 안 잡힌다.
 */
import { chromium } from "playwright";
const OUT = process.argv[2] || "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad/시뮬";
import { mkdirSync } from "node:fs";
mkdirSync(OUT, { recursive: true });

const 탈 = [];
const 적 = (ok, 말, 덧 = "") => {
  console.log(`${ok ? "✓" : "✗"} ${말}${덧 ? ` — ${덧}` : ""}`);
  if (!ok) 탈.push(말 + (덧 ? ` (${덧})` : ""));
};

const 그림 = (하늘, 들) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 280">
 <rect width="1600" height="280" fill="${하늘}"/>
 <path d="M0 200 Q400 180 800 200 T1600 190 V280 H0 Z" fill="${들}"/></svg>`;

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1700, height: 1050 }, deviceScaleFactor: 1.2 });
const 터짐 = [];
pg.on("pageerror", (e) => 터짐.push(`${e.message}`));

/* 1700 창에서는 그림 자리를 지키려고 대화칸이 접힌 채로 시작한다.
   직원이 실제로 하듯 가장자리 「대화」 손잡이를 눌러 편다. */
const 대화칸열기 = async (pg) => {
  if (await pg.locator(".dock-closed").count()) {
    await pg.locator(".dock-closed").click();
    await pg.waitForTimeout(800);
  }
};
pg.on("console", (m) => { if (m.type() === "error") 터짐.push(`콘솔: ${m.text().slice(0, 120)}`); });
pg.on("requestfailed", (r) => 터짐.push(`못 받음: ${r.url().slice(0, 100)} — ${r.failure()?.errorText}`));
pg.on("response", (r) => { if (r.status() >= 400) 터짐.push(`${r.status()}: ${r.url().slice(0, 120)}`); });

await pg.route("**/api/ai", async (route) => {
  const reply = { say: "세 가지로 해 봤습니다.", actions: [{ do: "시안", options: [
    { name: "꽃밭", why: "유채꽃을 앞쪽에", content: { art: 그림("#8ECAE6", "#F6D847"),
      주제목: "제주 유채꽃 축제", 부제목: "봄이 가장 먼저 닿는 곳", 덧말: "서귀포 가시리" } },
    { name: "차분하게", why: "글자가 먼저 읽히도록", content: { art: 그림("#A7C4CF", "#D8C44A"),
      주제목: "제주 유채꽃 축제", 부제목: "봄", 덧말: "가시리" } },
  ] }] };
  await route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ text: JSON.stringify(reply) }) });
});

const 찰칵 = async (이름) => { await pg.screenshot({ path: `${OUT}/${이름}.png` }); };

/* ───────────── 1. 처음 켰을 때 ───────────── */
await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await pg.evaluate(() => localStorage.clear());
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1300);
await 찰칵("01-로그인");
적(await pg.locator(".namebox").count() === 1, "로그인 화면이 뜬다");
적((await pg.locator("body").innerText()).includes("이름"), "이름 칸이 있다");

/* ───────────── 2. 직원으로 들어간다 ───────────── */
await pg.locator(".namebox").fill("김민수"); await pg.locator(".pinbox").fill("2012");
await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1600);
// 첫 화면이 "무엇을 만들어 드릴까요?" 작업대로 바뀌었다. 서류함을 보려면 한 번 눌러야 한다.
if (await pg.locator(".시작판").count()) {
  await pg.getByRole("button", { name: /보관함 보기/ }).click();
  await pg.waitForTimeout(700);
}
await 찰칵("02-직원-보관함");
const 탭들 = (await pg.locator("nav button, .tabs button").allTextContents()).map((t) => t.trim()).filter(Boolean);
적(!탭들.includes("기록") && !탭들.includes("설정"), "직원에게 기록·설정이 안 보인다", 탭들.join(" / ") || "(탭 없음)");
const 직원분류 = (await pg.locator(".navitem").allTextContents()).map((t) => t.trim());
console.log("   직원이 보는 분류:", 직원분류.join(" | ") || "(없음)");

/* ───────────── 3. 대표로 바꿔 들어간다 ───────────── */
await pg.getByRole("button", { name: "로그아웃" }).click(); await pg.waitForTimeout(900);
await pg.locator(".namebox").fill("박시영"); await pg.locator(".pinbox").fill("2230");
await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1600);
const 대표탭 = (await pg.locator("nav button, .tabs button").allTextContents()).map((t) => t.trim()).filter(Boolean);
적(대표탭.some((t) => t.includes("기록")) && 대표탭.some((t) => t.includes("설정")),
   "대표에게는 기록·설정이 보인다", 대표탭.join(" / "));
await 찰칵("03-대표-보관함");

/* ───────────── 4. 현수막 분류를 만든다 ───────────── */
await pg.locator(".secadd").click(); await pg.waitForTimeout(400);
await pg.locator(".catnew").fill("현수막");
await pg.locator(".catnew").press("Enter"); await pg.waitForTimeout(700);
await pg.locator(".catnew").press("Escape"); await pg.waitForTimeout(400);
const 줄 = pg.locator(".navrow").filter({ hasText: "현수막" }).first();
await 줄.hover(); await 줄.locator(".rowbtn").last().click(); await pg.waitForTimeout(500);
const 메뉴 = (await pg.locator(".rowmenu button").allTextContents()).map((t) => t.trim());
적(!메뉴.some((t) => /지우기|옮기기|빼기/.test(t)), "메뉴 글이 업무용이다", 메뉴.join(" / "));
await 찰칵("04-분류메뉴");
// 이름이 "현수막" 이면 만들 때 이미 인쇄물로 잡힌다. 그러면 이 메뉴가 없다.
if (await pg.getByRole("button", { name: "인쇄물(현수막) 분류로" }).count()) {
  await pg.getByRole("button", { name: "인쇄물(현수막) 분류로" }).click();
} else {
  await pg.keyboard.press("Escape");   // 메뉴만 닫는다
}
await pg.waitForTimeout(700);
await pg.getByRole("button", { name: /현수막/ }).first().click(); await pg.waitForTimeout(800);
await 찰칵("05-현수막-분류");

/* ───────────── 5. 현수막을 새로 만든다 ───────────── */
await pg.locator(".빈자리").getByRole("button", { name: "신규 등록" }).click(); await pg.waitForTimeout(900);
await 찰칵("06-규격묻기");
await pg.locator(".field input").nth(0).fill("400");
await pg.locator(".field input").nth(1).fill("70");
await pg.locator(".field input").nth(2).fill("제주 유채꽃 축제");
await pg.getByRole("button", { name: "이 규격으로 시작" }).click();
await pg.waitForSelector(".pagechip", { timeout: 20000 }); await pg.waitForTimeout(1200);
await 찰칵("07-현수막-편집");
const 규격글 = await pg.getByRole("button", { name: /cm$/ }).first().innerText().catch(() => "(없음)");
적(규격글.includes("400 × 70"), "작업 화면에 규격이 적혀 있다", 규격글.trim());

/* ───────────── 6. AI 에게 시킨다 ───────────── */
await 대화칸열기(pg);
적(await pg.locator(".보기칩").count() >= 4, "보기 명령어가 떠 있다");
await pg.locator(".보기칩").first().click(); await pg.waitForTimeout(200);
await pg.locator(".dock-box textarea").first().press("Enter");
await pg.waitForSelector(".draftcard", { timeout: 25000 }).catch(() => {});
await pg.waitForTimeout(1500);
await 찰칵("08-시안");
적(await pg.locator(".draftcard").count() === 3, "원안 + 시안 2개가 섰다",
   `${await pg.locator(".draftcard").count()}칸`);
await pg.locator(".draftcard").nth(1).getByRole("button", { name: "1안으로" }).click();
await pg.waitForTimeout(1800);
await 찰칵("09-고른뒤");

/* ───────────── 7. 글을 고친다 ───────────── */
const 글칸 = pg.locator(".stage-inner [contenteditable], .stage-inner input, .fieldpad input, .fieldpad textarea");
console.log("   고칠 수 있는 글칸:", await 글칸.count(), "개");

/* ───────────── 8. 자료함이 아래에 있는가 ───────────── */
await pg.getByRole("button", { name: "← 보관함" }).click().catch(() => {});
await pg.waitForTimeout(1200);
await pg.locator(".card").first().click().catch(() => {});
await pg.waitForTimeout(1300);
await 찰칵("10-건별화면");
적(await pg.locator(".browse-docs, .libdrop").count() > 0, "한 건을 열면 그 건의 자료함이 아래에 있다");

/* ───────────── 9. 터진 데가 있는가 ───────────── */
if (터짐.length) {
  console.log("\n✗ 화면이 터진 자리:");
  [...new Set(터짐)].slice(0, 8).forEach((t) => console.log("   ", t.slice(0, 150)));
  탈.push(`화면 오류 ${new Set(터짐).size}건`);
}

console.log(탈.length ? `\n막히는 데 ${탈.length}곳:\n  ` + 탈.join("\n  ") : "\n막히는 데 없음");
console.log(`화면: ${OUT}`);
await b.close();
