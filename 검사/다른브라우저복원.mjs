/*
  다른 브라우저에서 되살아나는가

  백업은 "받아 뒀다" 가 아니라 "되살릴 수 있다" 가 되어야 한다.
  그래서 자료가 든 브라우저 A 에서 묶음을 만들고,
  아무것도 없는 브라우저 B 에서 그 묶음만으로 되살려 본다.
  건수·해시·연결 관계·편집까지 모두 맞아야 통과다.
*/
import { chromium } from "playwright";
import { readFileSync, existsSync } from "node:fs";
import { unzipSync } from "fflate";

const OUT = process.argv[2] || "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad";
const 터 = `${OUT}/현수막`;
let 탈 = 0;
const 봄 = (말, 됨, 덧 = "") => { console.log(`${됨 ? "✓" : "✗"} ${말}${덧 ? " — " + 덧 : ""}`); if (!됨) 탈++; };

/** 저장소를 직접 훑어 센다 — 화면 말고 알맹이를 믿는다 */
const 속내 = (pg) => pg.evaluate(async () => {
  const 해시 = async (b) => {
    const d = await crypto.subtle.digest("SHA-256", await b.arrayBuffer());
    return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join("");
  };
  const db = JSON.parse(localStorage.getItem("mtmb-studio-v1") ?? "{}");
  // 없는 칸을 괜히 만들면 앱이 쓰는 칸을 비어 있는 채로 선점해 버린다.
  // 그래서 있는지 먼저 보고, 없으면 손대지 않고 0 으로 센다.
  const 빔 = { fk: [], fv: [], tk: [] };
  const 있나 = (await indexedDB.databases?.().catch(() => []) ?? []).some((d) => d.name === "mtmb-thumbs");
  const idb = !있나 ? 빔 : await new Promise((res) => {
    const q = indexedDB.open("mtmb-thumbs");
    q.onerror = () => res(빔);
    q.onsuccess = () => {
      const db = q.result;
      if (!db.objectStoreNames.contains("files") || !db.objectStoreNames.contains("thumbs")) { db.close(); return res(빔); }
      const t = db.transaction(["files", "thumbs"], "readonly");
      const fk = t.objectStore("files").getAllKeys(), fv = t.objectStore("files").getAll();
      const tk = t.objectStore("thumbs").getAllKeys();
      t.oncomplete = () => res({ fk: fk.result, fv: fv.result, tk: tk.result });
      t.onerror = () => res(빔);
    };
  });
  const 파일해시 = {};
  for (let i = 0; i < idb.fk.length; i++) 파일해시[idb.fk[i]] = await 해시(idb.fv[i]);
  return {
    제안서: db.projects?.length ?? 0,
    페이지: (db.projects ?? []).reduce((n, p) => n + (p.slides?.length ?? 0), 0),
    분류: db.categories?.length ?? 0,
    자료: db.library?.length ?? 0,
    대화: Object.keys(db.chats ?? {}).length,
    대화줄: Object.values(db.chats ?? {}).reduce((n, v) => n + v.length, 0),
    기록: (db.history?.length ?? 0) + (db.trail?.length ?? 0),
    규칙: db.rules?.length ?? 0,
    원본: idb.fk.length,
    미리보기: idb.tk.length,
    파일해시,
    // 자료가 어느 건에 붙어 있는가 — 연결 관계
    붙은것: (db.library ?? []).filter((x) => x.projectId).map((x) => `${x.fileName}→${x.projectId}`).sort(),
    제안서이름: (db.projects ?? []).map((p) => p.title).sort(),
  };
});

const 들어가기 = async (pg) => {
  await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });
  await pg.waitForTimeout(1000);
  if (await pg.locator(".gate").count()) {
    await pg.locator(".namebox").fill("정세종");
    await pg.locator(".pinbox").fill("2230");
    await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1600);
  }
  if (await pg.getByRole("button", { name: /보관함 보기/ }).count()) {
    await pg.getByRole("button", { name: /보관함 보기/ }).click(); await pg.waitForTimeout(800);
  }
};
const 보관가기 = async (pg) => {
  await pg.getByRole("button", { name: "설정", exact: true }).click(); await pg.waitForTimeout(700);
  await pg.getByRole("button", { name: "백업", exact: true }).click(); await pg.waitForTimeout(700);
};

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

/* ══ 브라우저 A — 자료를 만들고 백업한다 ══ */
console.log("── 브라우저 A ──");
const A = await b.newContext({ viewport: { width: 1700, height: 1050 }, acceptDownloads: true });
const pa = await A.newPage();
pa.on("pageerror", (e) => { console.log("✗ A 페이지오류:", e.message); 탈++; });
await 들어가기(pa);

// 현수막 분류를 인쇄물로 만들고 완성본 3장을 올린다 → 제안서 3건 + 자료 3개가 붙는다
await pa.locator(".secadd").click(); await pa.waitForTimeout(400);
await pa.locator(".catnew").fill("현수막");
await pa.locator(".catnew").press("Enter"); await pa.waitForTimeout(700);
await pa.locator(".catnew").press("Escape"); await pa.waitForTimeout(400);
await pa.getByRole("button", { name: /현수막/ }).first().click(); await pa.waitForTimeout(700);

const 쓸것 = [1, 2, 3].map((n) => `${터}/현수막-${n}.ai`).filter(existsSync);
const 짐 = 쓸것.map((p) => ({ name: p.split("/").pop(), b64: readFileSync(p).toString("base64") }));
const 놓기 = async (pg, 곳, 것) => pg.locator(곳).evaluate((el, 것) => {
  const dt = new DataTransfer();
  for (const f of 것) {
    const bin = atob(f.b64); const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    dt.items.add(new File([u8], f.name, { type: "application/octet-stream" }));
  }
  el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
}, 것);

await 놓기(pa, await pa.locator(".빈자리").count() ? ".빈자리" : ".libdrop", 짐);
await pa.waitForTimeout(6000);

// 대화와 기록도 한 줄 심어 둔다 — 이것까지 넘어가야 한다
await pa.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1"));
  d.chats = d.chats ?? {};
  d.chats["보관함:전체"] = [
    { role: "user", text: "현수막 백업 시험용 대화" },
    { role: "ai", text: "알겠습니다" },
  ];
  localStorage.setItem("mtmb-studio-v1", JSON.stringify(d));
});
await pa.reload({ waitUntil: "networkidle" }); await pa.waitForTimeout(1800);
if (await pa.getByRole("button", { name: /보관함 보기/ }).count()) {
  await pa.getByRole("button", { name: /보관함 보기/ }).click(); await pa.waitForTimeout(600);
}

const 전 = await 속내(pa);
console.log(`  A: 제안서 ${전.제안서} · 페이지 ${전.페이지} · 자료 ${전.자료} · 원본 ${전.원본} · 미리보기 ${전.미리보기} · 대화 ${전.대화줄}줄`);
봄("A 에 원본 파일이 있다", 전.원본 >= 3, `${전.원본}개`);
봄("A 에서 자료가 제안서에 붙어 있다", 전.붙은것.length >= 3, `${전.붙은것.length}건`);

await 보관가기(pa);
const 받기 = pa.waitForEvent("download", { timeout: 120000 });
await pa.getByRole("button", { name: "전체 백업" }).click();
const 묶음길 = `${OUT}/A-전체백업.zip`;
await (await 받기).saveAs(묶음길);
await pa.waitForTimeout(1200);
const 묶음 = readFileSync(묶음길);
const 푼것 = unzipSync(new Uint8Array(묶음));
console.log(`  묶음 ${(묶음.length / 1048576).toFixed(2)}MB · 속 ${Object.keys(푼것).length}개`);
봄("A 백업이 「모두 담겼습니다」 로 끝났다",
  (await pa.locator(".goodnote").innerText()).includes("모두 담겼습니다"));

/* ══ 브라우저 B — 아무것도 없는 곳에서 되살린다 ══ */
console.log("\n── 브라우저 B (빈 브라우저) ──");
const B = await b.newContext({ viewport: { width: 1700, height: 1050 }, acceptDownloads: true });
const pb = await B.newPage();
pb.on("pageerror", (e) => { console.log("✗ B 페이지오류:", e.message); 탈++; });
await 들어가기(pb);
const B전 = await 속내(pb);
console.log(`  B 처음: 제안서 ${B전.제안서} · 자료 ${B전.자료} · 원본 ${B전.원본}`);
봄("B 는 A 와 다른 빈 브라우저다", B전.원본 === 0 && B전.자료 === 0, `원본 ${B전.원본} · 자료 ${B전.자료}`);

await 보관가기(pb);
// 되살리기 직전 자동 백업이 떨어지는지도 본다 (지시서 3항의 안전장치)
let 자동백업 = null;
pb.on("download", (d) => { if (!자동백업) 자동백업 = d; });

await pb.locator('input[type=file][accept*="zip"]').evaluate((el, b64) => {
  const bin = atob(b64); const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const dt = new DataTransfer();
  dt.items.add(new File([u8], "A-전체백업.zip", { type: "application/zip" }));
  el.files = dt.files;
  el.dispatchEvent(new Event("change", { bubbles: true }));
}, 묶음.toString("base64"));
await pb.waitForTimeout(700);
봄("되살리기 전에 한 번 더 묻는다", await pb.locator(".정말칸").count() === 1);
await pb.getByRole("button", { name: "되살리기" }).click();

await pb.waitForFunction(() => document.querySelector(".goodnote") || document.querySelector(".gateerr"), null, { timeout: 180000 });
await pb.waitForTimeout(2500);
const 탈난 = await pb.locator(".gateerr").count() ? (await pb.locator(".gateerr").innerText()).trim() : "";
봄("복원이 탈 없이 끝났다", !탈난, 탈난.slice(0, 120));
const 복말 = await pb.locator(".goodnote").count() ? (await pb.locator(".goodnote").innerText()).trim() : "";
console.log(`  복원 결과: ${복말.slice(0, 130)}`);
봄("해시까지 맞았다고 알린다", 복말.includes("해시까지 모두 맞았습니다"));
봄("되살리기 전 자동 백업이 떨어졌다", !!자동백업, 자동백업 ? "있음" : "없음");

/* ── 합격 기준 대조 ── */
const 후 = await 속내(pb);
console.log(`  B 복원 뒤: 제안서 ${후.제안서} · 페이지 ${후.페이지} · 자료 ${후.자료} · 원본 ${후.원본} · 미리보기 ${후.미리보기} · 대화 ${후.대화줄}줄`);
봄("제안서 건수 일치", 후.제안서 === 전.제안서, `${전.제안서} → ${후.제안서}`);
봄("페이지 건수 일치", 후.페이지 === 전.페이지, `${전.페이지} → ${후.페이지}`);
봄("분류 건수 일치", 후.분류 === 전.분류, `${전.분류} → ${후.분류}`);
봄("자료 건수 일치", 후.자료 === 전.자료, `${전.자료} → ${후.자료}`);
봄("원본 파일 건수 일치", 후.원본 === 전.원본, `${전.원본} → ${후.원본}`);
봄("미리보기 건수 일치", 후.미리보기 === 전.미리보기, `${전.미리보기} → ${후.미리보기}`);
봄("대화 줄 수 일치", 후.대화줄 === 전.대화줄, `${전.대화줄} → ${후.대화줄}`);
봄("기록 건수 일치", 후.기록 === 전.기록, `${전.기록} → ${후.기록}`);
봄("규칙 건수 일치", 후.규칙 === 전.규칙);
봄("제안서 이름이 그대로다", JSON.stringify(후.제안서이름) === JSON.stringify(전.제안서이름));
봄("자료↔제안서 연결이 그대로다", JSON.stringify(후.붙은것) === JSON.stringify(전.붙은것), `${후.붙은것.length}건`);

let 해시틀림 = 0;
for (const [id, h] of Object.entries(전.파일해시)) if (후.파일해시[id] !== h) 해시틀림++;
봄("원본 파일 해시가 전부 일치", 해시틀림 === 0, `어긋남 ${해시틀림}개`);

/* ── 복원 뒤에 실제로 쓸 수 있는가 ── */
await pb.getByRole("button", { name: "보관함", exact: true }).click(); await pb.waitForTimeout(1200);
if (await pb.getByRole("button", { name: /보관함 보기/ }).count()) {
  await pb.getByRole("button", { name: /보관함 보기/ }).click(); await pb.waitForTimeout(800);
}
봄("복원된 작업물이 목록에 보인다", await pb.locator(".card, .cardwrap").count() > 0,
  `${await pb.locator(".card, .cardwrap").count()}건`);

// 자료 카드가 아니라 제안서 카드를 집는다 (이름으로 찾는다)
const 제안카드 = pb.locator(".card, .cardwrap").filter({ hasText: "인천시티투어" }).first();
const 열것 = await 제안카드.count() ? 제안카드 : pb.locator(".card, .cardwrap").first();
await 열것.click(); await pb.waitForTimeout(2000);
봄("제안서를 열어 볼 수 있다", await pb.locator(".browse, .stage").count() > 0);

// 열람에서 편집기로. 현수막처럼 바로 편집기가 열리는 길도 있다.
if (await pb.getByRole("button", { name: "편집하기" }).count()) {
  await pb.getByRole("button", { name: "편집하기" }).click(); await pb.waitForTimeout(2200);
}
const 편집중 = await pb.locator(".stage").count() > 0 && await pb.locator(".pagechip").count() > 0;
봄("복원 뒤 편집기가 열린다", 편집중);

if (편집중) {
  const 글칸 = pb.locator(".pane-right .field input:not([type=file]):not([type=checkbox])").first();
  봄("고칠 수 있는 글칸이 있다", await 글칸.count() > 0);
  if (await 글칸.count()) {
    await 글칸.fill("복원 뒤 고쳐 쓴 제목");
    await 글칸.blur();
    await pb.waitForTimeout(2500);
    const 저장 = await pb.locator(".savedtag").count() ? (await pb.locator(".savedtag").innerText()).trim() : "";
    봄("복원 뒤 고치면 저장된다", /저장됨/.test(저장), 저장 || "(표시 없음)");
    const 되읽음 = await pb.evaluate(() =>
      JSON.parse(localStorage.getItem("mtmb-studio-v1")).projects
        .some((p) => JSON.stringify(p).includes("복원 뒤 고쳐 쓴 제목")));
    봄("고친 것이 실제로 저장소에 들어갔다", 되읽음);
  }
  // 복원된 원본 파일이 실제로 열리는가 — 파일함에서 꺼내 본다
  const 원본꺼냄 = await pb.evaluate(async () => {
    const db = JSON.parse(localStorage.getItem("mtmb-studio-v1"));
    const 하나 = (db.library ?? []).find((x) => x.hasFile);
    if (!하나) return null;
    return await new Promise((res) => {
      const q = indexedDB.open("mtmb-thumbs");
      q.onsuccess = () => {
        const t = q.result.transaction("files", "readonly");
        const r = t.objectStore("files").get(하나.id);
        t.oncomplete = () => res(r.result ? { 이름: 하나.fileName, 크기: r.result.size } : null);
        t.onerror = () => res(null);
      };
    });
  });
  봄("복원된 원본 파일을 실제로 꺼내 읽을 수 있다", !!원본꺼냄 && 원본꺼냄.크기 > 0,
    원본꺼냄 ? `${원본꺼냄.이름} ${원본꺼냄.크기}바이트` : "못 꺼냄");
}

await A.close(); await B.close(); await b.close();
console.log(탈 ? `\n실패 ${탈}개` : "\n다 됐다");
process.exit(탈 ? 1 : 0);
