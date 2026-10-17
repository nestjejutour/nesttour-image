import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1800, height: 1050 }, deviceScaleFactor: 1.2 });
pg.on("pageerror", e => console.log("✗ 페이지오류:", e.message));

// 일부러 5초 끌어 로딩 표시를 본다
await pg.route("**/api/ai", async (route) => {
  await new Promise(r => setTimeout(r, 5000));
  const reply = { say: "두 가지로 해 봤습니다.", actions: [{ do: "시안", options: [
    { name: "선만 남기고 색 빼기", why: "강조색을 먹색으로", pageTypeId: "bullets",
      content: { title: "제안 요약", subtitle: "핵심만.", items: [{ label: "판매처 입점", desc: "플랫폼 등록" }] },
      style: { "color.accent": "#2B2B2B" } },
    { name: "표로 또박또박", why: "심사자가 짚기 쉽게", pageTypeId: "table-rows",
      content: { title: "제안 요약", col1: "항목", col2: "내용", col3: "비고",
        rows: [{ label: "사업 기간", v1: "2026. 3 ~ 12", v2: "10개월" }] } },
  ] }] };
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: JSON.stringify(reply) }) });
});

await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await pg.evaluate(() => localStorage.clear());
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1200);
// 로그인 화면이 생긴 뒤로는 여기를 지나야 보관함이 나온다
await pg.locator(".namebox").fill("박시영"); await pg.locator(".pinbox").fill("2230");
await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1500);
// 첫 화면이 "무엇을 만들어 드릴까요?" 작업대로 바뀌었다. 서류함을 보려면 한 번 눌러야 한다.
if (await pg.locator(".시작판").count()) {
  await pg.getByRole("button", { name: /보관함 보기/ }).click();
  await pg.waitForTimeout(700);
}
await pg.locator(".card").first().click(); await pg.waitForTimeout(900);
await pg.getByRole("button", { name: "편집하기" }).click(); await pg.waitForTimeout(1500);

await pg.locator(".dock textarea").first().fill("이 페이지 색 빼고 두 가지로 보여줘");
await pg.getByRole("button", { name: "보내기" }).first().click();
await pg.waitForTimeout(2500);
console.log("맨 위 띠:", await pg.locator(".working").count() ? "보임 ✓" : "없음 ✗");
console.log("머리줄 표시:", await pg.locator(".busytag").count() ? "보임 ✓" : "없음 ✗");
console.log("대화창 돌아가는 표시:", await pg.locator(".thinking .spin").count() ? "보임 ✓" : "없음 ✗");
console.log("문구:", (await pg.locator(".thinking").innerText()).replace(/\n/g," "));
await pg.screenshot({ path: `${OUT}/로딩중.png` });

await pg.locator(".drafts").waitFor({ timeout: 20000 }); await pg.waitForTimeout(600);
console.log("  [진단] .drafts", await pg.locator(".drafts").count(), ".draftcard", await pg.locator(".draftcard").count(), ".draftinfo", await pg.locator(".draftinfo").count(), "busy문구", await pg.locator(".thinking").count());
console.log("끝난 뒤 맨 위 띠:", await pg.locator(".working").count() ? "남아 있음 ✗" : "사라짐 ✓");
console.log("끝난 뒤 머리줄:", await pg.locator(".busytag").count() ? "남아 있음 ✗" : "사라짐 ✓");
console.log("시안 이름:", (await pg.locator(".draftinfo b").allTextContents()).join(" | "));
console.log("고르기 버튼:", (await pg.locator(".draftinfo .btn").allTextContents()).join(" | "));

// 크게 보기
await pg.locator(".draftcard").nth(1).locator(".shot").click(); await pg.waitForTimeout(700);
console.log("크게 보기:", await pg.locator(".bigview").count() ? "열림 ✓" : "안 열림 ✗");
console.log("큰 화면 머리말:", (await pg.locator(".bigbar").innerText()).replace(/\n/g," "));
await pg.screenshot({ path: `${OUT}/크게보기.png` });
// 좌우로 넘겨 본다
await pg.locator(".bigview .nav").nth(1).click(); await pg.waitForTimeout(500);
console.log("넘긴 뒤:", (await pg.locator(".bigbar").innerText()).replace(/\n/g," "));
// 큰 화면에서 바로 고른다
await pg.locator(".bigbar").getByRole("button", { name: /안으로$/ }).click();
await pg.waitForTimeout(2500);
console.log("고른 뒤 1번 장(표로 정리형이어야 한다):", (await pg.locator(".pagechip").nth(0).innerText()).replace(/\n/g," "));
await b.close();
