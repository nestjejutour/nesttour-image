/**
 * 대표님이 말씀하신 길을 그대로 간다.
 *
 *   밖에서 자료 하나 올리고 → AI 돌려 시안 뽑고 → 그걸로 고치고 → 또 고치고
 *
 * 한 가지라도 중간에서 끊기면 직원은 거기서 멈춘다.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const 터 = "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad/현수막";
const OUT = "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad/흐름";
import { mkdirSync } from "node:fs";
mkdirSync(OUT, { recursive: true });
const 짐 = ["현수막-1.ai"].map((n) => ({ name: n, b64: readFileSync(`${터}/${n}`).toString("base64") }));

const 탈 = [];
const 적 = (ok, 말, 덧 = "") => { console.log(`${ok ? "✓" : "✗"} ${말}${덧 ? ` — ${덧}` : ""}`); if (!ok) 탈.push(말); };

const 그림 = (하늘, 들) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 280"><rect width="1600" height="280" fill="${하늘}"/><path d="M0 200 Q400 180 800 200 T1600 190 V280 H0 Z" fill="${들}"/></svg>`;

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1700, height: 1050 } });
const 터짐 = [];
pg.on("pageerror", (e) => 터짐.push(e.message));

let 받은 = [];
await pg.route("**/api/ai", async (route) => {
  const 몸 = (() => { try { return JSON.parse(route.request().postDataBuffer()?.toString("utf8") || "{}"); } catch { return {}; } })();
  받은.push({ 사진수: (몸.imagesBase64 || []).length, 말: String(몸.messages?.at(-1)?.content ?? "").slice(0, 160) });
  const 차례 = 받은.length;
  const reply = 차례 === 1
    ? { say: "올려 주신 현수막을 보고 두 가지로 잡았습니다.", actions: [{ do: "시안", options: [
        { name: "같은 결로", why: "올려 주신 것과 같은 색 계열", content: { art: 그림("#8ECAE6", "#F6D847"), 주제목: "제주 유채꽃 축제", 부제목: "봄이 가장 먼저 닿는 곳", 덧말: "서귀포 가시리", 자리: "가운데" } },
        { name: "글을 왼쪽에", why: "그림은 오른쪽, 글은 왼쪽", content: { art: 그림("#2F4F3A", "#FFD93D"), 주제목: "제주 유채꽃 축제", 부제목: "노란 봄", 덧말: "가시리", 자리: "왼쪽" } },
      ] }] }
    : { say: "글을 왼쪽으로 몰았습니다.", actions: [{ do: "내용수정", content: { 자리: "왼쪽" } }] };
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: JSON.stringify(reply) }) });
});

await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await pg.evaluate(() => localStorage.clear());
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1300);
await pg.locator(".namebox").fill("김민수"); await pg.locator(".pinbox").fill("2012");
await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1600);
// 첫 화면이 "무엇을 만들어 드릴까요?" 작업대로 바뀌었다. 서류함을 보려면 한 번 눌러야 한다.
if (await pg.locator(".시작판").count()) {
  await pg.getByRole("button", { name: /보관함 보기/ }).click();
  await pg.waitForTimeout(700);
}

/* ① 현수막 분류를 만들고 인쇄물로 */
await pg.locator(".secadd").click(); await pg.waitForTimeout(300);
await pg.locator(".catnew").fill("현수막");
await pg.locator(".catnew").press("Enter"); await pg.waitForTimeout(700);
await pg.locator(".catnew").press("Escape").catch(() => {});
const 줄 = pg.locator(".navrow").filter({ hasText: "현수막" }).first();
await 줄.hover(); await 줄.locator(".rowbtn").last().click(); await pg.waitForTimeout(400);
// 이름이 "현수막" 이면 만들 때 이미 인쇄물로 잡힌다. 그러면 이 메뉴가 없다.
if (await pg.getByRole("button", { name: "인쇄물(현수막) 분류로" }).count()) {
  await pg.getByRole("button", { name: "인쇄물(현수막) 분류로" }).click();
} else {
  await pg.keyboard.press("Escape");   // 메뉴만 닫는다
}
await pg.waitForTimeout(700);
await pg.getByRole("button", { name: /현수막/ }).first().click(); await pg.waitForTimeout(800);

/* ② 밖에서 받은 .ai 파일을 끌어다 놓는다 */
await pg.locator(".libdrop").evaluate((el, 짐) => {
  const dt = new DataTransfer();
  for (const f of 짐) {
    const bin = atob(f.b64); const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    dt.items.add(new File([u8], f.name, { type: "application/octet-stream" }));
  }
  el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
}, 짐);
await pg.waitForFunction(() => document.querySelectorAll(".libcard").length >= 1, null, { timeout: 45000 }).catch(() => {});
await pg.waitForTimeout(1200);
적(await pg.locator(".libcard").count() >= 1, "밖에서 받은 .ai 가 담긴다");
const 규격글 = (await pg.locator(".libname small").allTextContents()).map((t) => t.trim()).join(" | ");
적(/cm/.test(규격글), "그 파일의 실제 규격을 읽어 낸다", 규격글 || "(없음)");
await pg.screenshot({ path: `${OUT}/1-자료올림.png` });

/* ③ 그 규격 그대로 새 현수막을 만든다 */
await pg.locator(".빈자리").getByRole("button", { name: "신규 등록" }).click(); await pg.waitForTimeout(900);
await pg.locator(".field input").nth(0).fill("400");
await pg.locator(".field input").nth(1).fill("70");
await pg.locator(".field input").nth(2).fill("제주 유채꽃 축제");
await pg.getByRole("button", { name: "이 규격으로 시작" }).click();
await pg.waitForSelector(".pagechip", { timeout: 20000 }); await pg.waitForTimeout(1300);

/* ④ 올린 자료를 대화창에 끌어다 놓고 "이걸 바탕으로" 시킨다 */
await pg.locator(".dock-box").first().evaluate((el, 짐) => {
  const dt = new DataTransfer();
  for (const f of 짐) {
    const bin = atob(f.b64); const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    dt.items.add(new File([u8], f.name, { type: "application/octet-stream" }));
  }
  el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
}, 짐);
await pg.waitForTimeout(4000);
await pg.screenshot({ path: `${OUT}/2-대화창에올림.png` });
await pg.locator(".dock-box textarea").first().fill("올린 현수막 느낌으로 유채꽃 넣어서 시안 2개 만들어줘");
await pg.locator(".dock-box textarea").first().press("Enter");
await pg.waitForSelector(".draftcard", { timeout: 30000 }).catch(() => {});
await pg.waitForTimeout(1800);
적(받은.length >= 1, "AI 를 불렀다", `${받은.length}번`);
적((받은[0]?.사진수 ?? 0) >= 2, "올린 자료가 AI 에게 그림으로 갔다",
   `화면 1장 + 올린 것 ${(받은[0]?.사진수 ?? 1) - 1}장`);
적(await pg.locator(".draftcard").count() >= 3, "시안이 섰다", `${await pg.locator(".draftcard").count()}칸`);
await pg.screenshot({ path: `${OUT}/3-시안.png` });

/* ⑤ 2안을 고른다 */
await pg.locator(".draftcard").nth(2).getByRole("button", { name: "2안으로" }).click();
await pg.waitForTimeout(1800);
const 들어간것 = await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  const p = (d.projects || []).find((x) => x.title.includes("유채꽃"));
  return p?.slides?.[0]?.content ?? {};
});
적(String(들어간것.art || "").startsWith("<svg"), "고른 그림이 들어갔다");
적(들어간것.자리 === "왼쪽", "글 자리까지 같이 들어갔다", String(들어간것.자리));

/* ⑥ 거기서 또 고친다 — 말로 */
await pg.locator(".dock-box textarea").first().fill("글씨를 왼쪽으로 몰아줘");
await pg.locator(".dock-box textarea").first().press("Enter");
await pg.waitForTimeout(3500);
const 또고침 = await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  const p = (d.projects || []).find((x) => x.title.includes("유채꽃"));
  return p?.slides?.[0]?.content?.자리;
});
적(또고침 === "왼쪽", "고른 뒤에도 말로 계속 고칠 수 있다", String(또고침));

/* ⑦ 손으로도 고친다 */
const 큰글씨 = pg.locator(".pane-right .field input:visible").first();
await 큰글씨.fill("제주 봄 유채꽃 축제");
await pg.waitForTimeout(1500);
const 손으로 = await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  const p = (d.projects || []).find((x) => x.title.includes("유채"));
  return p?.slides?.[0]?.content?.주제목;
});
적(String(손으로).includes("봄"), "손으로도 글을 고칠 수 있다", String(손으로));

/* ⑧ 인쇄소로 */
적(await pg.getByRole("button", { name: "인쇄용 PDF" }).count() > 0, "인쇄용 저장이 있다");
await pg.screenshot({ path: `${OUT}/4-완성.png` });

if (터짐.length) { console.log("\n✗ 터진 자리:"); [...new Set(터짐)].slice(0, 5).forEach((t) => console.log("   ", t.slice(0, 140))); 탈.push("화면 오류"); }
console.log(탈.length ? `\n끊기는 데 ${탈.length}곳:\n  ` + 탈.join("\n  ") : "\n끝까지 안 끊긴다");
console.log(`화면: ${OUT}`);
await b.close();
