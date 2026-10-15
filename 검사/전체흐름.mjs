import { chromium } from "playwright";
import { readFileSync } from "fs";
const S = process.argv[2];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1700, height: 1000 }, deviceScaleFactor: 1.4 });
pg.on("pageerror", e => console.log("✗ 페이지오류:", e.message));

// AI 자리에 진짜 Claude 가 돌려줄 법한 답을 끼워 넣는다
let seenSystem = "", seenUser = "", round = 0;
await pg.route("**/api/ai", async (route) => {
  const body = JSON.parse(route.request().postData());
  seenSystem = body.system; seenUser = body.messages.at(-1).content;
  round++;
  const reply = round === 1 ? {
    say: "제안요청서를 읽고 9장으로 짰습니다. 예산과 기간은 요청서에 적힌 그대로 넣었습니다.",
    actions: [{
      do: "새제안서", title: "인천시티투어 온라인 판로 확대 (안 1)",
      client: "인천관광공사", category: "proposal",
      slides: [
        { pageTypeId: "cover-type", content: { recipient: "인천관광공사 귀중", title1: "인천시티투어", title2: "온라인 판로 확대 제안", date: "2026. 10" } },
        { pageTypeId: "summary", content: { title: "제안 요약", rows: [{ label: "사업명", value: "인천시티투어 온라인 판로 확대" }, { label: "사업기간", value: "2026년 3월 ~ 12월" }, { label: "사업예산", value: "1억 2천만원" }] } },
        { pageTypeId: "bullets", content: { title: "제안 범위", subtitle: "네 가지를 맡아 수행합니다.", items: [{ label: "온라인 판매처 입점", desc: "주요 OTA 등록" }, { label: "상품 구성", desc: "타깃별 설계" }] } },
        { pageTypeId: "timeline", content: { title: "수행 일정", steps: [{ phase: "1단계 준비", period: "2026. 03~04" }, { phase: "2단계 입점", period: "2026. 05~06", accent: "y" }] } },
        { pageTypeId: "price", content: { title: "소요 비용", rows: [{ item: "운영 대행", qty: "10개월", amount: "30,000,000원" }], totalLabel: "합계 (부가세 별도)", total: "120,000,000원" } },
      ],
    }],
  } : {
    say: "세 장의 말투를 공공기관 제안서 톤으로 맞췄습니다.",
    actions: [
      { do: "다른장수정", at: 1, content: { title: "제안 개요", rows: [{ label: "사업명", value: "인천시티투어 온라인 판로 확대 용역" }, { label: "사업기간", value: "2026. 3. ~ 2026. 12." }, { label: "사업예산", value: "금 일억이천만원정" }] } },
      { do: "다른장수정", at: 2, content: { title: "제안 범위", subtitle: "다음 네 가지 과업을 수행합니다.", items: [{ label: "온라인 판매처 입점", desc: "주요 판매 플랫폼 입점 및 상품 등록" }, { label: "상품 구성", desc: "수요자별 상품 설계 및 가격 책정" }] } },
      { do: "내용수정", content: { recipient: "인천관광공사 귀중", title1: "인천시티투어", title2: "온라인 판로 확대 용역 제안", date: "2026. 10" } },
    ],
  };
  await route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ text: JSON.stringify(reply) }) });
});

const step = (n, ok, extra = "") => console.log(`${ok ? "·" : "✗"} ${n}${extra ? " — " + extra : ""}`);

await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await pg.evaluate(() => localStorage.clear());
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1800);

/* ① 보관함 대화창에 제안요청서를 끌어다 놓는다 */
const bytes = Array.from(readFileSync(`${S}/시험자료/제안요청서.hwp`));
await pg.evaluate(async ({ bytes }) => {
  const f = new File([new Uint8Array(bytes)], "인천관광공사_제안요청서.hwp");
  const dt = new DataTransfer(); dt.items.add(f);
  document.querySelector(".dock-box").dispatchEvent(
    new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
}, { bytes });
await pg.waitForTimeout(2500);
step("제안요청서를 대화창에 끌어다 놓음", await pg.locator(".docchip").count() === 1,
  (await pg.locator(".docchip").innerText()).replace(/\n/g, " "));

/* ② 말로 시킨다 */
await pg.locator(".dock-box textarea").first().fill("이 제안요청서 읽고 제안서 만들어줘");
await pg.getByRole("button", { name: "보내기" }).first().click();
await pg.waitForTimeout(7000);

step("AI 가 요청서 내용을 실제로 받았는가",
  seenUser.includes("인천관광공사 제안요청서") && seenUser.includes("일억이천만원"));
step("AI 가 지난 제안서의 글까지 보는가", seenSystem.includes("안에 쓰인 글까지 그대로"));

/* ③ 제안서가 만들어지고 바로 열렸는가 */
const made = await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  const p = d.projects?.[0];
  return p && { title: p.title, n: p.slides.length, docs: (p.docs ?? []).length,
                첫장: JSON.stringify(p.slides[0].content).slice(0, 60) };
});
step("제안서가 만들어짐", made?.n === 5, `${made?.title} · ${made?.n}장`);
step("요청서가 파일함에 남음", made?.docs === 1);
step("빈칸이 아니라 실제 글이 들어감", made?.첫장.includes("인천관광공사"));
step("바로 편집 화면이 열림", await pg.locator(".editor").count() === 1);
await pg.screenshot({ path: `${S}/shots/loop1.png` });

/* ④ 열린 제안서에서 이어서 작업 — 여러 장을 한 번에 */
await pg.locator(".dock-box textarea").first().fill("전체를 공공기관 제안서 톤으로 바꿔줘");
await pg.getByRole("button", { name: "보내기" }).first().click();
await pg.waitForTimeout(7000);
step("AI 가 제안서 전체를 보는가", seenSystem.includes("이 제안서 전체"));
const after = await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  return d.projects[0].slides.map(s => JSON.stringify(s.content));
});
step("2번 장이 바뀜", after[1].includes("일억이천만원정"));
step("3번 장이 바뀜", after[2].includes("과업을 수행합니다"));
step("1번 장도 바뀜", after[0].includes("용역 제안"));
await pg.screenshot({ path: `${S}/shots/loop2.png` });

/* ⑤ 손으로 더 고치고 되돌리기 */
await pg.locator(".pagechip").nth(1).click(); await pg.waitForTimeout(600);
await pg.locator('.editor input').first().fill("제안 개요서"); await pg.waitForTimeout(900);
await pg.locator(".undobtn").first().click(); await pg.waitForTimeout(700);
step("손으로 고치고 되돌리기", true);

/* ⑥ 내보내기 */
const [dl] = await Promise.all([ pg.waitForEvent("download", { timeout: 60000 }),
  pg.getByRole("button", { name: "PPT 저장" }).click() ]);
await dl.saveAs(`${S}/loop.pptx`);
step("PPT 로 내보냄", true);

console.log("\n라운드:", round, "회 — AI 를 두 번 부르고 흐름이 끝까지 돌았습니다.");
await b.close();
