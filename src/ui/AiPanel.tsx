import { useState } from "react";
import type { Content, PageType, Slide } from "../core/types";
import { editRequest, rulePromotionRequest } from "../ai/brain";
import { askAi } from "../ai/client";

/**
 * 한 페이지에 지시를 내리는 칸.
 *
 * 지시 → 그 페이지만 다시 그림 → 기록에 남김 →
 * "앞으로도 이렇게"인지 AI 가 판별해서 규칙으로 저장 제안.
 * 이 고리가 공장이 똑똑해지는 통로다.
 */

interface Props {
  system: string;
  pageType: PageType;
  slide: Slide;
  onApply: (next: Content, instruction: string, before: Content) => void;
  onSaveRule: (text: string) => void;
}

export function AiPanel({ system, pageType, slide, onApply, onSaveRule }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [suggest, setSuggest] = useState<string | null>(null);

  const run = async () => {
    const instruction = text.trim();
    if (!instruction) return;
    setBusy(true);
    setErr("");
    setSuggest(null);

    const r = await askAi<{ content: Content }>(
      system,
      editRequest(pageType, slide, instruction),
    );

    if (!r.ok || !r.data?.content) {
      setBusy(false);
      setErr(r.error ?? "고치지 못했습니다. 지시를 조금 더 구체적으로 적어 주세요.");
      return;
    }

    onApply(r.data.content, instruction, slide.content);
    setText("");

    // 이 지시가 "앞으로도 이렇게"인지 물어본다
    const p = await askAi<{ isRule: boolean; ruleText: string }>(
      system,
      rulePromotionRequest(instruction),
    );
    setBusy(false);
    if (p.ok && p.data?.isRule && p.data.ruleText) setSuggest(p.data.ruleText);
  };

  return (
    <>
      <p className="sec">AI 에게 지시</p>
      <div className="field">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"예) 제목을 더 짧게\n예) 숫자 3개 중 가운데를 코랄로 강조\n예) 설명이 길다. 한 줄로 줄여"}
          style={{ minHeight: 72 }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
          }}
        />
      </div>
      <button className="btn primary" style={{ width: "100%" }} onClick={run} disabled={busy || !text.trim()}>
        {busy ? "고치는 중…" : "이 페이지 고치기"}
      </button>

      {err && <div className="warn" style={{ marginTop: 10 }}><b>{err}</b></div>}

      {suggest && (
        <div
          style={{
            marginTop: 12, border: "1px solid var(--line)", borderRadius: 8,
            padding: 12, background: "var(--panel)",
          }}
        >
          <b style={{ fontSize: 12.5 }}>앞으로도 이렇게 할까요?</b>
          <p style={{ fontSize: 12.5, lineHeight: 1.5, margin: "7px 0 10px" }}>{suggest}</p>
          <div className="row">
            <button
              className="btn sm accent"
              onClick={() => { onSaveRule(suggest); setSuggest(null); }}
            >
              원칙으로 저장
            </button>
            <button className="btn sm" onClick={() => setSuggest(null)}>이번만</button>
          </div>
        </div>
      )}
    </>
  );
}
