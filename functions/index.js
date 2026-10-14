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
    res.json({ text, usage: { 입력: r.usage.input_tokens, 출력: r.usage.output_tokens } });
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
