/*
  통합 백업 — 원본 파일까지 담기는가

  예전 백업(JSON)은 제안서와 미리보기만 담고 원본 파일을 흘렸다.
  여기서는 묶음(zip)을 만들어 보고, 그 안을 열어 원본이 실제로 들어 있는지,
  해시가 적혀 있는지, 빠진 것이 없는지 센다.
*/
import { chromium } from "playwright";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { unzipSync } from "fflate";
import { createHash } from "node:crypto";

const OUT = process.argv[2] || "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad";
const 터 = `${OUT}/현수막`;
let 탈 = 0;
const 봄 = (말, 됨, 덧 = "") => { console.log(`${됨 ? "✓" : "✗"} ${말}${덧 ? " — " + 덧 : ""}`); if (!됨) 탈++; };

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 1700, height: 1050 }, acceptDownloads: true });
const pg = await ctx.newPage();
pg.on("pageerror", (e) => { console.log("✗ 페이지오류:", e.message); 탈++; });

await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await pg.evaluate(() => localStorage.clear());
await pg.evaluate(() => new Promise((r) => { const q = indexedDB.deleteDatabase("mtmb-thumbs"); q.onsuccess = q.onerror = q.onblocked = () => r(); }));
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1200);

// 들어가기
await pg.locator(".namebox").fill("정세종");
await pg.locator(".pinbox").fill("2230");
await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1600);
if (await pg.getByRole("button", { name: /보관함 보기/ }).count()) {
  await pg.getByRole("button", { name: /보관함 보기/ }).click(); await pg.waitForTimeout(800);
}

// 분류를 만들고 자료를 넣는다
await pg.locator(".secadd").click(); await pg.waitForTimeout(400);
await pg.locator(".catnew").fill("현수막");
await pg.locator(".catnew").press("Enter"); await pg.waitForTimeout(700);
await pg.locator(".catnew").press("Escape"); await pg.waitForTimeout(400);
await pg.getByRole("button", { name: /현수막/ }).first().click(); await pg.waitForTimeout(700);

const 넣을것 = [
  ...[1, 2, 3].map((n) => `${터}/현수막-${n}.ai`),
  `${OUT}/회사소개.pptx`, `${OUT}/제안요청서.docx`,
].filter((p) => existsSync(p));
const 짐 = 넣을것.map((p) => ({ name: p.split("/").pop(), b64: readFileSync(p).toString("base64") }));
await pg.locator(".libdrop").evaluate((el, 짐) => {
  const dt = new DataTransfer();
  for (const f of 짐) {
    const bin = atob(f.b64); const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    dt.items.add(new File([u8], f.name, { type: "application/octet-stream" }));
  }
  el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
}, 짐);
await pg.waitForFunction((n) => document.querySelectorAll(".libcard").length >= n, 짐.length, { timeout: 60000 });
await pg.waitForTimeout(1500);
봄(`시험 자료 ${짐.length}개를 담았다`, (await pg.locator(".libcard").count()) >= 짐.length);

// 칸에 실제로 몇 개가 들어갔나 — 화면 말고 저장소를 직접 센다
const 칸센것 = await pg.evaluate(() => new Promise((res) => {
  const q = indexedDB.open("mtmb-thumbs", 2);
  q.onsuccess = () => {
    const db = q.result;
    const t = db.transaction(["files", "thumbs"], "readonly");
    const a = t.objectStore("files").getAllKeys();
    const c = t.objectStore("thumbs").getAllKeys();
    t.oncomplete = () => res({ 원본: a.result.length, 그림: c.result.length });
  };
}));
console.log(`  저장소 실제: 원본 ${칸센것.원본}개 · 미리보기 ${칸센것.그림}장`);
봄("원본 파일이 칸에 들어 있다", 칸센것.원본 > 0, `${칸센것.원본}개`);

// 창고 → 보관
await pg.getByRole("button", { name: "창고", exact: true }).click(); await pg.waitForTimeout(700);
await pg.getByRole("button", { name: "보관", exact: true }).click(); await pg.waitForTimeout(700);
봄("보관 화면에 「전체 백업」 이 있다", await pg.getByRole("button", { name: "전체 백업" }).count() === 1);
봄("예전 방식(JSON) 백업도 남아 있다", await pg.getByRole("button", { name: /간편 백업/ }).count() === 1);

// 전체 백업
const 받기 = pg.waitForEvent("download", { timeout: 120000 });
await pg.getByRole("button", { name: "전체 백업" }).click();
const 내려온것 = await 받기;
const 묶음길 = `${OUT}/전체백업-시험.zip`;
await 내려온것.saveAs(묶음길);
await pg.waitForTimeout(1500);

const 끝말 = (await pg.locator(".goodnote").count()) ? (await pg.locator(".goodnote").innerText()).trim() : "";
// Playwright 는 blob 내려받기의 이름을 "download" 로만 알려 준다.
// 그래서 앱이 실제로 붙인 이름(화면에 찍힌 것)으로 본다.
const 붙인이름 = (끝말.match(/MTMB-[^\s(]+\.zip/) ?? [""])[0];
봄("파일 이름이 규칙대로다", /^MTMB-디자인스튜디오-전체백업-\d{8}\.zip$/.test(붙인이름), 붙인이름 || "(이름 못 찾음)");
const 반말 = (await pg.locator(".정말칸").count()) ? (await pg.locator(".정말칸").innerText()).trim() : "";
봄("「모두 담겼습니다」 로 끝났다", 끝말.includes("모두 담겼습니다"), 끝말.slice(0, 80) || 반말.slice(0, 80));
봄("빠진 것 경고가 뜨지 않았다", !반말.includes("전체 백업이 아닙니다"));

/* ── 묶음 속을 연다 ── */
const 푼것 = unzipSync(new Uint8Array(readFileSync(묶음길)));
const 길들 = Object.keys(푼것);
봄("manifest.json 이 있다", 길들.includes("manifest.json"));
봄("database.json 이 있다", 길들.includes("database.json"));

const 목록 = JSON.parse(Buffer.from(푼것["manifest.json"]).toString("utf8"));
const 속 = JSON.parse(Buffer.from(푼것["database.json"]).toString("utf8"));
const 원본길 = 길들.filter((k) => k.startsWith("files/"));
const 그림길 = 길들.filter((k) => k.startsWith("thumbnails/"));
console.log(`  묶음 속: 원본 ${원본길.length}개 · 미리보기 ${그림길.length}장 · ${(readFileSync(묶음길).length / 1048576).toFixed(2)}MB`);

봄("원본이 files/ 에 담겼다", 원본길.length === 칸센것.원본, `묶음 ${원본길.length} / 저장소 ${칸센것.원본}`);
봄("미리보기가 thumbnails/ 에 담겼다", 그림길.length === 칸센것.그림, `묶음 ${그림길.length} / 저장소 ${칸센것.그림}`);
봄("목록의 건수와 실제가 맞는다", 목록.건수.원본파일 === 원본길.length && 목록.건수.미리보기 === 그림길.length);
봄("빠진 것이 없다", (목록.빠진것 ?? []).length === 0, JSON.stringify(목록.빠진것 ?? []).slice(0, 100));
봄("백업 판이 적혀 있다", 목록.판 >= 2, `판 ${목록.판}`);
봄("만든 때가 적혀 있다", !!목록.만든때);
봄("제안서 자료가 들어 있다", Array.isArray(속.db?.projects) && Array.isArray(속.db?.categories));
봄("분류가 담겼다", 속.db.categories.some((c) => c.name === "현수막"));
봄("자료 목록이 담겼다", 속.db.library.length === 짐.length, `${속.db.library.length}건`);

// 해시가 진짜 맞는가 — 묶음 속 알맹이를 직접 다시 재 본다
let 해시틀림 = 0;
for (const x of 목록.원본) {
  const 몸 = 푼것[x.담은이름];
  if (!몸) { 해시틀림++; continue; }
  if (createHash("sha256").update(Buffer.from(몸)).digest("hex") !== x.해시) 해시틀림++;
}
봄("원본 해시가 모두 맞는다", 해시틀림 === 0, `어긋남 ${해시틀림}개`);

// 원본이 진짜 그 파일인가 — 넣은 파일과 바이트째 대조
const 넣은해시 = new Map(넣을것.map((p) => [p.split("/").pop(), createHash("sha256").update(readFileSync(p)).digest("hex")]));
let 딴것 = 0, 맞은것 = 0;
for (const x of 목록.원본) {
  const 원래 = 넣은해시.get(x.이름);
  if (!원래) continue;
  if (원래 === x.해시) 맞은것++; else 딴것++;
}
봄("담긴 원본이 올린 파일과 바이트째 같다", 딴것 === 0 && 맞은것 === 넣을것.length, `같음 ${맞은것} / 다름 ${딴것}`);

// 예전 JSON 백업에는 원본이 없다는 것도 확인해 둔다 (왜 묶음이 필요한지의 근거)
const 받기2 = pg.waitForEvent("download", { timeout: 60000 });
await pg.getByRole("button", { name: /간편 백업/ }).click();
const json길 = `${OUT}/간편백업-시험.json`;
await (await 받기2).saveAs(json길);
const 옛것 = JSON.parse(readFileSync(json길, "utf8"));
봄("예전 JSON 에는 원본 파일이 없다 (묶음이 필요한 까닭)", 옛것.db && !("files" in 옛것) && Object.keys(옛것.thumbs ?? {}).length > 0);

writeFileSync(`${OUT}/전체백업-목록.json`, JSON.stringify(목록, null, 1));
await ctx.close(); await b.close();
console.log(탈 ? `\n실패 ${탈}개` : "\n다 됐다");
process.exit(탈 ? 1 : 0);
