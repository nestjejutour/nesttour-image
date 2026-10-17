import { chromium } from "playwright";
const OUT = process.argv[2] || "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1700, height: 1000 }, deviceScaleFactor: 1.2 });
pg.on("pageerror", e => console.log("✗ 페이지오류:", e.message));

await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await pg.evaluate(() => localStorage.clear());
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1500);

console.log("들어오기 화면:", await pg.locator(".gate").count() ? "뜸 ✓" : "안 뜸 ✗");
console.log("상호:", (await pg.locator(".gatebox .brand").innerText()).trim());
console.log("미리 깔린 이름:", await pg.locator(".whopick").count() ? "있음 ✗" : "없음 ✓");

// 틀린 암호
await pg.locator(".namebox").fill("박시영");
await pg.locator(".pinbox").fill("9999");
await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(400);
// 첫 화면이 "무엇을 만들어 드릴까요?" 작업대로 바뀌었다. 서류함을 보려면 한 번 눌러야 한다.
if (await pg.locator(".시작판").count()) {
  await pg.getByRole("button", { name: /보관함 보기/ }).click();
  await pg.waitForTimeout(700);
}
console.log("틀린 암호:", (await pg.locator(".gateerr").innerText()).trim());

// 대표 암호 2230
await pg.locator(".pinbox").fill("2230");
await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1500);
console.log("대표로 들어옴:", (await pg.locator(".who").innerText()).trim());
await pg.getByRole("button", { name: "설정", exact: true }).click(); await pg.waitForTimeout(700);
await pg.getByRole("button", { name: /^사람/ }).click(); await pg.waitForTimeout(600);
console.log("사람 목록:", (await pg.locator(".peoplelist .filerow b").allTextContents()).map(t=>t.trim().replace(/\s+/g," ")).join(" | "));
console.log("암호 칸 보임:", await pg.locator(".pinfield").count(), "개");
await pg.locator(".page").screenshot({ path: `${OUT}/사람.png` });

// 나갔다가 — 이름이 그대로 떠 있는가
await pg.getByRole("button", { name: "로그아웃" }).click(); await pg.waitForTimeout(900);
console.log("이름 자동으로 떠 있나:", await pg.locator(".namebox").inputValue() === "박시영" ? "예 ✓" : "아니오 ✗");

// 직원 암호 2012 — 처음 보는 이름
await pg.locator(".namebox").fill("김디자");
await pg.locator(".pinbox").fill("2012");
await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1500);
console.log("직원으로 들어옴:", (await pg.locator(".who").innerText()).trim());
// 직원은 창고·기록을 아예 못 본다 — 탭 자체가 없다
const 직원탭 = await pg.getByRole("button", { name: "설정", exact: true }).count();
console.log("직원에게 창고 탭:", 직원탭 ? "보임 ✗" : "안 보임 ✓");
console.log("직원에게 기록 탭:",
  await pg.getByRole("button", { name: "기록", exact: true }).count() ? "보임 ✗" : "안 보임 ✓");

// 새로고침해도 남는가
await pg.waitForTimeout(6500);
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1800);
console.log("새로고침 뒤:", (await pg.locator(".who").innerText()).trim());
await b.close();
