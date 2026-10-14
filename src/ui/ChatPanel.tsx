import { useEffect, useRef, useState } from "react";
import type { DrawOp, PageType, Slide, StylePreset } from "../core/types";
import { ask, type Turn } from "../ai/client";
import { chatSystem, needsOk, type Action, type Reply } from "../ai/chat";
import { renderToBlob } from "../render/canvas";

/**
 * 화면을 보면서 하는 대화.
 *
 * 보낼 때마다 지금 페이지를 그림으로 떠서 같이 보낸다.
 * 그래서 "이 페이지 좀 답답해 보여" 같은 말이 통한다.
 */

interface Props {
  brain: string;
  style: StylePreset;
  pageTypes: PageType[];
  pageType: PageType;
  slide: Slide;
  slideIndex: number;
  totalSlides: number;
  /** 지금 페이지의 그리기 명령 (그림으로 뜬다) */
  ops: DrawOp[];
  /** 확인 필요 없는 일들을 실제로 반영 */
  onActions: (as: Action[]) => void;
  /** 확인 받은 뒤 반영 */
  onStyleChange: (path: string, value: number | string) => void;
  onSaveRule: (text: string) => void;
  /** 기록 창고에 남긴다 */
  onNote: (instruction: string) => void;
}

interface Msg {
  role: "user" | "assistant";
  text: string;
  pending?: Action[];
}

export function ChatPanel(p: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // 페이지를 옮기면 대화를 새로 시작한다 (다른 페이지 얘기가 섞이지 않게)
  useEffect(() => { setMsgs([]); setErr(""); }, [p.slideIndex]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs, busy]);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;

    const history: Turn[] = [...msgs.map((m) => ({ role: m.role, content: m.text })), { role: "user" as const, content: text }];
    setMsgs((m) => [...m, { role: "user", text }]);
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

    const r = await ask<Reply>({ system, messages: history, image });
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
    setMsgs((m) => [...m, { role: "assistant", text: r.data!.say || "고쳤습니다.", pending: later }]);
  };

  const resolve = (i: number, a: Action, ok: boolean) => {
    if (ok) {
      if (a.do === "스타일제안") p.onStyleChange(a.path, a.value);
      if (a.do === "규칙제안") p.onSaveRule(a.text);
    }
    setMsgs((m) => m.map((x, k) => (k === i ? { ...x, pending: (x.pending ?? []).filter((y) => y !== a) } : x)));
  };

  return (
    <div className="chat">
      <p className="sec" style={{ marginTop: 0 }}>
        AI 와 대화하며 고치기
        <span className="eye">화면을 보고 답합니다</span>
      </p>

      <div className="chat-log">
        {msgs.length === 0 && !busy && (
          <p className="chat-hint">
            지금 보고 있는 이 페이지를 두고 이야기하면 됩니다.
            <br /><br />
            <i>“제목이 길어 보여. 두 줄로 나눠줘”</i>
            <br />
            <i>“숫자 세 개 중 가운데를 강조해줘”</i>
            <br />
            <i>“이 페이지 좀 답답해 보이는데 어떻게 하면 좋을까?”</i>
            <br /><br />
            AI 가 <b>이 페이지 그림을 직접 보고</b> 답합니다.
          </p>
        )}

        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            <p>{m.text}</p>
            {(m.pending ?? []).map((a, k) => (
              <div className="confirm" key={k}>
                <b>{a.do === "스타일제안" ? "전체 규격을 바꿀까요?" : "앞으로도 이렇게 할까요?"}</b>
                <p>
                  {a.do === "스타일제안"
                    ? `${a.path} → ${a.value}   (${a.why})`
                    : a.do === "규칙제안" ? a.text : ""}
                </p>
                <div className="row">
                  <button className="btn sm accent" onClick={() => resolve(i, a, true)}>적용</button>
                  <button className="btn sm" onClick={() => resolve(i, a, false)}>안 함</button>
                </div>
              </div>
            ))}
          </div>
        ))}

        {busy && <div className="bubble assistant"><p className="thinking">화면을 보는 중…</p></div>}
        {err && <div className="warn">{err}</div>}
        <div ref={endRef} />
      </div>

      <div className="chat-box">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="이 페이지를 어떻게 고칠까요?"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
          }}
        />
        <button className="btn primary" onClick={send} disabled={busy || !draft.trim()}>
          보내기
        </button>
      </div>
    </div>
  );
}
