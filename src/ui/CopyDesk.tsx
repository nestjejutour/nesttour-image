import { useState } from "react";
import type { Content, PageType, Rule, StylePreset } from "../core/types";
import { askCopy, type Turn } from "../ai/client";
import { copySystem, pullCopy, pushCopy, type CopyField } from "../ai/copy";

/**
 * 카피 작업실 — 글만 다루는 칸 (ChatGPT)
 *
 * 그냥 옆에 ChatGPT 창을 띄우면 복사·붙여넣기만 늘어난다.
 * 글이 오가야 쓸모가 있다.
 *   [가져오기] → 지금 페이지 글만 들어옴 → 다듬기 → [바꾸기] → 페이지에 반영
 */

interface Props {
  style: StylePreset;
  rules: Rule[];
  pageType: PageType;
  content: Content;
  onApply: (next: Content) => void;
  onClose: () => void;
}

interface Revised extends CopyField {
  before: string;
  keep: boolean;
}

export function CopyDesk({ style, rules, pageType, content, onApply, onClose }: Props) {
  const [fields, setFields] = useState<CopyField[] | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [revised, setRevised] = useState<Revised[] | null>(null);
  const [say, setSay] = useState("");

  const load = () => {
    setFields(pullCopy(pageType, content));
    setRevised(null);
    setErr("");
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    const base = fields ?? pullCopy(pageType, content);
    if (!fields) setFields(base);

    setBusy(true); setErr(""); setRevised(null);

    const payload = JSON.stringify({ fields: base.map((f) => ({ path: f.path, label: f.label, text: f.text })) }, null, 1);
    const history: Turn[] = [
      ...turns,
      { role: "user", content: `[지금 페이지 문구]\n${payload}\n\n[요청]\n${text}` },
    ];

    const r = await askCopy<{ fields: { path: string; text: string }[]; say?: string }>({
      system: copySystem({ style, rules, pageType }),
      messages: history,
    });
    setBusy(false);

    if (!r.ok || !r.data?.fields) {
      setErr(r.error ?? "답을 받지 못했습니다.");
      return;
    }

    setTurns([...history, { role: "assistant", content: r.text ?? "" }]);
    setDraft("");
    setSay(r.data.say ?? "");

    const byPath = new Map(base.map((f) => [f.path, f]));
    setRevised(
      r.data.fields
        .filter((f) => byPath.has(f.path) && f.text !== byPath.get(f.path)!.text)
        .map((f) => ({
          path: f.path,
          label: byPath.get(f.path)!.label,
          before: byPath.get(f.path)!.text,
          text: f.text,
          keep: true,
        })),
    );
  };

  const apply = () => {
    const picked = (revised ?? []).filter((r) => r.keep);
    if (!picked.length) return;
    onApply(pushCopy(content, picked));
    setFields(null);
    setRevised(null);
  };

  return (
    <div className="pane-copy">
      <div className="row" style={{ marginBottom: 12 }}>
        <b style={{ fontSize: 13 }}>카피 작업실</b>
        <span className="chip" style={{ marginLeft: 0 }}>ChatGPT</span>
        <div className="spacer" />
        <button className="btn sm" onClick={onClose}>닫기</button>
      </div>

      <p style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6, marginTop: 0 }}>
        글만 다룹니다. 레이아웃은 왼쪽에서 Claude 와 하세요.
        쌓아둔 규칙 {rules.length}개를 여기서도 읽습니다.
      </p>

      <button className="btn sm" style={{ width: "100%", marginBottom: 10 }} onClick={load}>
        이 페이지 문구 가져오기
      </button>

      {fields && (
        <div className="copyfields">
          {fields.length === 0 && <p className="chat-hint">이 페이지에는 다듬을 글이 없습니다.</p>}
          {fields.map((f) => (
            <div className="copyfield" key={f.path}>
              <small>{f.label}</small>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      )}

      <div className="chat-box" style={{ marginTop: 10 }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={"예) 제목을 더 힘 있게\n예) 설명이 길다. 한 줄로\n예) 공공기관 제안서 톤으로"}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button className="btn primary" onClick={send} disabled={busy || !draft.trim()}>
          {busy ? "다듬는 중…" : "ChatGPT 에게 보내기"}
        </button>
      </div>

      {err && <div className="warn" style={{ marginTop: 10 }}>{err}</div>}

      {revised && (
        <div style={{ marginTop: 12 }}>
          {say && <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 8px" }}>{say}</p>}
          {revised.length === 0 ? (
            <p className="chat-hint">고칠 것이 없다고 합니다.</p>
          ) : (
            <>
              {revised.map((r, i) => (
                <label className="diff" key={r.path}>
                  <input type="checkbox" checked={r.keep}
                    onChange={(e) =>
                      setRevised((q) => (q ?? []).map((x, k) => (k === i ? { ...x, keep: e.target.checked } : x)))} />
                  <div className="grow">
                    <small>{r.label}</small>
                    <p className="was">{r.before}</p>
                    <p className="now">{r.text}</p>
                  </div>
                </label>
              ))}
              <button className="btn primary" style={{ width: "100%", marginTop: 8 }} onClick={apply}
                disabled={!revised.some((r) => r.keep)}>
                체크한 {revised.filter((r) => r.keep).length}개로 바꾸기
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
