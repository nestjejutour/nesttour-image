/*
  묶음 A — 편집 영역 · 메뉴 이름 · 기록 이름

  ① 좁은 화면에서 그림 자리가 확보되는가 (창 너비가 아니라 실제 편집 영역 기준)
  ② 대표님이 손수 접거나 편 것을 기억하는가
  ③ 창고 → 설정 / 보관 → 백업
  ④ 기록에서 보관함 대화가 "(지운 제안서)" 로 보이지 않는가
*/
import { chromium } from "playwright";
let 탈 = 0;
const 봄 = (말, 됨, 덧 = "") => { console.log(`${됨 ? "✓" : "✗"} ${말}${덧 ? " — " + 덧 : ""}`); if (!됨) 탈++; };
const OUT = process.argv[2] || "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad";

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

const 들어가서편집기까지 = async (pg) => {
  await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" }); await pg.waitForTimeout(1000);
  if (await pg.locator(".gate").count()) {
    await pg.locator(".namebox").fill("정세종"); await pg.locator(".pinbox").fill("2230");
    await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1600);
  }
  if (await pg.getByRole("button", { name: /보관함 보기/ }).count()) {
    await pg.getByRole("button", { name: /보관함 보기/ }).click(); await pg.waitForTimeout(800);
  }
  const 카드 = pg.locator(".card, .cardwrap").first();
  if (!await 카드.count()) return false;
  await 카드.click(); await pg.waitForTimeout(1500);
  if (await pg.getByRole("button", { name: "편집하기" }).count()) {
    await pg.getByRole("button", { name: "편집하기" }).click(); await pg.waitForTimeout(2000);
  }
  return await pg.locator(".stage").count() > 0;
};
const 재기 = (pg) => pg.evaluate(() => {
  const s = document.querySelector(".stage");
  const 줌 = (document.body.innerText.match(/(\d+)%/) ?? [])[1];
  return { 캔버스: s ? Math.round(s.getBoundingClientRect().width) : 0, 줌: 줌 ? +줌 : 0,
           대화폄: !!document.querySelector(".dock") && !document.querySelector(".dock-closed") };
});

/* ① 화면 크기별 편집 영역 */
console.log("── ① 화면별 그림 자리 ──");
const 잰것 = {};
for (const [w, h, 이름, 펴야하나] of [[1366,768,"노트북 1366",false],[1600,900,"1600",false],[1920,1080,"FHD",true],[2560,1440,"QHD",true]]) {
  const c = await b.newContext({ viewport: { width: w, height: h } });
  const pg = await c.newPage();
  pg.on("pageerror", (e) => { console.log("✗ 페이지오류:", e.message); 탈++; });
  const 됐나 = await 들어가서편집기까지(pg);
  if (!됐나) { console.log(`  ${이름}: 편집기를 못 열었다`); await c.close(); continue; }
  const r = await 재기(pg);
  잰것[이름] = r;
  console.log(`  ${이름.padEnd(12)} 캔버스 ${String(r.캔버스).padStart(4)}px · 줌 ${String(r.줌).padStart(3)}% · 대화칸 ${r.대화폄 ? "폄" : "접힘"}`);
  봄(`${이름}: 대화칸이 ${펴야하나 ? "펴진다" : "접힌다"}`, r.대화폄 === 펴야하나);
  봄(`${이름}: 그림 자리가 560px 이상`, r.캔버스 >= 560, `${r.캔버스}px`);
  await c.close();
}
봄("좁은 화면에서 넓은 화면보다 더 줄지 않는다",
   (잰것["노트북 1366"]?.줌 ?? 0) >= 50, `1366 줌 ${잰것["노트북 1366"]?.줌}%`);

/* ①-나 창을 넓혔는데 대화창이 사라지는 역전이 없는가 */
console.log("\n── ①-나 폭이 넓어질수록 유리해야 한다 ──");
{
  const 잰것 = [];
  for (const w of [1366, 1460, 1500, 1700, 1783, 1784, 1920]) {
    const c = await b.newContext({ viewport: { width: w, height: 900 } });
    const pg = await c.newPage();
    await 들어가서편집기까지(pg);
    const r = await 재기(pg);
    잰것.push({ w, 폄: r.대화폄, 캔버스: r.캔버스 });
    await c.close();
  }
  console.log("  " + 잰것.map((x) => `${x.w}:${x.폄 ? "폄" : "접힘"}`).join("  "));
  let 역전 = null;
  for (let i = 1; i < 잰것.length; i++) {
    // 넓어졌는데 접히면 역전이다 (1460 은 펴고 1500 은 접던 적이 있었다)
    if (잰것[i - 1].폄 && !잰것[i].폄) 역전 = `${잰것[i - 1].w}=폄 → ${잰것[i].w}=접힘`;
  }
  봄("창을 넓혔는데 대화창이 사라지는 일이 없다", !역전, 역전 ?? "역전 없음");
  봄("1783 에서는 접히고 1784 에서는 펴진다 (604+620+560)",
     !잰것.find((x) => x.w === 1783).폄 && 잰것.find((x) => x.w === 1784).폄);
  for (const x of 잰것) 봄(`${x.w}px: 그림 자리 560 이상`, x.캔버스 >= 560, `${x.캔버스}px`);
}

/* ② 손수 접고 편 것을 기억하는가 */
console.log("\n── ② 대표가 손수 바꾼 것을 기억하는가 ──");
{
  const c = await b.newContext({ viewport: { width: 1920, height: 1080 } });
  const pg = await c.newPage();
  await 들어가서편집기까지(pg);
  봄("FHD 에서는 처음에 펴져 있다", (await 재기(pg)).대화폄);
  await pg.getByRole("button", { name: /대화 닫기/ }).click(); await pg.waitForTimeout(900);
  봄("닫으면 접힌다", !(await 재기(pg)).대화폄);
  await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(2200);
  봄("새로 고쳐도 접힌 채로 기억한다", !(await 재기(pg)).대화폄);
  const 적힌것 = await pg.evaluate(() => JSON.parse(localStorage.getItem("mtmb-panels-v1") || "{}").dockOpen);
  봄("접힘이 칸 설정에 적힌다 (백업에도 함께 담긴다)", 적힌것 === 0, `dockOpen=${적힌것}`);
  await c.close();
}
{
  // 거꾸로 — 좁은 화면에서 손수 펴면 그것도 기억해야 한다
  const c = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const pg = await c.newPage();
  await 들어가서편집기까지(pg);
  봄("1366 에서는 처음에 접혀 있다", !(await 재기(pg)).대화폄);
  const 열기 = pg.locator(".dock-closed");
  if (await 열기.count()) { await 열기.click(); await pg.waitForTimeout(900); }
  봄("좁아도 손수 펼 수 있다", (await 재기(pg)).대화폄);
  await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(2200);
  봄("좁은 화면에서도 편 것을 기억한다", (await 재기(pg)).대화폄);
  await c.close();
}

/* ③ 메뉴 이름 */
console.log("\n── ③ 메뉴 이름 ──");
{
  const c = await b.newContext({ viewport: { width: 1600, height: 1000 } });
  const pg = await c.newPage();
  await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" }); await pg.waitForTimeout(1000);
  if (await pg.locator(".gate").count()) {
    await pg.locator(".namebox").fill("정세종"); await pg.locator(".pinbox").fill("2230");
    await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1600);
  }
  const 탭들 = (await pg.locator(".tabs button").allTextContents()).map((t) => t.trim());
  봄("상단에 「설정」 이 있다", 탭들.includes("설정"), 탭들.join(" / "));
  봄("「창고」 는 더 없다", !탭들.includes("창고"));
  await pg.getByRole("button", { name: "설정", exact: true }).click(); await pg.waitForTimeout(800);
  const 속탭 = (await pg.locator(".substrip button").allTextContents()).map((t) => t.trim().split("\n")[0]);
  봄("설정 안에 「백업」 이 있다", 속탭.some((t) => t === "백업"), 속탭.join(" / "));
  const 안내 = (await pg.locator(".substrip .note").innerText()).trim();
  봄("「안 보셔도 된다」 는 말을 뺐다", !안내.includes("들여다보지 않으셔도"), 안내);
  봄("백업을 여기서 하라고 적혀 있다", 안내.includes("백업은 여기서"), 안내);
  await pg.getByRole("button", { name: "백업", exact: true }).click(); await pg.waitForTimeout(700);
  봄("백업 화면이 열린다", await pg.getByRole("button", { name: "전체 백업" }).count() === 1);
  await c.close();
}

/* ④ 기록의 대화 이름 */
console.log("\n── ④ 기록의 대화 이름 ──");
{
  const c = await b.newContext({ viewport: { width: 1600, height: 1000 } });
  const pg = await c.newPage();
  await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" }); await pg.waitForTimeout(1000);
  if (await pg.locator(".gate").count()) {
    await pg.locator(".namebox").fill("정세종"); await pg.locator(".pinbox").fill("2230");
    await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1600);
  }
  await pg.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("mtmb-studio-v1"));
    d.chats = { ...(d.chats ?? {}), "보관함:전체": [{ role: "user", text: "보관함에서 건 말" }, { role: "ai", text: "예" }] };
    localStorage.setItem("mtmb-studio-v1", JSON.stringify(d));
  });
  await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(2000);
  await pg.getByRole("button", { name: "기록", exact: true }).click(); await pg.waitForTimeout(1000);
  const 글 = await pg.locator(".page, .logitem").first().innerText();
  봄("보관함 대화가 「(지운 제안서)」 로 안 보인다", !글.includes("(지운 제안서)"), 글.split("\n").slice(0, 3).join(" / "));
  봄("제대로 된 이름이 붙는다", 글.includes("보관함에서 나눈 대화"));
  await pg.screenshot({ path: `${OUT}/묶음A-기록.png` });
  await c.close();
}

await b.close();
console.log(탈 ? `\n실패 ${탈}개` : "\n다 됐다");
process.exit(탈 ? 1 : 0);
