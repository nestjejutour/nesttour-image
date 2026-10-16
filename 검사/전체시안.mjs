import { chromium } from "playwright";
const OUT = process.argv[2] || ".";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1800, height: 1050 }, deviceScaleFactor: 1.2 });
pg.on("pageerror", e => console.log("✗ 페이지오류:", e.message));

await pg.route("**/api/ai", async (route) => {
  const reply = { say: "두 벌로 해 봤습니다. 훑어보시고 고르시면 그대로 들어갑니다.", actions: [{ do: "전체시안", options: [
    { name: "색 빼고 단정하게", why: "강조색을 먹색으로. 장은 그대로 둡니다",
      style: { "color.accent": "#2B2B2B", "type.pageTitle.size": 20 } },
    { name: "다섯 장으로 줄이기", why: "심사용으로 핵심만",
      style: { "color.accent": "#8C8C8C" },
      slides: [
        { pageTypeId: "cover-photo", content: { title: "인천시티투어 제안", client: "인천관광공사" } },
        { pageTypeId: "bullets", content: { title: "제안 요약", subtitle: "핵심만 세 줄로.",
            items: [{ label: "판매처 입점", desc: "주요 플랫폼 등록" }, { label: "상품 구성", desc: "수요자별 설계" }] } },
        { pageTypeId: "table-rows", content: { title: "사업 조건", col1: "항목", col2: "내용", col3: "비고",
            rows: [{ label: "사업 기간", v1: "2026. 3 ~ 12", v2: "10개월" }] } },
        { pageTypeId: "quote", content: { quote: "찾아지게 만드는 편이 빠릅니다.", source: "제안의 기본 생각" } },
      ] },
  ] }] };
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: JSON.stringify(reply) }) });
});

const 모습 = () => pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  const p = (d.projects || [])[0];
  return p ? `${p.slides.length}장 / 강조색 ${p.styleOverride?.color?.accent ?? "그대로"}` : "?";
});

await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await pg.evaluate(() => localStorage.clear());
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1800);
await pg.locator(".card").first().click(); await pg.waitForTimeout(1000);
await pg.getByRole("button", { name: "편집하기" }).click(); await pg.waitForTimeout(1500);
await pg.waitForTimeout(5000);
console.log("요청 전:", await 모습());

await pg.locator(".dock textarea").first().fill("제안서 전체를 두 가지 시안으로 보여줘");
await pg.getByRole("button", { name: "보내기" }).first().click();
await pg.waitForTimeout(4000);

console.log("전체시안판 떴나:", await pg.locator(".deckrows").count() ? "예 ✓" : "아니오 ✗");
console.log("줄 수(지금 것 포함):", await pg.locator(".deckrow").count());
console.log("이름:", (await pg.locator(".deckinfo b").allTextContents()).join(" | "));
console.log("장 수:", (await pg.locator(".deckinfo .cnt").allTextContents()).join(" | "));
console.log("대화창 아직 보이나:", await pg.locator(".dock textarea").first().isVisible() ? "예 ✓" : "아니오 ✗");
console.log("보관함에 새 제안서 생겼나:", await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}"); return (d.projects||[]).length;
}), "건 ← 1건이어야 한다");
console.log("고르기 전:", await 모습(), "← 그대로여야 한다");
await pg.screenshot({ path: `${OUT}/전체시안.png` });

// 한 장 크게 보기
await pg.locator(".deckrow").nth(1).locator(".deckpage").nth(1).click();
await pg.waitForTimeout(600);
console.log("크게 보기:", await pg.locator(".deckbig").count() ? "열림 ✓" : "안 열림 ✗");
await pg.screenshot({ path: `${OUT}/전체시안-크게.png` });
await pg.locator(".deckbig").click({ position: { x: 20, y: 20 } }); await pg.waitForTimeout(400);

// 둘째 안(구성까지 바꾸는 안)을 고른다
await pg.locator(".deckrow").nth(2).getByRole("button", { name: "이 안으로" }).click();
await pg.waitForTimeout(2500);
console.log("시안판 닫혔나:", await pg.locator(".deckrows").count() === 0 ? "예 ✓" : "아니오 ✗");
await pg.waitForTimeout(6000);
console.log("고른 뒤:", await 모습(), "← 4장 / 강조색 #8C8C8C 여야 한다");
await pg.screenshot({ path: `${OUT}/전체시안-고른뒤.png` });

// 되돌리기
await pg.locator(".undobtn").first().click(); await pg.waitForTimeout(2000);
await pg.waitForTimeout(6000);
console.log("되돌린 뒤:", await 모습(), "← 9장으로 돌아와야 한다");
await b.close();
