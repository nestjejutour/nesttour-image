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
적(겹침 <= 1, "같은 이름 분류가 둘 생기지 않는다", `${겹침}개`);

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
await pg.waitForTimeout(3000);
const 깨진답 = await pg.evaluate(() => ({
  살았나: !!document.querySelector(".dock-box"),
  말: (document.querySelector(".warn b, .picerr")?.textContent || "").trim(),
}));
적(깨진답.살았나, "AI 가 깨진 답을 줘도 화면이 안 죽는다");
적(!!깨진답.말, "깨진 답일 때 까닭을 알려 준다", 깨진답.말 || "아무 말이 없다");

/* ⑧ AI 창구가 끊겼을 때 */
await pg.unroute("**/api/ai");
await pg.route("**/api/ai", (r) => r.abort());
await pg.locator(".dock-box textarea").first().fill("또 아무거나");
await pg.locator(".dock-box textarea").first().press("Enter");
// 얼마나 걸려야 포기하는지 본다 — 멈춘 채로 도는지, 늦게라도 끝나는지
for (const 초 of [3, 8, 15, 25]) {
  await pg.waitForTimeout(초 === 3 ? 3000 : 5000);
  const 아직 = await pg.evaluate(() => !!document.querySelector(".thinking, .dock-busy, .spinner, .working"));
  console.log(`   ${초}초: ${아직 ? "아직 돈다" : "끝났다"}`);
  if (!아직) break;
}
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
