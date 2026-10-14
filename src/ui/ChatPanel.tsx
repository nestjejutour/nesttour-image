import { useEffect, useRef, useState } from "react";
import type { DrawOp, PageType, Slide, StylePreset } from "../core/types";
import { ask, diagnose, type Diagnosis, type Turn } from "../ai/client";
import { chatSystem, needsOk, type Action, type Reply } from "../ai/chat";
import { renderToBlob } from "../render/canvas";
import type { ChatTurn } from "../store/db";

/**
 * 화면을 보면서 하는 대화.
 *
 * 보낼 때마다 지금 페이지를 그림으로 떠서 같이 보낸다.
 * 오간 말은 창고에 쌓인다. 다시 이 페이지로 오면 그대로 이어서 말하면 된다.
 */

interface Props {
  brain: string;
  style: StylePreset;
  pageTypes: PageType[];
  pageType: PageType;
  slide: Slide;
  slideIndex: number;
  totalSlides: number;
  ops: DrawOp[];
  /** 이 페이지에서 지금까지 오간 말 (창고에서 온다) */
  turns: ChatTurn[];
  onTurns: (apply: (t: ChatTurn[]) => ChatTurn[]) => void;
  onActions: (as: Action[]) => void;
  onStyleChange: (path: string, value: number | string, scope: "제안서" | "스타일") => void;
  onSaveRule: (text: string, scope: "공통" | "스타일" | "분류" | "제안서") => void;
  /** 지시를 기록 창고에 남긴다 */
  onNote: (instruction: string) => void;
}

/** 아직 대표 확인을 기다리는 일 */
interface Pending {
  at: number;
  action: Action;
}

export function ChatPanel(p: Props) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [diag, setDiag] = useState<Diagnosis | null>(null);
  const [checking, setChecking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setPending([]); setErr(""); }, [p.slideIndex, p.slide.id]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [p.turns.length, busy]);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;

    const history: Turn[] = [
      ...p.turns.map((t) => ({ role: t.role, content: t.text })),
      { role: "user" as const, content: text },
    ];
    p.onTurns((t) => [...t, { role: "user", text }]);
    setDraft("");
    setBusy(true);
    setErr("");

    // 지금 보고 있는 화면을 그림으로 떠서 같이 보낸다
    let image: Blob | null = null;
    try { image = await renderToBlob(p.ops, p.style); } catch { /* 그림 없이 간다 */ }

    const system = chatSystem({
      brain: p.brain, style: p.style, pageTypes: p.pageTypes,
      pageType: p.pageType, slide: p.slide,
      slideIndex: p.slideIndex, totalSlides: p.totalSlides,
    });

    const r = await ask<Reply>({ system, messages: history, images: image ? [image] : undefined });
    setBusy(false);

    if (!r.ok || !r.data) {
      setErr(r.error ?? "답을 받지 못했습니다.");
      return;
    }

    const all = r.data.actions ?? [];
    const now = all.filter((a) => !needsOk(a));
    const later = all.filter(needsOk);

    if (now.length) {
      p.onActions(now);
      p.onNote(text);
    }

    const say = r.data.say || "고쳤습니다.";
    p.onTurns((t) => {
      const next = [...t, { role: "assistant" as const, text: say }];
      if (later.length) setPending((q) => [...q, ...later.map((a) => ({ at: next.length - 1, action: a }))]);
      return next;
    });
  };

  /** 범위까지 정해서 반영한다. 1회성 지시가 전체로 번지지 않게 */
  const resolve = (pd: Pending, scope: string | null) => {
    if (scope) {
      if (pd.action.do === "스타일제안") p.onStyleChange(pd.action.path, pd.action.value, scope as any);
      if (pd.action.do === "규칙제안") p.onSaveRule(pd.action.text, scope as any);
    }
    setPending((q) => q.filter((x) => x !== pd));
  };

  return (
    <div className="chat">
      <p className="sec" style={{ marginTop: 0 }}>
        AI 와 대화하며 고치기
        <span className="eye">화면을 보고 답합니다</span>
      </p>

      <div className="chat-log">
        {p.turns.length === 0 && !busy && (
          <p className="chat-hint">
            지금 보고 있는 이 페이지를 두고 이야기하면 됩니다.
            <br /><br />
            <i>“제목이 길어 보여. 두 줄로 나눠줘”</i><br />
            <i>“숫자 세 개 중 가운데를 강조해줘”</i><br />
            <i>“이 페이지 좀 답답해 보이는데 어떻게 하면 좋을까?”</i>
            <br /><br />
            AI 가 <b>이 페이지 그림을 직접 보고</b> 답합니다.
            오간 말은 저장되니 나중에 이어서 하셔도 됩니다.
          </p>
        )}

        {p.turns.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            <p>{m.text}</p>
            {pending.filter((q) => q.at === i).map((q, k) => (
              <div className="confirm" key={k}>
                <b>{q.action.do === "스타일제안" ? "규격을 바꿀까요?" : "앞으로도 이렇게 할까요?"}</b>
                <p>
                  {q.action.do === "스타일제안"
                    ? `${q.action.path} → ${q.action.value}   (${q.action.why})`
                    : q.action.do === "규칙제안" ? q.action.text : ""}
                </p>
                <small className="scopeask">어디까지 적용할까요?</small>
                <div className="scopebtns">
                  {(q.action.do === "스타일제안"
                    ? [["제안서", "이 제안서만"], ["스타일", "이 브랜드 전체"]]
                    : [["제안서", "이 제안서만"], ["분류", "이 문서 종류"], ["스타일", "이 브랜드"], ["공통", "어떤 문서든"]]
                  ).map(([v, label]) => (
                    <button key={v} className="btn sm accent" onClick={() => resolve(q, v)}>{label}</button>
                  ))}
                  <button className="btn sm" onClick={() => resolve(q, null)}>안 함</button>
                </div>
              </div>
            ))}
          </div>
        ))}

        {busy && <div className="bubble assistant"><p className="thinking">화면을 보는 중…</p></div>}
        {err && (
          <div className="warn">
            <b>{err}</b>
            <button className="btn sm" style={{ marginTop: 7 }} disabled={checking}
              onClick={async () => { setChecking(true); setDiag(await diagnose()); setChecking(false); }}>
              {checking ? "점검하는 중…" : "왜 안 되는지 점검하기"}
            </button>
          </div>
        )}

        {diag && (
          <div className={diag.ok ? "diagbox ok" : "diagbox"}>
            <b>{diag.ok ? "정상입니다" : "여기서 막혔습니다"}</b>
            {diag.lines.map((l, i) => <p key={i}>{l}</p>)}
            <button className="btn sm" onClick={() => setDiag(null)}>닫기</button>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="chat-box">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="이 페이지를 어떻게 고칠까요?"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button className="btn primary" onClick={send} disabled={busy || !draft.trim()}>보내기</button>
      </div>
    </div>
  );
}
