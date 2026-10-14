import { capability, inArtifact } from "../platform";

/**
 * AI 창구.
 *
 * 어디서 돌든 같은 함수를 쓴다.
 *  - 옆 패널  → Claude 의 sample 기능
 *  - 내 PC    → 내 컴퓨터의 작은 서버 (열쇠는 서버에만)
 *
 * 그림을 같이 보낼 수 있다. 그래야 AI 가 "화면을 보고" 판단한다.
 */

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

export interface AiResult<T> {
  ok: boolean;
  data?: T;
  /** 사람이 읽는 AI 의 말 */
  text?: string;
  error?: string;
}

export interface AskOptions {
  system: string;
  messages: Turn[];
  /** 지금 보고 있는 페이지 그림 */
  image?: Blob | null;
}

type Sample = ((
  input: Turn[] | string,
  opts?: { modelTier?: string; images?: Blob[] },
) => Promise<{ text: string }>) & {
  limits?: () => Promise<{ images?: boolean }>;
};

export async function ask<T>(o: AskOptions): Promise<AiResult<T>> {
  const raw = inArtifact ? await viaClaude(o) : await viaLocalServer(o);
  if (!raw.ok) return { ok: false, error: raw.error };

  const data = extractJson<T>(raw.text!);
  if (!data) return { ok: false, error: "AI 가 보낸 답을 알아볼 수 없습니다. 다시 말씀해 주세요.", text: raw.text };
  return { ok: true, data, text: raw.text };
}

/** 한 번만 묻고 끝 (초안 만들기 등) */
export function askAi<T>(system: string, user: string): Promise<AiResult<T>> {
  return ask<T>({ system, messages: [{ role: "user", content: user }] });
}

/* ───────────── 옆 패널 ───────────── */

async function viaClaude(o: AskOptions): Promise<{ ok: boolean; text?: string; error?: string }> {
  const sample = await capability<Sample>("sample");
  if (!sample) return { ok: false, error: "이 화면에서는 AI 기능을 쓸 수 없습니다. 권한을 허용했는지 봐 주세요." };

  // Claude 기능은 지난 대화를 기억하지 않는다. 지시문을 첫 말에 붙여 통째로 보낸다.
  const turns: Turn[] = o.messages.map((m, i) =>
    i === 0 && m.role === "user"
      ? { role: "user", content: `${o.system}\n\n────────\n\n${m.content}` }
      : m,
  );

  let images: Blob[] | undefined;
  if (o.image) {
    try {
      const lim = await sample.limits?.();
      if (lim?.images !== false) images = [o.image];
    } catch { /* 그림 없이 간다 */ }
  }

  try {
    const out = await sample(turns, { modelTier: "complex", ...(images ? { images } : {}) });
    return { ok: true, text: out.text };
  } catch (e: any) {
    if (e?.code === "not_granted") return { ok: false, error: "AI 사용을 허용해 주셔야 작동합니다." };
    if (e?.code === "rate_limited") return { ok: false, error: "잠시 뒤에 다시 말씀해 주세요." };
    return { ok: false, error: e?.message ?? "AI 호출에 실패했습니다." };
  }
}

/* ───────────── 내 PC ───────────── */

async function viaLocalServer(o: AskOptions): Promise<{ ok: boolean; text?: string; error?: string }> {
  const imageBase64 = o.image ? await blobToBase64(o.image) : undefined;
  let r: Response;
  try {
    r = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: o.system, messages: o.messages, imageBase64 }),
    });
  } catch {
    return { ok: false, error: "AI 서버에 닿지 못했습니다. 프로그램을 다시 켜 보세요." };
  }
  const p = await r.json().catch(() => ({ error: "응답을 읽을 수 없습니다" }));
  if (!r.ok || p.error) return { ok: false, error: p.error ?? "AI 호출 실패" };
  return { ok: true, text: p.text };
}

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = rej;
    r.readAsDataURL(b);
  });
}

/* ───────────── JSON 뽑기 ───────────── */

/** 코드펜스나 앞뒤 군더더기가 섞여 와도 JSON 만 뽑아낸다 */
export function extractJson<T>(text: string): T | null {
  if (!text) return null;
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch { /* 아래에서 다시 */ }

  const first = cleaned.search(/[[{]/);
  if (first < 0) return null;
  const open = cleaned[first];
  const close = open === "{" ? "}" : "]";
  let depth = 0, inStr = false, esc = false;
  for (let i = first; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === open) depth++;
    else if (c === close && --depth === 0) {
      try { return JSON.parse(cleaned.slice(first, i + 1)) as T; } catch { return null; }
    }
  }
  return null;
}
