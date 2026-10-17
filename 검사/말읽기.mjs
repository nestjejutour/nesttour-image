import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1800, height: 1050 }, deviceScaleFactor: 1.2 });
pg.on("pageerror", e => console.log("✗ 페이지오류:", e.message));

const 긴말 = `'판로'를 더 익숙한 '판매'로 바꿨습니다(온라인 판매 확대 제안). 다른 후보는 '온라인 판매처 확대', '온라인 판매 채널 확대'인데, 뒤의 것은 제목이 길어져 두 줄이 될 수 있습니다.

원본은 그대로 두고, 분위기가 다른 두 안을 새로 만들었습니다.

정정: 앞에서 원본 글을 볼 수 없다고 말씀드렸는데, 잘못 말씀드렸습니다.

안 1. 사진 중심
- 사진 전면 표지로 시작해 장면으로 설득합니다.
- 숫자 네 개, 사진 + 글, 카드 4열 순서입니다.

안 2. 정리 중심
- 글자 표지, 목차, 표, 네 칸 격자로 단정하게 정리했습니다.
- **공공기관 심사용**으로 읽기 쉬운 구성입니다.

확인해 주실 것
1. 원본 5장 카드 중 다섯째 카드는 내용이 잘려 있어 넣지 않았습니다.
2. '핫플택시' 카드 사진은 원본에서 확인되지 않아 비워 두었습니다.`;

await pg.route("**/api/ai", async (route) => {
  await route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ text: JSON.stringify({ say: 긴말, actions: [] }) }) });
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
await pg.locator(".dock textarea").first().fill("두 가지로 보여줘");
await pg.getByRole("button", { name: "보내기" }).first().click();
await pg.waitForTimeout(3500);

console.log("제목 줄:", (await pg.locator(".sayhead").allTextContents()).join(" | "));
console.log("짚은 줄:", (await pg.locator(".saynote").allTextContents()).join(" | "));
console.log("목록 묶음:", await pg.locator(".saylist").count(), "개 / 항목", await pg.locator(".saylist li").count(), "개");
console.log("굵게:", (await pg.locator(".say b").allTextContents()).join(" | "));
console.log("따옴표 강조:", (await pg.locator(".say .q").allTextContents()).join(" | "));
await pg.locator(".dock-log").first().screenshot({ path: `${OUT}/말읽기.png` });
await b.close();
