import { chromium } from "playwright";
const S = process.argv[2];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1800, height: 1050 }, deviceScaleFactor: 1.3 });
pg.on("pageerror", e => console.log("✗ 페이지오류:", e.message));

await pg.route("**/api/ai", async (route) => {
  const reply = {
    say: "세 가지로 해 봤습니다. 보시고 고르시면 그대로 들어갑니다.",
    actions: [{ do: "시안", options: [
      { name: "선 하나로 정리", why: "코랄을 빼고 얇은 선만으로 나눴습니다",
        pageTypeId: "bullets",
        content: { title: "제안 요약", subtitle: "핵심만 네 줄로 정리했습니다.",
          items: [{ label: "온라인 판매처 입점", desc: "주요 판매 플랫폼 등록" },
                  { label: "상품 구성", desc: "수요자별 설계" },
                  { label: "운영 대행", desc: "예약·정산" }] },
        style: { "color.accent": "#2B2B2B", "type.pageTitle.size": 21 } },
      { name: "표로 또박또박", why: "조건을 칸에 넣어 심사자가 짚기 쉽게",
        pageTypeId: "table-rows",
        content: { title: "제안 요약", col1: "항목", col2: "내용", col3: "비고",
          rows: [{ label: "사업 기간", v1: "2026. 3 ~ 12", v2: "10개월" },
                 { label: "사업 예산", v1: "일억이천만원", v2: "부가세 별도" }] },
        style: { "color.accent": "#8C8C8C" } },
      { name: "한 문장만 크게", why: "첫 장 뒤에 숨 고르는 자리로",
        pageTypeId: "quote",
        content: { quote: "찾아오게 만드는 것보다\n찾아지게 만드는 편이 빠릅니다.", source: "제안의 기본 생각" },
        style: { "type.pageTitle.size": 24 } },
    ] }],
  };
  await route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ text: JSON.stringify(reply) }) });
});

await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await pg.evaluate(() => localStorage.clear());
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1800);
await pg.locator(".card").first().click(); await pg.waitForTimeout(900);
await pg.getByRole("button", { name: "편집하기" }).click(); await pg.waitForTimeout(1500);
await pg.locator(".pagechip").nth(1).click(); await pg.waitForTimeout(700);

const 장이름 = () => pg.locator(".pagechip").nth(1).innerText();
console.log("고치기 전 2번 장:", (await 장이름()).replace(/\n/g, " "));

await pg.locator(".dock-box textarea").first()
  .fill("이 페이지 디자인이 마음에 안 들어. 세련되고 간결하게, 색감 빼고 다시 디자인해줘");
await pg.getByRole("button", { name: "보내기" }).first().click();
await pg.waitForTimeout(4000);

console.log("시안판 떴나:", await pg.locator(".drafts").count());
console.log("카드 수(지금 것 포함):", await pg.locator(".draftcard").count());
console.log("이름:", (await pg.locator(".draftinfo b").allTextContents()).join(" | "));
console.log("제안서 아직 그대로인가:", (await 장이름()).replace(/\n/g, " "));
await pg.screenshot({ path: `${S}/drafts.png` });

// 둘째 시안을 고른다
await pg.locator(".draftcard").nth(2).getByRole("button", { name: "2안으로" }).click();
await pg.waitForTimeout(2500);
console.log("고른 뒤 2번 장:", (await 장이름()).replace(/\n/g, " "));
await pg.waitForTimeout(5000);
console.log("저장된 모습:", await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1")||"{}");
  const s = d.projects?.[0]?.slides?.[1];
  return s ? `${s.pageTypeId} / 그 장만의 규격 ${JSON.stringify(s.styleOverride)}` : "아직 저장 전";
}));
console.log("시안판 닫혔나:", await pg.locator(".drafts").count() === 0);
await pg.screenshot({ path: `${S}/drafts-after.png` });

// 되돌리기로 원복되는가
await pg.locator(".undobtn").first().click(); await pg.waitForTimeout(1500);
console.log("되돌린 뒤 2번 장:", (await 장이름()).replace(/\n/g, " "));
await b.close();
