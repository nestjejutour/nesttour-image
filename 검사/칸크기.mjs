import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1800, height: 1050 }, deviceScaleFactor: 1.2 });
pg.on("pageerror", e => console.log("✗ 페이지오류:", e.message));

await pg.route("**/api/ai", async (route) => {
  const reply = { say: "두 가지로 해 봤습니다.", actions: [{ do: "시안", options: [
    { name: "사진을 가득", pageTypeId: "cover-full",
      why: "빨간 2층 버스 사진이 선명해서 전면에 깔면 첫인상이 가장 강합니다. 이 틀에는 부제 칸이 없어 '핫플트립 판매처 입점 · 위탁판매'는 빠집니다.",
      content: { title: "인천시티투어", sub: "온라인 판매채널 확대 제안", photo: "cover-bus.jpg" } },
    { name: "색 빼고 제목만 크게", pageTypeId: "cover-photo",
      why: "사진과 코랄을 덜어내고 제목을 키워 공공기관 문서처럼 단정하게 했습니다.",
      content: { client: "인천관광공사 귀중", title: "인천시티투어", sub: "온라인 판매채널 확대 제안" },
      style: { "color.accent": "#2B2B2B" } },
  ] }] };
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: JSON.stringify(reply) }) });
});

await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await pg.evaluate(() => localStorage.clear());
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1800);
await pg.locator(".card").first().click(); await pg.waitForTimeout(900);
await pg.getByRole("button", { name: "편집하기" }).click(); await pg.waitForTimeout(1500);
await pg.locator(".dock textarea").first().fill("이 표지 두 가지 느낌으로 보여줘");
await pg.getByRole("button", { name: "보내기" }).first().click();
await pg.locator(".drafts").waitFor({ timeout: 20000 }); await pg.waitForTimeout(800);

const 크기 = await pg.locator(".draftcard").evaluateAll(
  (els) => els.map((e) => { const r = e.getBoundingClientRect(); return `${Math.round(r.width)}×${Math.round(r.height)}`; }));
console.log("카드 크기:", 크기.join(" | "));
console.log("너비 같나:", new Set(크기.map(x => x.split("×")[0])).size === 1 ? "예 ✓" : "아니오 ✗");
console.log("높이 같나:", new Set(크기.map(x => x.split("×")[1])).size === 1 ? "예 ✓" : "아니오 ✗");
console.log("이름:", (await pg.locator(".draftinfo b").allTextContents()).join(" | "));
const 버튼y = await pg.locator(".draftinfo .btn").evaluateAll((els) => els.map(e => Math.round(e.getBoundingClientRect().top)));
console.log("고르기 버튼 높이 줄 맞나:", new Set(버튼y).size === 1 ? "예 ✓" : `아니오 ✗ ${버튼y}`);
await pg.screenshot({ path: `${OUT}/칸크기.png`, clip: { x: 0, y: 150, width: 1800, height: 620 } });
await b.close();
