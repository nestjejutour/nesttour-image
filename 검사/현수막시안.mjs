/**
 * 직원이 명령어 몇 개로 현수막을 받는가 — 처음부터 끝까지.
 *
 * 로그인 → 현수막 분류 → 치수 넣고 시작 → AI 에게 시키기 →
 * 시안 3개 → 하나 고르기 → 그림이 판에 앉았는가 → 인쇄용 저장이 되는가.
 */
import { chromium } from "playwright";
const OUT = process.argv[2] || "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad";

const 그림 = (하늘, 들판, 꽃) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 280">
 <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="${하늘}"/><stop offset="1" stop-color="#EAF4DA"/></linearGradient>
 <linearGradient id="d" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#16321F" stop-opacity="0"/>
  <stop offset=".55" stop-color="#16321F" stop-opacity=".5"/>
  <stop offset="1" stop-color="#16321F" stop-opacity="0"/></linearGradient></defs>
 <rect width="1200" height="280" fill="url(#s)"/>
 <path d="M0 175 L330 70 L470 105 L620 60 L1200 170 Z" fill="#7FA9B8" opacity=".45"/>
 <path d="M0 200 Q300 180 600 200 T1200 190 V280 H0 Z" fill="${들판}"/>
 <path d="M0 232 Q360 212 740 234 T1200 226 V280 H0 Z" fill="${꽃}"/>
 <g fill="#FFF6B0" opacity=".9">
  <circle cx="60" cy="248" r="10"/><circle cx="132" cy="266" r="8"/>
  <circle cx="1060" cy="252" r="9"/><circle cx="1140" cy="268" r="7"/></g>
 <rect width="1200" height="280" fill="url(#d)"/></svg>`;

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1700, height: 1050 }, deviceScaleFactor: 1.2 });
const 터짐 = [];
pg.on("pageerror", (e) => 터짐.push(e.message));

let 받은시스템 = "";
await pg.route("**/api/ai", async (route) => {
  // postData() 는 몸통이 크면 null 을 돌려준다 (사진이 같이 간다). buffer 로 받는다.
  const buf = route.request().postDataBuffer();
  try { 받은시스템 = JSON.parse(buf ? buf.toString("utf8") : "{}").system ?? ""; }
  catch { 받은시스템 = ""; }
  const reply = {
    say: "세 가지로 해 봤습니다.\n- 1안은 꽃밭을 넓게\n- 2안은 색을 가라앉혀\n- 3안은 노을빛으로",
    actions: [{ do: "시안", options: [
      { name: "꽃밭을 넓게", why: "유채꽃을 앞쪽에 가득 깔았습니다",
        content: { art: 그림("#8ECAE6", "#E3C53A", "#FFE97A"),
          주제목: "제주 유채꽃 축제", 부제목: "봄이 가장 먼저 닿는 곳",
          덧말: "2026. 3. 20 ~ 4. 12 · 서귀포 가시리" } },
      { name: "색을 가라앉혀", why: "글자가 먼저 읽히도록 바탕을 눌렀습니다",
        content: { art: 그림("#A7C4CF", "#C9B437", "#E8D865"),
          주제목: "제주 유채꽃 축제", 부제목: "봄이 가장 먼저 닿는 곳", 덧말: "서귀포 가시리" } },
      { name: "노을빛으로", why: "저녁 행사 느낌을 냈습니다",
        content: { art: 그림("#F3B07C", "#D9A72E", "#F7D86B"),
          주제목: "제주 유채꽃 축제", 부제목: "노을과 함께", 덧말: "서귀포 가시리" } },
    ] }],
  };
  await route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ text: JSON.stringify(reply) }) });
});

await pg.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await pg.evaluate(() => localStorage.clear());
await pg.reload({ waitUntil: "networkidle" }); await pg.waitForTimeout(1200);
await pg.locator(".namebox").fill("박시영"); await pg.locator(".pinbox").fill("2230");
await pg.getByRole("button", { name: "로그인" }).click(); await pg.waitForTimeout(1500);

// 현수막 분류를 만들어 인쇄물로 돌린다
await pg.locator(".secadd").click(); await pg.waitForTimeout(400);
await pg.locator(".catnew").fill("현수막");
await pg.locator(".catnew").press("Enter"); await pg.waitForTimeout(700);
await pg.locator(".catnew").press("Escape"); await pg.waitForTimeout(400);
const 줄 = pg.locator(".navrow").filter({ hasText: "현수막" }).first();
await 줄.hover(); await 줄.locator(".rowbtn").last().click(); await pg.waitForTimeout(400);
await pg.getByRole("button", { name: "인쇄물(현수막) 분류로" }).click(); await pg.waitForTimeout(700);
await pg.getByRole("button", { name: /현수막/ }).first().click(); await pg.waitForTimeout(700);

// 400 × 70 으로 새로 만든다
await pg.locator(".빈자리").getByRole("button", { name: "신규 등록" }).click(); await pg.waitForTimeout(900);
await pg.locator(".field input").nth(0).fill("400");
await pg.locator(".field input").nth(1).fill("70");
await pg.locator(".field input").nth(2).fill("제주 유채꽃 축제");
await pg.getByRole("button", { name: "이 규격으로 시작" }).click(); await pg.waitForTimeout(2500);

// 만들면 바로 편집 화면으로 들어간다 — 카드를 거치지 않는다
await pg.waitForSelector(".pagechip", { timeout: 15000 });
await pg.waitForTimeout(800);

const 틀 = await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  const p = (d.projects || []).find((x) => x.title.includes("유채꽃"));
  return p?.slides?.[0]?.pageTypeId ?? "(없음)";
});
console.log(`${틀 === "banner-ai" ? "✓" : "✗"} 현수막 틀로 열렸다 — ${틀}`);

// 보기 명령어 칩이 떠 있는가
const 칩 = await pg.locator(".보기칩").allTextContents();
console.log(`${칩.length >= 4 ? "✓" : "✗"} 직원용 보기 명령어 — ${칩.join(" / ") || "(없음)"}`);

// 첫 칩을 눌러 글칸에 들어가는가
if (칩.length) {
  await pg.locator(".보기칩").first().click(); await pg.waitForTimeout(200);
  const 적힌것 = await pg.locator(".dock-box textarea").first().inputValue();
  console.log(`${적힌것.includes("시안") ? "✓" : "✗"} 눌러서 글칸에 들어간다 — "${적힌것}"`);
}

// 시킨다
await pg.locator(".dock-box textarea").first().fill("유채꽃 넣어서 봄 느낌으로 시안 3개 만들어줘");
await pg.locator(".dock-box textarea").first().press("Enter");
await pg.waitForTimeout(3000);

// (대화창이 실제로 보낸 몸통은 Playwright 가 안 넘겨준다 — 사진이 같이 실려서다.
//  그래서 안내가 붙는지는 아래에서 함수에 바로 물어본다.)

// 안내가 정말 붙는지 함수에 바로 물어본다
const 안내 = await pg.evaluate(async () => {
  const { chatSystem } = await import("/src/ai/chat.ts");
  const { MORE_PAGE_TYPES } = await import("/src/core/pageTypes.more.ts");
  const { BUILT_IN_STYLES } = await import("/src/core/style.ts");
  const 틀 = MORE_PAGE_TYPES.find((t) => t.id === "banner-ai");
  const 기본 = BUILT_IN_STYLES[0];
  const style = { ...기본, slide: { ...기본.slide, widthIn: 157.48, heightIn: 27.56 } };
  const t = chatSystem({
    brain: "", style, pageTypes: MORE_PAGE_TYPES, pageType: 틀,
    slide: { id: "s", pageTypeId: "banner-ai", content: {} }, slideIndex: 0, totalSlides: 1,
  });
  const 문서 = chatSystem({
    brain: "", style: 기본, pageTypes: MORE_PAGE_TYPES,
    pageType: MORE_PAGE_TYPES.find((x) => !x.자유판), 
    slide: { id: "s", pageTypeId: "x", content: {} }, slideIndex: 0, totalSlides: 1,
  });
  return { 현수막: t.includes("여기는 현수막이다"), 치수: t.includes("400 × 70 cm"),
           뷰박스: t.includes('viewBox="0 0 1600 280"'), 글자금지: t.includes("<text> 금지"),
           문서엔없다: !문서.includes("여기는 현수막이다") };
});
console.log(`${안내.현수막 ? "✓" : "✗"} 현수막 안내가 붙는다`);
console.log(`${안내.치수 ? "✓" : "✗"} 종이 크기를 cm 로 알려 준다 (400 × 70 cm)`);
console.log(`${안내.뷰박스 ? "✓" : "✗"} viewBox 를 이 비율로 지정해 준다 (0 0 1600 280)`);
console.log(`${안내.글자금지 ? "✓" : "✗"} 그림 안에 글자 넣지 말라고 못박았다`);
console.log(`${안내.문서엔없다 ? "✓" : "✗"} 제안서 화면에는 이 안내가 안 붙는다`);

await pg.waitForFunction(() => document.querySelectorAll(".draftcard").length >= 4,
  null, { timeout: 20000 }).catch(() => {});
const 칸수 = await pg.locator(".draftcard").count();
console.log(`${칸수 === 4 ? "✓" : "✗"} 원안 + 시안 3개 — ${칸수}칸`);
const 이름들 = await pg.locator(".draftcard .dname, .draftcard b").allTextContents();
console.log("   칸 이름:", 이름들.map((t) => t.trim()).filter(Boolean).join(" | "));

// 시안 칸 안에 그림이 실제로 그려졌는가
const 그려짐 = await pg.locator(".draftcard").nth(1).evaluate((el) => {
  const img = el.querySelector("img");
  return { 있나: !!img, svg인가: !!img && img.src.startsWith("data:image/svg+xml"),
           폭: img?.getBoundingClientRect().width ?? 0 };
});
console.log(`${그려짐.svg인가 && 그려짐.폭 > 50 ? "✓" : "✗"} 시안 칸에 AI 가 그린 그림이 들어갔다 — ${Math.round(그려짐.폭)}px`);

console.log("칸 속치수:", await pg.evaluate(() => {
  const c = document.querySelectorAll(".draftcard")[1];
  const r = (e) => e ? [Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height)] : null;
  return { 칸: r(c), 그림단추: r(c?.querySelector(".shot")),
           속그림: r(c?.querySelector(".shot > div")), 글자: r(c?.querySelector(".draftinfo")),
           줄높이: getComputedStyle(document.querySelector(".drafts-row")).gridTemplateRows };
}));
await pg.screenshot({ path: `${OUT}/현수막시안.png` });

// 2안을 고른다
await pg.locator(".draftcard").nth(2).getByRole("button", { name: "2안으로" }).first()
  .click({ timeout: 8000 }).catch((e) => console.log("  (2안으로를 못 눌렀다)", e.message.slice(0, 60)));
await pg.waitForTimeout(1800);

const 앉았나 = await pg.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
  const p = (d.projects || []).find((x) => x.title.includes("유채꽃"));
  const c = p?.slides?.[0]?.content ?? {};
  return { art머리: String(c.art || "").slice(0, 20), 주제목: c.주제목 ?? "", 부제목: c.부제목 ?? "" };
});
console.log(`${앉았나.art머리.startsWith("<svg") ? "✓" : "✗"} 고른 그림이 판에 앉았다 — ` +
  `art="${앉았나.art머리}…" 주제목="${앉았나.주제목}" 부제목="${앉았나.부제목}"`);

// 판에 그림이 꽉 찼는가
const 꽉 = await pg.evaluate(() => {
  const 판 = document.querySelector(".stage-inner > *");
  const 그림 = document.querySelector(".stage-inner img");
  if (!판 || !그림) return null;
  const a = 판.getBoundingClientRect(), b2 = 그림.getBoundingClientRect();
  return { 판: [Math.round(a.width), Math.round(a.height)],
           그림: [Math.round(b2.width), Math.round(b2.height)] };
});
console.log(`${꽉 && Math.abs(꽉.판[0] - 꽉.그림[0]) < 3 ? "✓" : "✗"} 그림이 판을 꽉 채운다 — ` +
  `판 ${꽉?.판.join("×")} · 그림 ${꽉?.그림.join("×")}`);

// 규격을 화면에서 바꿀 수 있는가
const 규격단추 = pg.getByRole("button", { name: /cm$/ });
const 규격글 = (await 규격단추.count()) ? (await 규격단추.first().innerText()).trim() : "(없음)";
console.log(`${규격글.includes("400 × 70 cm") ? "✓" : "✗"} 지금 규격이 화면에 적혀 있다 — ${규격글}`);

if (await 규격단추.count()) {
  await 규격단추.first().click(); await pg.waitForTimeout(700);
  await pg.locator(".drafts .field input").nth(0).fill("500");
  await pg.locator(".drafts .field input").nth(1).fill("90");
  const 이름칸 = await pg.locator(".drafts .field input").count();
  console.log(`${이름칸 === 2 ? "✓" : "✗"} 바꿀 때는 이름을 묻지 않는다 — 칸 ${이름칸}개`);
  await pg.getByRole("button", { name: "이 규격으로 바꾸기" }).click(); await pg.waitForTimeout(1500);
  const 바뀐것 = await pg.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("mtmb-studio-v1") || "{}");
    const p = (d.projects || []).find((x) => x.title.includes("유채꽃"));
    const s2 = p?.styleOverride?.slide;
    return s2 ? `${Math.round(s2.widthIn * 2.54)} × ${Math.round(s2.heightIn * 2.54)} cm` : "(없음)";
  });
  console.log(`${바뀐것 === "500 × 90 cm" ? "✓" : "✗"} 규격이 바뀌었다 — ${바뀐것}`);
  const 새글 = (await pg.getByRole("button", { name: /cm$/ }).first().innerText()).trim();
  console.log(`${새글.includes("500 × 90 cm") ? "✓" : "✗"} 바뀐 규격이 화면에 다시 적힌다 — ${새글}`);
  const 꽉2 = await pg.evaluate(() => {
    const 판 = document.querySelector(".stage-inner > *"), 그림 = document.querySelector(".stage-inner img");
    if (!판 || !그림) return null;
    const a = 판.getBoundingClientRect(), b2 = 그림.getBoundingClientRect();
    return Math.abs(a.width - b2.width) < 3 && Math.abs(a.height - b2.height) < 3;
  });
  console.log(`${꽉2 ? "✓" : "✗"} 규격을 바꿔도 그림이 판을 꽉 채운다`);
}

// 인쇄용 단추가 있는가
const 인쇄단추 = pg.getByRole("button", { name: "인쇄용 PDF" });
const 인쇄있나 = await 인쇄단추.count();
console.log(`${인쇄있나 ? "✓" : "✗"} 인쇄용 PDF 단추가 있다` +
  (인쇄있나 ? ` — ${await 인쇄단추.first().getAttribute("title")}` : ""));

await pg.screenshot({ path: `${OUT}/현수막완성.png` });
if (터짐.length) console.log("✗ 페이지 오류:", 터짐.slice(0, 3).join(" | "));
console.log(`\n그림 저장: ${OUT}/현수막시안.png · ${OUT}/현수막완성.png`);
await b.close();
