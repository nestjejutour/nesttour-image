/*
  백업·복원이 탈났을 때 — 지금 자료를 지키는가

  백업에서 제일 무서운 것은 "실패"가 아니라 "반만 된 것을 다 됐다고 하는 것"이다.
  여기서는 일부러 탈을 내고, 그때마다 지금 자료가 멀쩡한지 센다.
*/
import { chromium } from "playwright";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { unzipSync, zipSync } from "fflate";

const OUT = process.argv[2] || "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad";
const 터 = `${OUT}/현수막`;
let 탈 = 0;
const 봄 = (말, 됨, 덧 = "") => { console.log(`${됨 ? "✓" : "✗"} ${말}${덧 ? " — " + 덧 : ""}`); if (!됨) 탈++; };

const 센다 = (pg) => pg.evaluate(async () => {
  const db = JSON.parse(localStorage.getItem("mtmb-studio-v1") ?? "{}");
  const 빔 = { f: 0, t: 0 };
  const 있나 = (await indexedDB.databases?.().catch(() => []) ?? []).some((d) => d.name === "mtmb-thumbs");
  const idb = !있나 ? 빔 : await new Promise((res) => {
    const q = indexedDB.open("mtmb-thumbs");
    q.onerror = () => res(빔);
    q.onsuccess = () => {
      const d = q.result;
      if (!d.objectStoreNames.contains("files")) { d.close(); return res(빔); }
      const t = d.transaction(["files", "thumbs"], "readonly");
      const a = t.objectStore("files").getAllKeys(), c = t.objectStore("thumbs").getAllKeys();
      t.oncomplete = () => res({ f: a.result.length, t: c.result.length });
      t.onerror = () => res(빔);
    };
  });
  return { 제안서: db.projects?.length ?? 0, 자료: db.library?.length ?? 0, 원본: idb.f, 그림: idb.t };
});

const 넣기 = async (pg, 이름, 알맹이b64, 받는칸 = 'input[type=file][accept*="zip"]') =>
  pg.locator(받는칸).evaluate((el, x) => {
    const bin = atob(x.b64); const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const dt = new DataTransfer();
    dt.items.add(new File([u8], x.n, { type: "application/zip" }));
    el.files = dt.files;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, { n: 이름, b64: 알맹이b64 });

const 들어가기 = async (pg) => {
  await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" }); await pg.waitForTimeout(1000);
  if (await pg.locator(".gate").count()) {
    await pg.locator(".namebox").fill("정세종"); await pg.locator(".pinbox").fill("2230");
    await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1600);
  }
  if (await pg.getByRole("button", { name: /보관함 보기/ }).count()) {
    await pg.getByRole("button", { name: /보관함 보기/ }).click(); await pg.waitForTimeout(700);
  }
};
const 보관가기 = async (pg) => {
  await pg.getByRole("button", { name: "창고", exact: true }).click(); await pg.waitForTimeout(600);
  await pg.getByRole("button", { name: "보관", exact: true }).click(); await pg.waitForTimeout(600);
};
const 탈난말 = async (pg) => (await pg.locator(".gateerr").count()) ? (await pg.locator(".gateerr").innerText()).trim() : "";

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const 새판 = async () => {
  const c = await b.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  const p = await c.newPage();
  p.on("pageerror", (e) => { console.log("✗ 페이지오류:", e.message); 탈++; });
  return { c, p };
};

/* ① 아무것도 없는 상태에서 백업 */
console.log("── ① 자료가 없는 상태에서 백업 ──");
{
  const { c, p } = await 새판();
  await 들어가기(p); await 보관가기(p);
  const 받기 = p.waitForEvent("download", { timeout: 60000 });
  await p.getByRole("button", { name: "전체 백업" }).click();
  const d = await 받기;
  const 길 = `${OUT}/빈백업.zip`; await d.saveAs(길);
  await p.waitForTimeout(800);
  봄("빈 상태에서도 묶음이 만들어진다", existsSync(길) && readFileSync(길).length > 0);
  봄("빈 상태에서도 탈이 안 난다", !(await 탈난말(p)), await 탈난말(p));
  await c.close();
}

/* ② 자료가 많은 상태에서 백업 + ③ 원본이 사라진 상태 */
console.log("\n── ② 자료가 있는 상태 / ③ 원본이 사라진 상태 ──");
let 성한묶음 = null;
{
  const { c, p } = await 새판();
  await 들어가기(p);
  await p.locator(".secadd").click(); await p.waitForTimeout(400);
  await p.locator(".catnew").fill("현수막");
  await p.locator(".catnew").press("Enter"); await p.waitForTimeout(700);
  await p.locator(".catnew").press("Escape"); await p.waitForTimeout(400);
  await p.getByRole("button", { name: /현수막/ }).first().click(); await p.waitForTimeout(700);

  const 쓸것 = [1, 2, 3, 4, 5].map((n) => `${터}/현수막-${n}.ai`).filter(existsSync);
  const 짐 = 쓸것.map((q) => ({ name: q.split("/").pop(), b64: readFileSync(q).toString("base64") }));
  await p.locator(await p.locator(".빈자리").count() ? ".빈자리" : ".libdrop").evaluate((el, 짐) => {
    const dt = new DataTransfer();
    for (const f of 짐) {
      const bin = atob(f.b64); const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      dt.items.add(new File([u8], f.name, { type: "application/octet-stream" }));
    }
    el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, 짐);
  await p.waitForTimeout(7000);
  const 전 = await 센다(p);
  console.log(`  담긴 것: 제안서 ${전.제안서} · 자료 ${전.자료} · 원본 ${전.원본}`);

  await 보관가기(p);
  const 받기 = p.waitForEvent("download", { timeout: 120000 });
  await p.getByRole("button", { name: "전체 백업" }).click();
  const 길 = `${OUT}/성한백업.zip`; await (await 받기).saveAs(길);
  await p.waitForTimeout(1200);
  성한묶음 = readFileSync(길);
  봄("자료가 많아도 「모두 담겼습니다」 로 끝난다",
    (await p.locator(".goodnote").innerText()).includes("모두 담겼습니다"));

  // ③ 목록에는 있다고 적혔는데 원본만 지운다
  const 지운이름 = await p.evaluate(async () => {
    const db = JSON.parse(localStorage.getItem("mtmb-studio-v1"));
    const 하나 = db.library.find((x) => x.hasFile);
    await new Promise((res) => {
      const q = indexedDB.open("mtmb-thumbs");
      q.onsuccess = () => {
        const t = q.result.transaction("files", "readwrite");
        t.objectStore("files").delete(하나.id);
        t.oncomplete = () => res();
      };
    });
    return 하나.fileName;
  });
  const 받기2 = p.waitForEvent("download", { timeout: 120000 });
  await p.getByRole("button", { name: "전체 백업" }).click();
  await (await 받기2).saveAs(`${OUT}/반쪽백업.zip`);
  await p.waitForTimeout(1500);
  const 경고 = (await p.locator(".정말칸").count()) ? (await p.locator(".정말칸").innerText()).trim() : "";
  봄("원본이 사라진 것을 잡아낸다", 경고.includes("전체 백업이 아닙니다"), 경고.split("\n")[0] || "(경고 없음)");
  봄("사라진 파일 이름을 알려 준다", 경고.includes(지운이름), 지운이름);
  봄("빠졌는데 「모두 담겼습니다」 라고 하지 않는다",
    !((await p.locator(".goodnote").count()) && (await p.locator(".goodnote").innerText()).includes("모두 담겼습니다")));
  await c.close();
}

/* ④ 묶음이 아닌 파일 / ⑤ 상한 묶음 / ⑦ 복원 중 탈 — 지금 자료가 멀쩡한가 */
console.log("\n── ④ 엉뚱한 파일 / ⑤ 상한 묶음 ──");
{
  const { c, p } = await 새판();
  await 들어가기(p); await 보관가기(p);
  const 전 = await 센다(p);

  await 넣기(p, "엉뚱한것.zip", Buffer.from("이건 묶음이 아니다").toString("base64"));
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: "되살리기" }).click();
  await p.waitForFunction(() => document.querySelector(".gateerr") || document.querySelector(".goodnote"), null, { timeout: 30000 });
  await p.waitForTimeout(800);
  봄("묶음이 아니면 막는다", (await 탈난말(p)).includes("묶음(zip) 파일이 아니거나"), (await 탈난말(p)).slice(0, 60));
  봄("막은 뒤 자료가 그대로다", JSON.stringify(await 센다(p)) === JSON.stringify(전));

  // 예전 JSON 을 전체 복원 칸에 넣었을 때 — 길을 알려 주는가
  await 넣기(p, "옛날백업.json", Buffer.from(JSON.stringify({ 판: 1, db: { projects: [] }, thumbs: {} })).toString("base64"));
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: "되살리기" }).click(); await p.waitForTimeout(1500);
  봄("예전 JSON 을 넣으면 어디로 가라고 알려 준다", (await 탈난말(p)).includes("예전 백업(JSON) 복원"), (await 탈난말(p)).slice(0, 80));

  // ⑤-가 묶음 자체가 깨진 경우 — 푸는 데서 걸려야 한다
  const 깨진것 = Buffer.from(성한묶음);
  const 자리 = Math.floor(깨진것.length * 0.6);
  for (let i = 0; i < 64; i++) 깨진것[자리 + i] = (깨진것[자리 + i] ^ 0xff) & 0xff;
  const 전2 = await 센다(p);
  await 넣기(p, "깨진백업.zip", 깨진것.toString("base64"));
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: "되살리기" }).click();
  await p.waitForFunction(() => document.querySelector(".gateerr") || document.querySelector(".goodnote"), null, { timeout: 60000 });
  await p.waitForTimeout(1200);
  봄("깨진 묶음은 푸는 데서 막는다", (await 탈난말(p)).includes("묶음(zip) 파일이 아니거나"), (await 탈난말(p)).slice(0, 70));
  봄("깨진 묶음을 만나도 지금 자료가 그대로다", JSON.stringify(await 센다(p)) === JSON.stringify(전2));

  /*
    ⑤-나 묶음은 멀쩡한데 알맹이만 바뀐 경우.

    위의 것은 zip 이 스스로 걸러 낸다 — 우리 해시 검사까지 가지도 않는다.
    해시가 정말 일을 하는지 보려면, 다시 제대로 묶어서 zip 은 통과하되
    목록에 적힌 해시와는 어긋나게 만들어야 한다.
  */
  const 푼원본 = unzipSync(new Uint8Array(성한묶음));
  const 바꿀길 = Object.keys(푼원본).find((k) => k.startsWith("files/"));
  const 바뀐알맹이 = Buffer.from(푼원본[바꿀길]);
  for (let i = 0; i < Math.min(32, 바뀐알맹이.length); i++) 바뀐알맹이[i] = (바뀐알맹이[i] ^ 0x5a) & 0xff;
  푼원본[바꿀길] = new Uint8Array(바뀐알맹이);
  const 바꿔친것 = Buffer.from(zipSync(푼원본, { level: 0 }));
  writeFileSync(`${OUT}/바꿔친백업.zip`, 바꿔친것);

  const 전3 = await 센다(p);
  await 넣기(p, "바꿔친백업.zip", 바꿔친것.toString("base64"));
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: "되살리기" }).click();
  await p.waitForFunction(() => document.querySelector(".gateerr") || document.querySelector(".goodnote"), null, { timeout: 60000 });
  await p.waitForTimeout(1500);
  const 말 = await 탈난말(p);
  봄("알맹이가 바뀌면 해시가 잡아낸다", 말.includes("온전하지 않습니다") && 말.includes("상한 파일"), 말.slice(0, 110));
  봄("해시가 어긋나도 지금 자료가 그대로다", JSON.stringify(await 센다(p)) === JSON.stringify(전3));
  await c.close();
}

/* ⑥ 백업 도중에 창을 닫아도 자료가 멀쩡한가 */
console.log("\n── ⑥ 백업 도중에 창을 닫음 ──");
{
  const { c, p } = await 새판();
  await 들어가기(p);
  const 전 = await 센다(p);
  await 보관가기(p);
  await p.getByRole("button", { name: "전체 백업" }).click();
  await p.waitForTimeout(120);                       // 담는 도중에
  await p.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });  // 끊는다
  await p.waitForTimeout(2500);
  const 후 = await 센다(p);
  봄("백업 도중 끊겨도 자료가 그대로다", JSON.stringify(후) === JSON.stringify(전), `${JSON.stringify(전)} → ${JSON.stringify(후)}`);
  await c.close();
}

/* ⑧ 같은 묶음을 두 번 되살린다 — 불어나지 않아야 한다 */
console.log("\n── ⑧ 같은 것을 두 번 되살림 ──");
{
  const { c, p } = await 새판();
  await 들어가기(p); await 보관가기(p);
  const 한번 = async () => {
    await 넣기(p, "성한백업.zip", 성한묶음.toString("base64"));
    await p.waitForTimeout(600);
    await p.getByRole("button", { name: "되살리기" }).click();
    await p.waitForFunction(() => document.querySelector(".goodnote") || document.querySelector(".gateerr"), null, { timeout: 120000 });
    await p.waitForTimeout(2000);
  };
  await 한번();
  봄("첫 복원이 된다", !(await 탈난말(p)), (await 탈난말(p)).slice(0, 80));
  const 처음 = await 센다(p);
  await 한번();
  const 두번째 = await 센다(p);
  봄("두 번 되살려도 건수가 불어나지 않는다",
    JSON.stringify(처음) === JSON.stringify(두번째), `${JSON.stringify(처음)} → ${JSON.stringify(두번째)}`);
  await c.close();
}

await b.close();
console.log(탈 ? `\n실패 ${탈}개` : "\n다 됐다");
process.exit(탈 ? 1 : 0);
