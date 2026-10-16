import { chromium } from "playwright";
const OUT = process.argv[2] || ".";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1700, height: 1000 }, deviceScaleFactor: 1.2 });
pg.on("pageerror", e => console.log("✗ 페이지오류:", e.message));

await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await pg.evaluate(() => localStorage.clear());
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1500);

console.log("들어오기 화면:", await pg.locator(".gate").count() ? "뜸 ✓" : "안 뜸 ✗");
console.log("보이는 이름:", (await pg.locator(".whopick .navitem").allTextContents()).join(" | "));
await pg.screenshot({ path: `${OUT}/들어오기.png`, clip: { x: 500, y: 250, width: 700, height: 500 } });

// 틀린 암호
await pg.locator(".pinbox").fill("1234");
await pg.getByRole("button", { name: "들어가기" }).click(); await pg.waitForTimeout(400);
console.log("틀린 암호:", (await pg.locator(".gateerr").innerText()).trim());

// 맞는 암호
await pg.locator(".pinbox").fill("0000");
await pg.getByRole("button", { name: "들어가기" }).click(); await pg.waitForTimeout(1500);
console.log("들어온 뒤 머리줄:", (await pg.locator(".who").innerText()).trim());

// 사람 넣기
await pg.getByRole("button", { name: "창고" }).click(); await pg.waitForTimeout(700);
await pg.getByRole("button", { name: /^사람/ }).click(); await pg.waitForTimeout(600);
await pg.getByPlaceholder("이름 (아이디로 씁니다)").fill("김디자");
await pg.getByPlaceholder("암호 4글자").fill("1111");
await pg.getByRole("button", { name: "사람 넣기" }).click(); await pg.waitForTimeout(800);
console.log("사람 목록:", (await pg.locator(".peoplelist .filerow b").allTextContents()).map(t=>t.trim()).join(" | "));

// 제안서를 고쳐 기록이 남는지
await pg.getByRole("button", { name: "보관함" }).click(); await pg.waitForTimeout(600);
await pg.locator(".card").first().click(); await pg.waitForTimeout(800);
await pg.getByRole("button", { name: "전체 복제" }).click(); await pg.waitForTimeout(1500);
const 글칸 = pg.locator(".pane-right input, .pane-right textarea").first();
if (await 글칸.count()) { await 글칸.fill("손댄 기록 시험"); await 글칸.blur(); await pg.waitForTimeout(1500); }
console.log("고칠 칸 찾았나:", await 글칸.count() ? "예" : "아니오");
await pg.getByRole("button", { name: "← 보관함" }).click(); await pg.waitForTimeout(600);
await pg.getByRole("button", { name: "창고" }).click(); await pg.waitForTimeout(600);
await pg.getByRole("button", { name: /^사람/ }).click(); await pg.waitForTimeout(600);
console.log("손댄 기록:", (await pg.locator(".trailrow").allTextContents()).slice(0,3).map(t=>t.replace(/\n/g," ").trim()).join(" / ") || "(없음)");
await pg.locator(".page").screenshot({ path: `${OUT}/사람.png` });

// 나갔다 다시 들어오기 — 직원으로
await pg.getByRole("button", { name: "나가기" }).click(); await pg.waitForTimeout(800);
await pg.getByRole("button", { name: /김디자/ }).click(); await pg.waitForTimeout(300);
await pg.locator(".pinbox").fill("1111");
await pg.getByRole("button", { name: "들어가기" }).click(); await pg.waitForTimeout(1200);
console.log("직원으로 들어옴:", (await pg.locator(".who").innerText()).trim());
await pg.getByRole("button", { name: "창고" }).click(); await pg.waitForTimeout(600);
await pg.getByRole("button", { name: /^사람/ }).click(); await pg.waitForTimeout(600);
console.log("직원에게 사람 넣기 칸:", await pg.getByPlaceholder("이름 (아이디로 씁니다)").count() ? "보임 ✗" : "안 보임 ✓");
await b.close();
