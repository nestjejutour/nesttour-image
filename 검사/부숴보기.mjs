/**
 * 일부러 부숴 본다.
 *
 * 다른 검사는 "제대로 쓰면 되는가" 를 본다. 이건 반대다 —
 * 잘못 눌렀을 때, 자료가 넘칠 때, 중간에 끊겼을 때 무슨 일이 나는가.
 * 실제 사고는 늘 이쪽에서 난다.
 */
import { chromium } from "playwright";
const 탈 = [];
const 적 = (ok, 말, 덧 = "") => { console.log(`${ok ? "✓" : "✗"} ${말}${덧 ? ` — ${덧}` : ""}`); if (!ok) 탈.push(말); };

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const 터짐 = [];
pg.on("pageerror", (e) => 터짐.push(e.message));
await pg.route("**/api/ai", (r) => r.fulfill({ status: 200, contentType: "application/json",
  body: JSON.stringify({ text: JSON.stringify({ say: "네.", actions: [] }) }) }));

const 들어가기 = async () => {
  // 이름을 기억해 두면 바로 들어가 있을 때가 있다. 그러면 지나친다.
  if (!(await pg.locator(".namebox").count())) return;
  await pg.locator(".namebox").fill("박시영"); await pg.locator(".pinbox").fill("2230");
  await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1600);
// 첫 화면이 "무엇을 만들어 드릴까요?" 작업대로 바뀌었다. 서류함을 보려면 한 번 눌러야 한다.
if (await pg.locator(".시작판").count()) {
  await pg.getByRole("button", { name: /보관함 보기/ }).click();
  await pg.waitForTimeout(700);
}
};
await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await pg.evaluate(() => localStorage.clear());
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1200);
await 들어가기();

/* ① 저장 자리가 꽉 찼을 때 — 100개 쌓으면 실제로 닥치는 일이다 */
const 꽉 = await pg.evaluate(async () => {
  try {
    // 남은 자리를 일부러 다 메운다
    const 덩어리 = "x".repeat(512 * 1024);
    let i = 0;
    try { for (; i < 40; i++) localStorage.setItem(`__채움${i}`, 덩어리); } catch { /* 여기서 꽉 찬다 */ }
    // 이 상태에서 앱이 저장을 시도하면?
    const 앞 = localStorage.getItem("mtmb-studio-v1");
    return { 채운칸: i, 자료남음: !!앞 };
  } catch (e) { return { 터짐: String(e?.message ?? e) }; }
});
await pg.evaluate(() => {
  // 앱이 저장하도록 뭔가 바꾼다
  const ev = new Event("storage"); window.dispatchEvent(ev);
});
await pg.locator(".secadd").click().catch(() => {});
await pg.waitForTimeout(400);
await pg.locator(".catnew").fill("꽉찬뒤분류").catch(() => {});
await pg.locator(".catnew").press("Enter").catch(() => {});
await pg.waitForTimeout(1500);
const 꽉찬뒤 = await pg.evaluate(() => ({
  화면살아있나: !!document.querySelector(".navitem"),
  경고보이나: document.body.innerText.includes("저장") &&
    /가득|꽉|넘|못 저장|저장하지/.test(document.body.innerText),
  본문: document.body.innerText.slice(0, 120).replace(/\n/g, " "),
}));
적(꽉찬뒤.화면살아있나, "저장 자리가 꽉 차도 화면이 살아 있다", `${꽉.채운칸 * 0.5}MB 메움`);
적(꽉찬뒤.경고보이나, "꽉 찼을 때 대표님께 알린다", 꽉찬뒤.경고보이나 ? "" : "조용히 넘어간다 ← 자료가 날아가도 모른다");
await pg.evaluate(() => { for (let i = 0; i < 60; i++) localStorage.removeItem(`__채움${i}`); });

/* ② 분류를 지우면 그 안의 작업물은? */
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1200);
await 들어가기();
const 건수앞 = await pg.evaluate(() => JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}").projects?.length ?? 0);
const 줄 = pg.locator(".navrow").filter({ hasText: "제안서" }).first();
await 줄.hover(); await 줄.locator(".rowbtn").last().click(); await pg.waitForTimeout(400);
await pg.locator(".rowmenu").getByRole("button", { name: "삭제" }).click(); await pg.waitForTimeout(1200);
const 건수뒤 = await pg.evaluate(() => JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}").projects?.length ?? 0);
적(건수앞 === 건수뒤, "분류를 지워도 그 안의 작업물은 안 사라진다", `${건수앞} → ${건수뒤}`);
const 갈곳 = await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  const 산것 = (d.categories || []).filter((c) => !c.hidden).map((c) => c.id);
  return (d.projects || []).every((p) => 산것.includes(p.category));
});
적(갈곳, "지운 분류에 묶여 있던 작업물이 미아가 되지 않는다");

/* ③ 한 글자도 없는 이름으로 분류 만들기 */
await pg.locator(".secadd").click(); await pg.waitForTimeout(300);
await pg.locator(".catnew").fill("   ");
await pg.locator(".catnew").press("Enter"); await pg.waitForTimeout(700);
await pg.locator(".catnew").press("Escape").catch(() => {});
const 빈이름 = await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  return (d.categories || []).filter((c) => !String(c.name || "").trim()).length;
});
적(빈이름 === 0, "이름 없는 분류가 안 생긴다", `${빈이름}개`);

/* ④ 같은 이름 분류를 여러 개 */
for (const _ of [1, 2]) {
  await pg.locator(".secadd").click(); await pg.waitForTimeout(250);
  await pg.locator(".catnew").fill("똑같은이름");
  await pg.locator(".catnew").press("Enter"); await pg.waitForTimeout(600);
  await pg.locator(".catnew").press("Escape").catch(() => {});
}
const 겹침 = await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  return (d.categories || []).filter((c) => c.name === "똑같은이름").length;
});
// 대표님이 "그냥둬" 라 하신 것. 막지 않기로 정했으니 탈로 세지 않는다 —
// 다만 숫자는 남겨 둔다. 나중에 막기로 하면 여기부터 보면 된다.
console.log(`  · 같은 이름 분류: ${겹침}개 (막지 않기로 함)`);

/* ⑤ 새로고침 한가운데 — 저장 전에 끊기면 */
await pg.locator(".secadd").click(); await pg.waitForTimeout(250);
await pg.locator(".catnew").fill("끊기기직전");
await pg.locator(".catnew").press("Enter");
await pg.waitForTimeout(150);            // 저장(6초 묶음)이 돌기 전에
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1400);
await 들어가기();
const 살았나 = await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  return (d.categories || []).some((c) => c.name === "끊기기직전");
});
적(살았나, "넣자마자 새로고침해도 안 날아간다", 살았나 ? "" : "저장을 묶어 두는 사이에 날아간다");

/* ⑥ 빈 제안서를 PDF 로 */
const 빈PDF = await pg.evaluate(async () => {
  const { downloadPdf } = await import("/src/render/pdf.ts");
  const { BUILT_IN_STYLES } = await import("/src/core/style.ts");
  try { const r = await downloadPdf([], BUILT_IN_STYLES[0], "빈것"); return r.ok ? "저장됨" : r.error; }
  catch (e) { return "터짐: " + String(e?.message ?? e); }
});
적(!String(빈PDF).startsWith("터짐"), "장이 없는 것을 PDF 로 눌러도 안 터진다", String(빈PDF));

/* ⑦ AI 가 깨진 답을 줄 때 */
await pg.unroute("**/api/ai");
await pg.route("**/api/ai", (r) => r.fulfill({ status: 200, contentType: "application/json",
  body: JSON.stringify({ text: "{이건 JSON 이 아니다 ???" }) }));
await pg.locator(".dock-box textarea").first().fill("아무거나 해줘");
await pg.locator(".dock-box textarea").first().press("Enter");
// 답이 올 때까지 기다린다. 3초만 세고 보면 아직 "읽는 중" 이라 아무 말도 안 보인다.
await pg.waitForFunction(
  () => !document.querySelector(".thinking, .dock-busy, .spinner, .working"),
  null, { timeout: 25000 },
).catch(() => {});
await pg.waitForTimeout(600);
const 깨진답 = await pg.evaluate(() => ({
  살았나: !!document.querySelector(".dock-box"),
  말: (document.querySelector(".warn b, .picerr")?.textContent || "").trim(),
  어디: [...document.querySelectorAll(".warn, .picerr, .bubble.assistant")]
    .map((e) => `${e.className}:${(e.textContent || "").trim().slice(0, 50)}`).join(" | "),
}));
console.log("   [살핌]", 깨진답.어디 || "(아무 칸도 없다)");
적(깨진답.살았나, "AI 가 깨진 답을 줘도 화면이 안 죽는다");
적(!!깨진답.말, "깨진 답일 때 까닭을 알려 준다", 깨진답.말 || "아무 말이 없다");

/* ⑧ AI 창구가 끊겼을 때 */
await pg.unroute("**/api/ai");
await pg.route("**/api/ai", (r) => r.abort());
await pg.locator(".dock-box textarea").first().fill("또 아무거나");
await pg.locator(".dock-box textarea").first().press("Enter");
/*
  얼마나 걸려야 포기하는지 본다 — 멈춘 채로 도는지, 늦게라도 끝나는지.

  정해 둔 초만 세고 보면 안 된다. 검사 35개를 한꺼번에 돌릴 때는 CPU 가 밀려
  답이 늦게 온다. 그때 아직 "읽는 중" 인 화면을 보고 "아무 말이 없다" 고 적는다.
  (실제로 그렇게 한 번 틀린 적이 있다 — 코드는 멀쩡했다)
  그래서 끝날 때까지 기다리되, 걸린 시간을 적어 둔다.
*/
const 잰시작 = Date.now();
await pg.waitForFunction(
  () => !document.querySelector(".thinking, .dock-busy, .spinner, .working"),
  null, { timeout: 60000 },
).catch(() => {});
console.log(`   포기까지 ${((Date.now() - 잰시작) / 1000).toFixed(1)}초`);
await pg.waitForTimeout(600);
const 끊김 = await pg.evaluate(() => ({
  살았나: !!document.querySelector(".dock-box"),
  돌고있나: !!document.querySelector(".dock-busy, .spinner, .thinking, .working"),
  말: (document.querySelector(".warn b, .picerr")?.textContent || "").trim(),
}));
적(끊김.살았나 && !끊김.돌고있나, "창구가 끊겨도 멈춘 채로 돌지 않는다");
적(!!끊김.말, "끊겼을 때 까닭을 알려 준다", 끊김.말 || "아무 말이 없다");

if (터짐.length) {
  console.log("\n✗ 화면이 터진 자리:");
  [...new Set(터짐)].slice(0, 6).forEach((t) => console.log("   ", t.slice(0, 140)));
  탈.push(`화면 오류 ${new Set(터짐).size}건`);
}
console.log(탈.length ? `\n문제 ${탈.length}곳:\n  ` + 탈.join("\n  ") : "\n문제 없음");
await b.close();
