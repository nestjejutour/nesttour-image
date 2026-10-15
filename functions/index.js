/**
 * AI 창구 (Cloud Functions)
 *
 * 왜 서버가 필요한가:
 *   AI 열쇠를 브라우저에 두면 누구나 볼 수 있다. 그래서 여기 서버에만 둔다.
 *   브라우저는 "이렇게 고쳐줘"만 보내고, 열쇠는 구경도 못 한다.
 *
 * 로그인한 사람만 쓸 수 있다. 안 그러면 남이 우리 열쇠로 AI 를 쓴다.
 */

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Anthropic = require("@anthropic-ai/sdk");

admin.initializeApp();

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const NAVER_CLIENT_ID = defineSecret("NAVER_CLIENT_ID");
const NAVER_CLIENT_SECRET = defineSecret("NAVER_CLIENT_SECRET");

const CLAUDE_MODEL = "claude-opus-5-5";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5";

/** 로그인한 사람인지 확인한다 */
async function requireUser(req, res) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    res.status(401).json({ error: "로그인이 필요합니다." });
    return null;
  }
  try {
    return await admin.auth().verifyIdToken(token);
  } catch {
    res.status(401).json({ error: "로그인이 만료되었습니다. 새로고침해 주세요." });
    return null;
  }
}

const common = { cors: true, region: "asia-northeast3", timeoutSeconds: 300, memory: "512MiB" };

/* ───────────── Claude — 화면을 보고 고친다 ───────────── */

exports.ai = onRequest({ ...common, secrets: [ANTHROPIC_API_KEY] }, async (req, res) => {
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "POST 만 받습니다" });
  if (!(await requireUser(req, res))) return;

  const { system, messages, imagesBase64 } = req.body || {};
  if (!system || !Array.isArray(messages)) {
    return res.status(400).json({ error: "보낸 내용이 올바르지 않습니다." });
  }

  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

    // 마지막 사용자 말에 지금 보고 있는 페이지 그림을 붙인다
    const built = messages.map((m, i) => {
      const last = i === messages.length - 1;
      if (last && m.role === "user" && Array.isArray(imagesBase64) && imagesBase64.length) {
        return {
          role: "user",
          content: [
            ...imagesBase64.slice(0, 5).map((data) => ({
              type: "image",
              source: { type: "base64", media_type: "image/png", data },
            })),
            { type: "text", text: m.content },
          ],
        };
      }
      return { role: m.role, content: m.content };
    });

    const r = await client.beta.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      system,
      messages: built,
      thinking: { type: "adaptive" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    if (r.stop_reason === "refusal") {
      return res.status(400).json({ error: "AI 가 이 요청을 거절했습니다." });
    }

    const text = r.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    res.json({ text, model: CLAUDE_MODEL, usage: { 입력: r.usage.input_tokens, 출력: r.usage.output_tokens } });
  } catch (e) {
    res.status(500).json({ error: e?.message || "AI 호출에 실패했습니다." });
  }
});

/* ───────────── ChatGPT — 글만 다듬는다 ───────────── */

exports.copy = onRequest({ ...common, secrets: [OPENAI_API_KEY] }, async (req, res) => {
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "POST 만 받습니다" });
  if (!(await requireUser(req, res))) return;

  const key = OPENAI_API_KEY.value();
  if (!key) {
    return res.status(400).json({ error: "ChatGPT 열쇠가 등록되지 않았습니다." });
  }

  const { system, messages } = req.body || {};
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{ role: "system", content: system }, ...(messages || [])],
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      const m = data?.error?.message || `ChatGPT 호출 실패 (${r.status})`;
      return res.status(400).json({
        error: /model/i.test(m)
          ? `${m}\n\n모델 이름이 맞지 않는 것 같습니다. (지금 쓰는 이름: ${OPENAI_MODEL})`
          : m,
      });
    }
    res.json({ text: data?.choices?.[0]?.message?.content ?? "", model: OPENAI_MODEL });
  } catch (e) {
    res.status(500).json({ error: e?.message || "ChatGPT 호출에 실패했습니다." });
  }
});

/* ───────────── 네이버 검색 ─────────────
 *
 * 바깥 검색(Parallel)은 관공서·뉴스·공식 홈페이지는 잘 찾지만
 * 네이버 블로그·카페·지역은 한 건도 못 찾는다. 네이버가 바깥 크롤러를 막는다.
 * 한국 여행 시장의 실제 이야기는 거기 있으므로, 네이버가 공식으로 여는
 * 창구를 우리 서버가 대신 두드린다. 열쇠는 여기에만 둔다.
 */

/** 네이버가 돌려주는 글에는 <b> 같은 꼬리표가 섞여 있다. 떼어 낸다. */
const 꼬리표떼기 = (s) =>
  String(s || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();

/** 어디를 찾을지 — 네이버가 여는 창구들 */
const 네이버칸 = {
  blog: "블로그",
  cafearticle: "카페글",
  news: "뉴스",
  webkr: "웹문서",
  local: "지역·업체",
  shop: "쇼핑",
  kin: "지식iN",
  doc: "전문자료",
};

/** 한 칸을 찾는다 */
async function 네이버한칸(kind, query, display, sort, id, secret) {
  const url =
    `https://openapi.naver.com/v1/search/${kind}.json` +
    `?query=${encodeURIComponent(query)}&display=${display}` +
    (sort ? `&sort=${encodeURIComponent(sort)}` : "");
  const r = await fetch(url, {
    headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    return { kind, 칸: 네이버칸[kind] || kind, error: data?.errorMessage || `네이버 ${kind} 실패 (${r.status})` };
  }
  const items = (data.items || []).map((x) => ({
    제목: 꼬리표떼기(x.title),
    주소: x.link || x.originallink || "",
    요약: 꼬리표떼기(x.description),
    ...(x.postdate ? { 날짜: x.postdate } : {}),
    ...(x.pubDate ? { 날짜: x.pubDate } : {}),
    ...(x.bloggername ? { 글쓴이: x.bloggername } : {}),
    ...(x.cafename ? { 카페: 꼬리표떼기(x.cafename) } : {}),
    ...(x.address ? { 주소지: x.address } : {}),
    ...(x.telephone ? { 전화: x.telephone } : {}),
    ...(x.lprice ? { 가격: x.lprice } : {}),
    ...(x.mallName ? { 판매처: x.mallName } : {}),
  }));
  return { kind, 칸: 네이버칸[kind] || kind, items };
}

exports.naver = onRequest(
  { ...common, secrets: [NAVER_CLIENT_ID, NAVER_CLIENT_SECRET] },
  async (req, res) => {
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).json({ error: "POST 만 받습니다" });
    if (!(await requireUser(req, res))) return;

    const id = NAVER_CLIENT_ID.value();
    const secret = NAVER_CLIENT_SECRET.value();
    if (!id || !secret) {
      return res.status(400).json({
        error:
          "네이버 열쇠가 아직 없습니다. developers.naver.com 에서 발급받아 " +
          "NAVER_CLIENT_ID · NAVER_CLIENT_SECRET 으로 넣어 주세요.",
      });
    }

    const query = String(req.body?.query || "").trim();
    if (!query) return res.status(400).json({ error: "무엇을 찾을지 적어 주세요." });

    // 어디를 찾을지. 안 고르면 널리 — 블로그·카페·뉴스·웹문서를 한꺼번에.
    const asked = Array.isArray(req.body?.kinds) && req.body.kinds.length
      ? req.body.kinds
      : ["blog", "cafearticle", "news", "webkr"];
    const kinds = asked.filter((k) => k in 네이버칸).slice(0, 6);
    if (!kinds.length) return res.status(400).json({ error: "찾을 곳을 알 수 없습니다." });

    const display = Math.max(1, Math.min(20, Number(req.body?.display) || 8));
    const sort = typeof req.body?.sort === "string" ? req.body.sort : undefined;

    try {
      const 결과 = await Promise.all(
        kinds.map((k) => 네이버한칸(k, query, display, sort, id, secret)),
      );
      res.json({ 찾은말: query, 결과 });
    } catch (e) {
      res.status(500).json({ error: e?.message || "네이버 검색에 실패했습니다." });
    }
  },
);
