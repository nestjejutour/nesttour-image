/**
 * 글자가 바탕에 묻히는 자리를 찾는다.
 *
 * 대표님이 두 번 겪으신 일이다 — 진한 박스 위의 글자, 검은 줄 위의 검은 글자.
 * 눈으로 훑으면 놓친다. 그래서 화면에 뜬 글자를 전부 집어서
 * 바탕색과 글자색의 밝기 차를 센다. 4.5 아래면 읽기 힘든 것이다(국제 기준).
 */
import { chromium } from "playwright";

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1700, height: 1050 } });
await pg.route("**/api/ai", (r) => r.fulfill({ status: 200, contentType: "application/json",
  body: JSON.stringify({ text: JSON.stringify({ say: "네.", actions: [] }) }) }));

const 재기 = async () => pg.evaluate(() => {
  const 빛 = (c) => {
    const [r, g, bb] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bb;
  };
  const 뜯기 = (s) => { const m = s.match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : null; };
  const 바탕찾기 = (el) => {
    let e = el;
    while (e) {
      const c = getComputedStyle(e).backgroundColor;
      const a = c.match(/[\d.]+/g);
      if (a && (a.length < 4 || Number(a[3]) > 0.5)) return 뜯기(c);
      e = e.parentElement;
    }
    return [255, 255, 255];
  };
  const 탈 = [];
  for (const el of document.querySelectorAll("body *")) {
    const 글 = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").trim();
    if (!글) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const st = getComputedStyle(el);
    if (st.visibility === "hidden" || st.opacity === "0" || st.display === "none") continue;
    const 앞 = 뜯기(st.color), 뒤 = 바탕찾기(el);
    if (!앞 || !뒤) continue;
    const l1 = 빛(앞), l2 = 빛(뒤);
    const 차 = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const 크다 = parseFloat(st.fontSize) >= 24 || (parseFloat(st.fontSize) >= 18.5 && Number(st.fontWeight) >= 700);
    if (차 < (크다 ? 3 : 4.5)) {
      탈.push({ 글: 글.slice(0, 30), 차: +차.toFixed(2), 글자색: st.color, 바탕: `rgb(${뒤.join(",")})`,
                크기: st.fontSize, 자리: el.className?.toString?.().slice(0, 40) || el.tagName });
    }
  }
  return 탈;
});

await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await pg.evaluate(() => localStorage.clear());
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1300);

const 화면들 = [];
화면들.push(["로그인", await 재기()]);

await pg.locator(".namebox").fill("박시영"); await pg.locator(".pinbox").fill("2230");
await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1800);
// 첫 화면이 "무엇을 만들어 드릴까요?" 작업대로 바뀌었다. 서류함을 보려면 한 번 눌러야 한다.
if (await pg.locator(".시작판").count()) {
  await pg.getByRole("button", { name: /보관함 보기/ }).click();
  await pg.waitForTimeout(700);
}
화면들.push(["보관함", await 재기()]);

await pg.locator(".card").first().click(); await pg.waitForTimeout(1400);
화면들.push(["한 건 열람", await 재기()]);
await pg.getByRole("button", { name: "편집하기" }).click(); await pg.waitForTimeout(1600);
화면들.push(["편집", await 재기()]);
await pg.getByRole("button", { name: "← 보관함" }).click(); await pg.waitForTimeout(1200);
for (const 탭 of ["기록", "설정"]) {
  await pg.getByRole("button", { name: 탭, exact: true }).click().catch(() => {});
  await pg.waitForTimeout(1200);
  화면들.push([탭, await 재기()]);
}

let 모두 = 0;
for (const [이름, 탈] of 화면들) {
  const 추린것 = [...new Map(탈.map((x) => [x.글 + x.차, x])).values()];
  모두 += 추린것.length;
  console.log(`\n── ${이름}: ${추린것.length ? `${추린것.length}곳` : "이상 없음"}`);
  추린것.slice(0, 8).forEach((x) =>
    console.log(`   차 ${x.차}  "${x.글}"  ${x.글자색} / ${x.바탕}  ${x.크기}  .${x.자리}`));
}
console.log(모두 ? `\n읽기 힘든 글자 ${모두}곳` : "\n읽기 힘든 글자 없음");
await b.close();
