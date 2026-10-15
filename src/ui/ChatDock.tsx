import { useEffect, useRef, useState } from "react";
import type { Category, Content, DrawOp, PageType, Project, Rule, Slide, StylePreset } from "../core/types";
import { ask, askCopy, diagnose, type Diagnosis, type Turn } from "../ai/client";
import { chatSystem, librarySystem, needsOk, type Action, type Reply } from "../ai/chat";
import { copySystem, pullCopy, pushCopy, type CopyField } from "../ai/copy";
import { renderToBlob } from "../render/canvas";
import { readShrunk } from "../core/image";
import type { ChatTurn } from "../store/db";
import { Grip, usePanel } from "./panels";

/**
 * 대화 선반 — 화면 오른쪽에 늘 떠 있다.
 *
 * 편집기 안에 숨겨 두면 두세 번 눌러야 나온다.
 * 대화는 작업 내내 켜져 있어야 한다.
 *
 *   Claude  — 화면을 보고 레이아웃·구성·규격
 *   ChatGPT — 글만. 카피·톤·길이
 */

interface Props {
  brain: string;
  style: StylePreset;
  pageTypes: PageType[];
  rules: Rule[];
  /** 보관함에서 대화할 때 쓰는 것들 */
  categories: Category[];
  allProjects: Project[];
  /** 지금 열어 둔 제안서 (없으면 보관함을 보고 있는 중) */
  project: Project | null;
  /** 지금 보고 있는 페이지 */
  slide: Slide | null;
  pageType: PageType | null;
  slideIndex: number;
  ops: DrawOp[];
  turns: ChatTurn[];
  onTurns: (apply: (t: ChatTurn[]) => ChatTurn[]) => void;
  onActions: (as: Action[]) => void;
  onStyleChange: (path: string, value: number | string, scope: "제안서" | "스타일") => void;
  onSaveRule: (text: string, scope: "공통" | "스타일" | "분류" | "제안서") => void;
  onNote: (instruction: string) => void;
  onContent: (next: Content) => void;
  /** 대화창에 올린 사진을 제안서 자산으로 등록한다 */
  onAsset: (key: string, dataUrl: string) => void;
  open: boolean;
  onToggle: () => void;
}

/** 화면이 둘을 나란히 놓을 만큼 넓은가 */
function useWide(px: number): boolean {
  const [wide, setWide] = useState(
    typeof window !== "undefined" ? window.matchMedia(`(min-width:${px}px)`).matches : false,
  );
  useEffect(() => {
    const m = window.matchMedia(`(min-width:${px}px)`);
    const fn = () => setWide(m.matches);
    m.addEventListener("change", fn);
    return () => m.removeEventListener("change", fn);
  }, [px]);
  return wide;
}

export function ChatDock(p: Props) {
  const [tab, setTab] = useState<"Claude" | "ChatGPT">("Claude");
  /** 나란히 보기. 좁아지면 저절로 탭으로 바뀐다. */
  const [sideBySide, setSideBySide] = useState(true);
  const wide = useWide(1480);
  const both = sideBySide && wide;
  /** 대화칸 전체 너비 — 끌어서 조정, 기억된다. 나란히 둘 땐 최소가 넓다. */
  const panel = usePanel("dock", 384, both ? 620 : 280, 1200);
  /** 둘을 나란히 둘 때 Claude 쪽이 차지하는 비율 */
  const ratio = usePanel("dockRatio", 50, 22, 78);

  if (!p.open) {
    return (
      <button className="dock-closed" onClick={p.onToggle} title="대화 열기">
        <span>대</span><span>화</span>
      </button>
    );
  }

  return (
    <>
      <Grip onDrag={(dx) => panel.nudge(-dx)} onReset={panel.reset} />
      <div className={`dock ${both ? "split" : ""}`} style={{ width: panel.size }}>
      <div className="dock-head">
        {both ? (
          <b style={{ fontSize: 15 }}>AI 와 대화</b>
        ) : (
          (["Claude", "ChatGPT"] as const).map((t) => (
            <button key={t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>
              {t}
              <small>{t === "Claude" ? "디자인" : "글"}</small>
            </button>
          ))
        )}
        <div className="spacer" />
        {wide && (
          <button className="btn sm" onClick={() => setSideBySide(!sideBySide)}
            title={both ? "하나씩 크게 보기" : "둘을 나란히 보기"}>
            {both ? "탭으로" : "나란히"}
          </button>
        )}
        <button className="btn sm" onClick={p.onToggle}>닫기</button>
      </div>

      <div className="dock-body">
        {both ? (
          <>
            <div className="dock-col" style={{ flex: `${ratio.size} 1 0` }}>
              <div className="col-name">Claude <small>화면을 보고 디자인·구성</small></div>
              <ClaudeTab {...p} />
            </div>
            <Grip
              onDrag={(dx) => ratio.nudge((dx / Math.max(1, panel.size)) * 100)}
              onReset={ratio.reset}
              title="끌어서 두 대화칸 비율 조정"
            />
            <div className="dock-col" style={{ flex: `${100 - ratio.size} 1 0` }}>
              <div className="col-name gpt">ChatGPT <small>글 · 카피</small></div>
              <CopyTab {...p} />
            </div>
          </>
        ) : (
          <div className="dock-col">{tab === "Claude" ? <ClaudeTab {...p} /> : <CopyTab {...p} />}</div>
        )}
        </div>
      </div>
    </>
  );
}

/* ═══════════ Claude — 화면을 보고 고친다 ═══════════ */

/** 대화창에 올려 둔 사진 한 장 */
interface Pic { key: string; dataUrl: string }

function ClaudeTab(p: Props) {
  const [draft, setDraft] = useState("");
  /** 보내기 전에 붙여 둔 사진들 */
  const [pics, setPics] = useState<Pic[]>([]);
  const [picErr, setPicErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pending, setPending] = useState<{ at: number; action: Action }[]>([]);
  const [diag, setDiag] = useState<Diagnosis | null>(null);
  const [checking, setChecking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setPending([]); setErr(""); }, [p.slide?.id, p.project?.id]);

  /**
   * 사진 받기 — 붙여넣기(Ctrl+V) · 끌어다 놓기 · 버튼, 셋 다 같은 길로 들어온다.
   * 넣을 때 길이를 줄여 둔다. 원본 그대로면 저장칸이 금방 찬다.
   */
  const takePics = async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) { setPicErr("사진 파일만 올릴 수 있습니다."); return; }
    setPicErr("");
    const used = Object.keys(p.project?.assets ?? {}).filter((k) => k.startsWith("올린사진-")).length;
    const next: Pic[] = [];
    for (let i = 0; i < imgs.length; i++) {
      try {
        next.push({ key: `올린사진-${used + pics.length + i + 1}`, dataUrl: await readShrunk(imgs[i]) });
      } catch { setPicErr("사진을 읽지 못했습니다."); }
    }
    setPics((s2) => [...s2, ...next]);
  };
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [p.turns.length, busy]);

  /** 페이지를 보고 있는가 (아니면 보관함에서 하는 대화) */
  const onPage = !!(p.slide && p.pageType);

  const send = async () => {
    const text = draft.trim() || (pics.length ? "이 사진을 넣어 주세요." : "");
    if (!text || busy) return;

    // 올린 사진은 제안서 자산으로 먼저 등록한다. 그래야 AI 가 칸에 넣을 수 있다.
    const shots = pics;
    for (const x of shots) p.onAsset(x.key, x.dataUrl);

    // 사람에게 보이는 글과, AI 에게 보내는 글을 따로 둔다.
    const shown = shots.length ? `${text}\n[사진 ${shots.length}장 올림]` : text;
    const forAi = shots.length
      ? `${text}\n\n(대표가 사진 ${shots.length}장을 올렸다. 사진 칸에 넣을 이름: ${shots.map((x) => x.key).join(", ")})`
      : text;

    const history: Turn[] = [
      ...p.turns.map((t) => ({ role: t.role, content: t.text })),
      { role: "user" as const, content: forAi },
    ];
    p.onTurns((t) => [...t, { role: "user", text: shown }]);
    setDraft(""); setPics([]); setPicErr(""); setBusy(true); setErr("");

    const images: Blob[] = [];
    if (onPage) {
      try {
        const shot = await renderToBlob(p.ops, p.style);
        if (shot) images.push(shot);
      } catch { /* 그림 없이 */ }
    }
    for (const x of shots) {
      try { images.push(await (await fetch(x.dataUrl)).blob()); } catch { /* 건너뛴다 */ }
    }

    const system = onPage
      ? chatSystem({
          brain: p.brain, style: p.style, pageTypes: p.pageTypes,
          pageType: p.pageType!, slide: p.slide!,
          slideIndex: p.slideIndex, totalSlides: p.project?.slides.length ?? 1,
        })
      : librarySystem({
          brain: p.brain,
          categories: p.categories.map((c) => ({ id: c.id, name: c.name })),
          projects: p.allProjects.map((x) => ({ title: x.title, client: x.client, slides: x.slides })),
        });

    const r = await ask<Reply>({ system, messages: history, images: images.length ? images : undefined });
    setBusy(false);

    if (!r.ok || !r.data) { setErr(r.error ?? "답을 받지 못했습니다."); return; }

    const all = r.data.actions ?? [];
    const now = all.filter((a) => !needsOk(a));
    const later = all.filter(needsOk);
    if (now.length) { p.onActions(now); p.onNote(text); }

    const say = r.data.say || "고쳤습니다.";
    p.onTurns((t) => {
      const next = [...t, { role: "assistant" as const, text: say }];
      if (later.length) setPending((q) => [...q, ...later.map((a) => ({ at: next.length - 1, action: a }))]);
      return next;
    });
  };

  const resolve = (pd: { at: number; action: Action }, scope: string | null) => {
    if (scope) {
      if (pd.action.do === "스타일제안") p.onStyleChange(pd.action.path, pd.action.value, scope as any);
      if (pd.action.do === "규칙제안") p.onSaveRule(pd.action.text, scope as any);
    }
    setPending((q) => q.filter((x) => x !== pd));
  };

  return (
    <>
      <div className="dock-where">
        {onPage
          ? <>지금 보는 <b>{p.slideIndex + 1}번째 페이지</b> · {p.pageType!.name}<span className="eye">화면을 보고 답합니다</span></>
          : <>보관함 · 제안서 <b>{p.allProjects.length}건</b><span className="eye">무엇이든 물어보세요</span></>}
      </div>

      <div className="dock-log">
        {p.turns.length === 0 && !busy && (
          <p className="chat-hint">
            {onPage ? (
              <>
                <i>“제목이 길어 보여. 두 줄로 나눠줘”</i><br />
                <i>“숫자 세 개 중 가운데를 강조해줘”</i><br />
                <i>“이 페이지 답답해 보이는데 어떻게 할까?”</i>
                <br /><br />
                AI 가 <b>이 페이지 그림을 직접 보고</b> 답합니다. 오간 말은 저장됩니다.
              </>
            ) : (
              <>
                <i>“인천관광공사 제안서 하나 만들어줘”</i><br />
                <i>“지난 제안서 중에 숫자 중심인 거 뭐 있어?”</i><br />
                <i>“회사소개서는 보통 몇 장으로 해?”</i>
                <br /><br />
                만들어 달라고 하면 <b>바로 만들어서 열어</b> 드립니다.
                제안서를 열면 그 페이지를 <b>보면서</b> 고칩니다.
              </>
            )}
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

      <div className="dock-box"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); void takePics(Array.from(e.dataTransfer.files)); }}>

        {/* 붙여 둔 사진 */}
        {pics.length > 0 && (
          <div className="picrow">
            {pics.map((x) => (
              <span className="pic" key={x.key}>
                <img src={x.dataUrl} alt="" />
                <button onClick={() => setPics((s2) => s2.filter((y) => y.key !== x.key))}
                  title="이 사진 빼기">×</button>
              </span>
            ))}
          </div>
        )}
        {picErr && <small className="picerr">{picErr}</small>}

        <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
          placeholder={onPage
            ? "이 페이지를 어떻게 고칠까요? (사진은 붙여넣거나 끌어다 놓으세요)"
            : "무엇을 만들까요? 무엇이든 물어보세요"}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (files.length) { e.preventDefault(); void takePics(files); }
          }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />

        <div className="row" style={{ gap: 6 }}>
          <label className="btn sm" style={{ cursor: "pointer" }} title="사진을 골라 올립니다">
            + 사진
            <input type="file" accept="image/*" multiple style={{ display: "none" }}
              onChange={(e) => {
                const got = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (got.length) void takePics(got);
              }} />
          </label>
          <button className="btn primary grow" onClick={send}
            disabled={busy || (!draft.trim() && !pics.length)}>보내기</button>
        </div>
      </div>
    </>
  );
}

/* ═══════════ ChatGPT — 글만 다듬는다 ═══════════ */

interface Revised extends CopyField { before: string; keep: boolean; }

function CopyTab(p: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [shown, setShown] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [revised, setRevised] = useState<Revised[] | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [shown.length, busy, revised]);

  /** 페이지를 보고 있는가 (아니면 보관함에서 하는 대화) */
  const onPage = !!(p.slide && p.pageType);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy || !onPage) return;
    const base = pullCopy(p.pageType!, p.slide!.content);

    setShown((s) => [...s, { role: "user", text }]);
    setDraft(""); setBusy(true); setErr(""); setRevised(null);

    const payload = JSON.stringify({ fields: base }, null, 1);
    const history: Turn[] = [...turns, { role: "user", content: `[지금 페이지 문구]\n${payload}\n\n[요청]\n${text}` }];

    const r = await askCopy<{ fields: { path: string; text: string }[]; say?: string }>({
      system: copySystem({ style: p.style, rules: p.rules, pageType: p.pageType! }),
      messages: history,
    });
    setBusy(false);

    if (!r.ok || !r.data?.fields) { setErr(r.error ?? "답을 받지 못했습니다."); return; }

    setTurns([...history, { role: "assistant", content: r.text ?? "" }]);
    setShown((s) => [...s, { role: "assistant", text: r.data!.say || "다듬었습니다." }]);

    const byPath = new Map(base.map((f) => [f.path, f]));
    setRevised(
      r.data.fields
        .filter((f) => byPath.has(f.path) && f.text !== byPath.get(f.path)!.text)
        .map((f) => ({
          path: f.path, label: byPath.get(f.path)!.label,
          before: byPath.get(f.path)!.text, text: f.text, keep: true,
        })),
    );
  };

  const apply = () => {
    const picked = (revised ?? []).filter((r) => r.keep);
    if (!picked.length || !p.slide) return;
    p.onContent(pushCopy(p.slide.content, picked));
    setRevised(null);
  };

  return (
    <>
      <div className="dock-where">
        글만 다룹니다. 레이아웃은 Claude 쪽에서.
        <span className="eye gpt">규칙 {p.rules.length}개를 함께 읽습니다</span>
      </div>

      <div className="dock-log">
        {shown.length === 0 && !busy && (
          <p className="chat-hint">
            {onPage ? (
              <>
                <i>“제목을 더 힘 있게”</i><br />
                <i>“설명이 길다. 한 줄로”</i><br />
                <i>“공공기관 제안서 톤으로”</i>
                <br /><br />
                지금 페이지의 글만 가져가서 다듬고, <b>바꾸기</b>를 누르면 바로 반영됩니다.
              </>
            ) : (
              <>제안서를 열면 그 페이지의 글을 다듬을 수 있습니다.</>
            )}
          </p>
        )}

        {shown.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}><p>{m.text}</p></div>
        ))}

        {busy && <div className="bubble assistant"><p className="thinking">다듬는 중…</p></div>}
        {err && <div className="warn">{err}</div>}

        {revised && revised.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {revised.map((r, i) => (
              <label className="diff" key={r.path}>
                <input type="checkbox" checked={r.keep}
                  onChange={(e) => setRevised((q) => (q ?? []).map((x, k) => (k === i ? { ...x, keep: e.target.checked } : x)))} />
                <div className="grow">
                  <small>{r.label}</small>
                  <p className="was">{r.before}</p>
                  <p className="now">{r.text}</p>
                </div>
              </label>
            ))}
            <button className="btn primary" style={{ width: "100%", marginTop: 6 }} onClick={apply}
              disabled={!revised.some((r) => r.keep)}>
              체크한 {revised.filter((r) => r.keep).length}개로 바꾸기
            </button>
          </div>
        )}
        {revised && revised.length === 0 && <p className="chat-hint">고칠 것이 없다고 합니다.</p>}
        <div ref={endRef} />
      </div>

      <div className="dock-box">
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
          placeholder={onPage ? "문구를 어떻게 다듬을까요?" : "제안서를 열어 주세요"}
          disabled={!onPage}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button className="btn primary" onClick={send} disabled={busy || !draft.trim() || !onPage}>보내기</button>
      </div>
    </>
  );
}
