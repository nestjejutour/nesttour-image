/**
 * 브라우저 쪽 AI 호출 창구.
 * 열쇠는 여기 없다. 서버(aiPlugin)에만 있다.
 */

import { capability, inArtifact } from "../platform";

export interface AiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  usage?: { 입력: number; 출력: number };
}

type Sample = ((input: string, opts?: { modelTier?: string }) => Promise<{ text: string }>);

export async function askAi<T>(system: string, user: string): Promise<AiResult<T>> {
  // ① 옆 패널에서 돌 때 — Claude 에게 바로 묻는다
  if (inArtifact) {
    const sample = await capability<Sample>("sample");
    if (!sample) {
      return { ok: false, error: "이 화면에서는 AI 기능을 쓸 수 없습니다. 권한을 허용했는지 확인해 주세요." };
    }
    try {
      // Claude 기능은 지난 대화를 기억하지 않는다. 지시문과 자료를 한 번에 보낸다.
      const out = await sample(`${system}\n\n────────\n\n${user}`, { modelTier: "complex" });
      const data = extractJson<T>(out.text);
      if (!data) return { ok: false, error: "AI 가 보낸 답을 알아볼 수 없습니다. 다시 시도해 주세요." };
      return { ok: true, data };
    } catch (e: any) {
      if (e?.code === "not_granted") return { ok: false, error: "AI 사용을 허용해 주셔야 작동합니다." };
      if (e?.code === "rate_limited") return { ok: false, error: "잠시 뒤에 다시 시도해 주세요." };
      return { ok: false, error: e?.message ?? "AI 호출에 실패했습니다." };
    }
  }

  // ② 대표님 PC 에서 돌 때 — 내 컴퓨터의 작은 서버를 거친다
  let r: Response;
  try {
    r = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system, user }),
    });
  } catch {
    return { ok: false, error: "AI 서버에 닿지 못했습니다. 프로그램을 다시 켜 보세요." };
  }

  const payload = await r.json().catch(() => ({ error: "응답을 읽을 수 없습니다" }));
  if (!r.ok || payload.error) return { ok: false, error: payload.error ?? "AI 호출 실패" };

  const data = extractJson<T>(payload.text);
  if (!data) return { ok: false, error: "AI 가 보낸 답을 알아볼 수 없습니다. 다시 시도해 주세요." };
  return { ok: true, data, usage: payload.usage };
}

/** 코드펜스나 앞뒤 군더더기가 섞여 와도 JSON 만 뽑아낸다 */
export function extractJson<T>(text: string): T | null {
  if (!text) return null;
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    /* 아래에서 다시 시도 */
  }
  const first = cleaned.search(/[[{]/);
  if (first < 0) return null;
  const open = cleaned[first];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = first; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(first, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
