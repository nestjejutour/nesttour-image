import { capability, hasClaude } from "../platform";
import { firebaseReady, functionsBase, idToken } from "../store/firebase";

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
  /** 같이 보낼 그림들 (보고 있는 페이지, 올린 사진 자료) */
  images?: Blob[];
}

type Sample = ((
  input: Turn[] | string,
  opts?: { modelTier?: string; images?: Blob[] },
) => Promise<{ text: string }>) & {
  limits?: () => Promise<{ images?: boolean }>;
};

export async function ask<T>(o: AskOptions): Promise<AiResult<T>> {
  // 옆 패널이면 Claude 기능, 아니면 내 PC 서버. 미리 판정하지 않고 그때 본다.
  const sample = await capability<Sample>("sample");
  const raw = sample
    ? await viaClaude(o, sample)                 // 옆 패널 — 열쇠 없이 자동
    : firebaseReady
      ? await viaFunctions(o)                    // 회사 서버 — 열쇠는 서버에
      : await viaLocalServer(o);                 // 내 PC — .env.local 의 열쇠
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

async function viaClaude(
  o: AskOptions,
  sample: Sample,
): Promise<{ ok: boolean; text?: string; error?: string }> {
  // Claude 기능은 지난 대화를 기억하지 않는다. 지시문을 첫 말에 붙여 통째로 보낸다.
  const turns: Turn[] = o.messages.map((m, i) =>
    i === 0 && m.role === "user"
      ? { role: "user", content: `${o.system}\n\n────────\n\n${m.content}` }
      : m,
  );

  let images: Blob[] | undefined;
  if (o.images?.length) {
    try {
      const lim = await sample.limits?.();
      if (lim?.images !== false) images = o.images.slice(0, 5);
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

/* ───────────── 회사 서버 (Cloud Functions) ───────────── */

async function viaFunctions(o: AskOptions): Promise<{ ok: boolean; text?: string; error?: string }> {
  const token = await idToken();
  if (!token) return { ok: false, error: "로그인이 필요합니다." };

  const imagesBase64 = o.images?.length
    ? await Promise.all(o.images.slice(0, 5).map(blobToBase64))
    : undefined;

  let r: Response;
  try {
    r = await fetch(`${functionsBase}/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ system: o.system, messages: o.messages, imagesBase64 }),
    });
  } catch {
    return { ok: false, error: "AI 창구에 닿지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
  const p = await r.json().catch(() => ({ error: "응답을 읽을 수 없습니다" }));
  if (!r.ok || p.error) return { ok: false, error: p.error ?? "AI 호출 실패" };
  return { ok: true, text: p.text };
}

/* ───────────── 내 PC ───────────── */

async function viaLocalServer(o: AskOptions): Promise<{ ok: boolean; text?: string; error?: string }> {
  const imagesBase64 = o.images?.length
    ? await Promise.all(o.images.slice(0, 5).map(blobToBase64))
    : undefined;
  let r: Response;
  try {
    r = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: o.system, messages: o.messages, imagesBase64 }),
    });
  } catch {
    return {
      ok: false,
      error: hasClaude()
        ? "AI 를 부르지 못했습니다. 잠시 뒤 다시 시도해 주세요."
        : "AI 서버에 닿지 못했습니다. 내 PC 에서 돌릴 때는 .env.local 에 열쇠를 넣고 다시 켜 주세요.",
    };
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


/* ───────────── 점검 ───────────── */

export interface Diagnosis {
  ok: boolean;
  lines: string[];
}

/** 무엇이 왜 안 되는지 사람이 읽는 말로 알려준다 */
export async function diagnose(): Promise<Diagnosis> {
  const lines: string[] = [];

  const inPanel = hasClaude();
  lines.push(inPanel ? "① 옆 패널에서 돌고 있습니다" : "① 내 PC 에서 돌고 있습니다");

  const sample = await capability<Sample>("sample");
  if (inPanel && !sample) {
    lines.push("② AI 기능을 못 가져왔습니다 — 권한을 허용하지 않았거나, 이 화면에서 막혀 있습니다");
    return { ok: false, lines };
  }
  lines.push(sample ? "② AI 기능을 가져왔습니다" : "② 내 PC 서버로 갑니다");

  if (sample) {
    try {
      const lim = await sample.limits?.();
      lines.push(lim?.images === false ? "③ 그림은 못 보냅니다 (글자만)" : "③ 그림도 보낼 수 있습니다");
    } catch {
      lines.push("③ 그림 지원 여부를 확인하지 못했습니다");
    }
  }

  const t = await ask<{ ok: boolean }>({
    system: '당신은 연결 점검용이다. 무조건 {"ok":true} 만 출력하라.',
    messages: [{ role: "user", content: "점검" }],
  });

  if (t.ok) {
    lines.push("④ 시험 호출 성공 — AI 가 정상으로 답했습니다");
    return { ok: true, lines };
  }
  lines.push(`④ 시험 호출 실패 — ${t.error ?? "알 수 없음"}`);
  if (t.text) lines.push(`   AI 가 보낸 말: ${t.text.slice(0, 160)}`);
  return { ok: false, lines };
}


/* ───────────── 카피 작업실 (ChatGPT) ───────────── */

/**
 * 글만 다루는 창구. 내 PC 에서만 돈다.
 * 옆 패널에서는 외부 호출이 막혀 있어 쓸 수 없다.
 */
export async function askCopy<T>(o: { system: string; messages: Turn[] }): Promise<AiResult<T>> {
  if (hasClaude()) {
    return {
      ok: false,
      error: "카피 작업실은 옆 패널에서는 쓸 수 없습니다. (외부 연결이 막혀 있습니다) 회사 주소로 접속해서 쓰시면 됩니다.",
    };
  }

  const url = firebaseReady ? `${functionsBase}/copy` : "/api/copy";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (firebaseReady) {
    const token = await idToken();
    if (!token) return { ok: false, error: "로그인이 필요합니다." };
    headers.Authorization = `Bearer ${token}`;
  }

  let r: Response;
  try {
    r = await fetch(url, { method: "POST", headers, body: JSON.stringify(o) });
  } catch {
    return { ok: false, error: "ChatGPT 창구에 닿지 못했습니다. 프로그램을 다시 켜 보세요." };
  }
  const p = await r.json().catch(() => ({ error: "응답을 읽을 수 없습니다" }));
  if (!r.ok || p.error) return { ok: false, error: p.error ?? "ChatGPT 호출 실패" };

  const data = extractJson<T>(p.text);
  if (!data) return { ok: false, error: "ChatGPT 가 보낸 답을 알아볼 수 없습니다.", text: p.text };
  return { ok: true, data, text: p.text };
}
