import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1800, height: 1050 }, deviceScaleFactor: 1.2 });
pg.on("pageerror", e => console.log("✗ 페이지오류:", e.message));

let 보낸시스템 = "";
await pg.route("**/api/ai", async (route) => {
  try { 보낸시스템 = JSON.parse(route.request().postData() || "{}").system || ""; } catch {}
  const reply = { say: "두 가지로 해 봤습니다. 보시고 고르시면 그 장에만 들어갑니다.", actions: [{ do: "시안", options: [
    { name: "선만 남기고 색 빼기", why: "강조색을 먹색으로 바꿨습니다", pageTypeId: "bullets",
      content: { title: "제안 요약", subtitle: "핵심만 세 줄로.",
        items: [{ label: "판매처 입점", desc: "주요 플랫폼 등록" }, { label: "상품 구성", desc: "수요자별 설계" }] },
      style: { "color.accent": "#2B2B2B", "type.pageTitle.size": 21 } },
    { name: "표로 또박또박", why: "심사자가 짚기 쉽게", pageTypeId: "table-rows",
      content: { title: "제안 요약", col1: "항목", col2: "내용", col3: "비고",
        rows: [{ label: "사업 기간", v1: "2026. 3 ~ 12", v2: "10개월" }] },
      style: { "color.accent": "#8C8C8C" } },
  ] }] };
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: JSON.stringify(reply) }) });
});

await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await pg.evaluate(() => localStorage.clear());
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1200);
// 로그인 화면이 생긴 뒤로는 여기를 지나야 보관함이 나온다
await pg.locator(".namebox").fill("박시영"); await pg.locator(".pinbox").fill("2230");
await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1500);
await pg.locator(".card").first().click(); await pg.waitForTimeout(1000);

// 열람 화면에서 3번째 장으로 넘긴다 (대표가 한 그대로)
await pg.locator(".browse-stage .nav").nth(1).click(); await pg.waitForTimeout(400);
await pg.locator(".browse-stage .nav").nth(1).click(); await pg.waitForTimeout(700);
console.log("머리말:", (await pg.locator(".dock-where").first().innerText()).replace(/\n/g," "));
const 쪽 = () => pg.locator(".browse-stage").getByText(/^\d+ \/ \d+$/).first().innerText();
console.log("보고 있는 장:", await 쪽());

const 모습 = () => pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  const p = (d.projects || [])[0]; return p ? p.slides[2].pageTypeId : "?";
});
console.log("요청 전 3번 장 틀:", await 모습());

await pg.locator(".dock textarea").first().fill("이 페이지 디자인이 마음에 안 들어. 세련되고 색감 빼고 두 가지로 다시 보여줘");
await pg.getByRole("button", { name: "보내기" }).first().click();
await pg.waitForTimeout(4000);
console.log("AI 에게 보낸 설명서:", 보낸시스템.includes("보관함(첫 화면)") ? "보관함용 ✗" : "페이지용 ✓");
console.log("시안판 떴나:", await pg.locator(".drafts").count() ? "예 ✓" : "아니오 ✗");
console.log("카드 수(지금 것 포함):", await pg.locator(".draftcard").count());
console.log("이름:", (await pg.locator(".draftinfo b").allTextContents()).join(" | "));
console.log("대화창 아직 보이나:", await pg.locator(".dock textarea").first().isVisible() ? "예 ✓" : "아니오 ✗");
console.log("고르기 전 3번 장 틀:", await 모습(), "← 그대로여야 한다");
await pg.screenshot({ path: `${OUT}/열람시안.png` });

await pg.locator(".draftcard").nth(2).getByRole("button", { name: "2안으로" }).click();
await pg.waitForTimeout(2000);
console.log("고른 뒤 보고 있는 장:", await 쪽());
await pg.waitForTimeout(6000);
console.log("고른 뒤 3번 장 틀:", await 모습(), "← table-rows 여야 한다");
console.log("그 장만의 규격:", await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  return JSON.stringify((d.projects||[])[0]?.slides[2]?.styleOverride ?? null);
}));
await pg.screenshot({ path: `${OUT}/열람고른뒤.png` });
await b.close();
