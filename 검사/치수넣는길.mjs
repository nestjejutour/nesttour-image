/**
 * 현수막 치수를 넣을 길이 늘 있는가.
 *
 * 전에는 줄 끝 ⋯ 메뉴에서 "인쇄물 분류로" 를 먼저 눌러야만 cm 칸이 나왔다.
 * 그 설정은 숨어 있다. 분류 이름을 "현수막" 이라 지어도 모르면 못 찾는다.
 * 이름이 무엇이든 길이 있어야 한다.
 */
import { chromium } from "playwright";
const 탈 = [];
const 적 = (ok, 말, 덧 = "") => { console.log(`${ok ? "✓" : "✗"} ${말}${덧 ? ` — ${덧}` : ""}`); if (!ok) 탈.push(말); };

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const 터짐 = [];
pg.on("pageerror", (e) => 터짐.push(e.message));

const 시작 = async () => {
  await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });
  await pg.evaluate(() => localStorage.clear());
  await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1200);
  await pg.locator(".namebox").fill("박시영"); await pg.locator(".pinbox").fill("2230");
  await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1600);
};
const 분류만들기 = async (이름) => {
  await pg.locator(".secadd").click(); await pg.waitForTimeout(300);
  await pg.locator(".catnew").fill(이름);
  await pg.locator(".catnew").press("Enter"); await pg.waitForTimeout(700);
  await pg.locator(".catnew").press("Escape").catch(() => {});
  await pg.getByRole("button", { name: new RegExp(이름) }).first().click(); await pg.waitForTimeout(800);
};
const cm칸있나 = async () => (await pg.evaluate(() => document.body.innerText.includes("가로 (cm)")));

/* ① 이름이 인쇄물류 — 바로 cm 칸 */
await 시작();
for (const 이름 of ["현수막", "배너", "엑스배너", "간판"]) {
  await 분류만들기(이름);
  await pg.locator(".빈자리").getByRole("button", { name: "신규 등록" }).click(); await pg.waitForTimeout(1100);
  적(await cm칸있나(), `"${이름}" 으로 지으면 바로 치수를 묻는다`);
  await pg.getByRole("button", { name: "취소" }).click().catch(() => {}); await pg.waitForTimeout(800);
}

/* ② 이름이 전혀 다를 때 — 만드는 화면에 길이 있는가 */
await 분류만들기("우리팀 인쇄물건");
await pg.locator(".빈자리").getByRole("button", { name: "신규 등록" }).click(); await pg.waitForTimeout(1100);
const 바로 = await cm칸있나();
적(!바로, "이름이 다르면 바로 묻지는 않는다 (제안서 화면)");
const 길 = await pg.getByRole("button", { name: "치수 넣고 시작" }).count();
적(길 > 0, "그래도 만드는 화면에 '치수 넣고 시작' 이 있다");
if (길) {
  await pg.getByRole("button", { name: "치수 넣고 시작" }).click(); await pg.waitForTimeout(1000);
  적(await cm칸있나(), "눌러서 치수 화면으로 간다");
  await pg.locator(".field input").nth(0).fill("300");
  await pg.locator(".field input").nth(1).fill("70");
  await pg.locator(".field input").nth(2).fill("체육대회 현수막");
  await pg.getByRole("button", { name: "이 규격으로 시작" }).click();
  await pg.waitForSelector(".pagechip", { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(1200);
  const 만들어진것 = await pg.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
    const p = (d.projects || []).find((x) => x.title.includes("체육대회"));
    const s = p?.styleOverride?.slide;
    return s ? `${Math.round(s.widthIn * 2.54)} × ${Math.round(s.heightIn * 2.54)} cm` : "(없음)";
  });
  적(만들어진것 === "300 × 70 cm", "그 치수로 만들어진다", 만들어진것);
  적(await pg.getByRole("button", { name: "인쇄용 PDF" }).count() > 0, "인쇄용 저장까지 이어진다");
}

if (터짐.length) { console.log("✗ 터짐:", [...new Set(터짐)].slice(0, 3).join(" | ").slice(0, 150)); 탈.push("화면 오류"); }
console.log(탈.length ? `\n막히는 데 ${탈.length}곳` : "\n어느 길로 가도 치수를 넣을 수 있다");
await b.close();
process.exit(탈.length ? 1 : 0);
