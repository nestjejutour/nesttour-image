import { useEffect, useRef, useState } from "react";
import type { Category, Content, Doc, DrawOp, PageType, Project, Rule, Slide, StylePreset } from "../core/types";
import { ask, askCopy, diagnose, type Diagnosis, type Turn } from "../ai/client";
import { chatSystem, librarySystem, needsOk, type Action, type Reply } from "../ai/chat";
import { Say } from "./Say";
import { copySystem, pullCopy, pushCopy, type CopyField } from "../ai/copy";
import { renderToBlob } from "../render/canvas";
import { interpret } from "../core/interpret";
import { SlideView } from "../render/html";
import { readShrunk } from "../core/image";
import { readyWeb, whyNot, type WebState } from "../ai/web";
import { useMic } from "./mic";
import { docsToText, takeIn } from "../core/docs";
import { uid } from "../store/db";
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
  /** 할 일을 반영하고, 새로 만들어진 제안서 번호를 돌려준다 */
  onActions: (as: Action[]) => string[];
  /** 대화창에서 제안서를 연다 */
  onOpenProject: (id: string) => void;
  onStyleChange: (path: string, value: number | string, scope: "제안서" | "스타일") => void;
  onSaveRule: (text: string, scope: "공통" | "스타일" | "분류" | "제안서") => void;
  onNote: (instruction: string) => void;
  onContent: (next: Content) => void;
  /** 대화창에 올린 사진을 제안서 자산으로 등록한다 */
  onAsset: (key: string, dataUrl: string) => void;
  /** 대화창에 올린 문서를 이 건의 파일함에 넣어 둔다 */
  onDoc: (d: Doc) => void;
  /** 회사 서버에 연결되어 있으면 큰 원본도 보관된다 */
  toServer: boolean;
  open: boolean;
  onToggle: () => void;
  /** AI 가 일하는 중인지 바깥에 알린다 — 화면 맨 위에 띠로 보여 주기 위함 */
  onBusy?: (b: boolean) => void;
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
  /** 보내기 전에 붙여 둔 자료들 (제안요청서 · 회사소개서 …) */
  const [docs, setDocs] = useState<Doc[]>([]);
  const [picErr, setPicErr] = useState("");
  const [reading, setReading] = useState("");
  /** 지금 써지고 있는 답 */
  const [live, setLive] = useState("");
  /** 실제로 답한 모델 */
  const [model, setModel] = useState("");
  const stopper = useRef<AbortController | null>(null);
  /** 인터넷 검색 — 꺼져 있다가, 켜면 그때 커넥터를 챙긴다 */
  const boxRef = useRef<HTMLTextAreaElement | null>(null);
  const [web, setWeb] = useState<WebState | null>(null);
  const [webBusy, setWebBusy] = useState(false);
  const mic = useMic((add) => setDraft((d) => (d ? `${d} ${add}` : add).trim()));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pending, setPending] = useState<{ at: number; action: Action }[]>([]);
  const [diag, setDiag] = useState<Diagnosis | null>(null);
  const [checking, setChecking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setPending([]); setErr(""); }, [p.slide?.id, p.project?.id]);

  /* 기다리는 동안 몇 초째인지 — 멈춘 건지 일하는 건지 알 수 있어야 한다 */
  const [초, set초] = useState(0);
  useEffect(() => {
    p.onBusy?.(busy);
    if (!busy) { set초(0); return; }
    const t0 = Date.now();
    const h = setInterval(() => set초(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(h);
  }, [busy]);

  /**
   * 파일 받기 — 붙여넣기(Ctrl+V) · 끌어다 놓기 · 버튼, 셋 다 같은 길로 들어온다.
   *
   * 사진은 줄여서 붙여 두고, 문서는 그 자리에서 글을 꺼내 둔다.
   * 꺼낸 글은 AI 에게 넘기고, 파일은 이 건의 파일함에 남는다.
   */
  const take = async (files: File[]) => {
    if (!files.length) return;
    setPicErr("");

    const imgs = files.filter((f) => f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name));
    const rest = files.filter((f) => !imgs.includes(f));

    const used = Object.keys(p.project?.assets ?? {}).filter((k) => k.startsWith("올린사진-")).length;
    const shots: Pic[] = [];
    for (let i = 0; i < imgs.length; i++) {
      try {
        shots.push({ key: `올린사진-${used + pics.length + i + 1}`, dataUrl: await readShrunk(imgs[i]) });
      } catch { setPicErr("사진을 읽지 못했습니다."); }
    }
    if (shots.length) setPics((s2) => [...s2, ...shots]);

    for (const f of rest) {
      setReading(`${f.name} 읽는 중…`);
      try {
        const d = await takeIn(f, "제작 자료", uid(), p.toServer);
        setDocs((s2) => [...s2, d]);
      } catch { setPicErr(`${f.name} 을 읽지 못했습니다.`); }
    }
    setReading("");
  };
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [p.turns.length, busy]);

  /** 페이지를 보고 있는가 (아니면 보관함에서 하는 대화) */
  const onPage = !!(p.slide && p.pageType);

  const send = async () => {
    const hasFile = pics.length > 0 || docs.length > 0;
    const text = draft.trim()
      || (pics.length && !docs.length ? "이 사진을 넣어 주십시오." : "")
      || (docs.length ? "이 자료를 읽고 무엇을 할 수 있는지 알려 주십시오." : "");
    if (!text || busy) return;

    // 올린 사진은 제안서 자산으로 먼저 등록한다. 그래야 AI 가 칸에 넣을 수 있다.
    const shots = pics;
    for (const x of shots) p.onAsset(x.key, x.dataUrl);
    // 올린 자료는 이 건의 파일함에 남긴다. 다음에 또 올리지 않아도 된다.
    const papers = docs;
    for (const d of papers) p.onDoc(d);

    // 사람에게 보이는 글과, AI 에게 보내는 글을 따로 둔다.
    const tag = [
      shots.length ? `사진 ${shots.length}장` : "",
      papers.length ? `자료 ${papers.length}개` : "",
    ].filter(Boolean).join(" · ");
    const shown = hasFile ? `${text}\n[${tag} 올림]` : text;

    const picLine = shots.length
      ? `\n\n(대표가 사진 ${shots.length}장을 올렸다. 사진 칸에 넣을 이름: ${shots.map((x) => x.key).join(", ")})`
      : "";
    const docLine = papers.length
      ? `\n\n(대표가 올린 자료다. 여기 적힌 사실만 쓰고, 없는 것은 지어내지 마라)\n${docsToText(papers)}`
      : "";
    const forAi = `${text}${picLine}${docLine}`;

    const history: Turn[] = [
      ...p.turns.map((t) => ({ role: t.role, content: t.text })),
      { role: "user" as const, content: forAi },
    ];
    p.onTurns((t) => [...t, { role: "user", text: shown }]);
    setDraft(""); setPics([]); setDocs([]); setPicErr(""); setBusy(true); setErr("");

    const images: Blob[] = [];
    if (onPage) {
      try {
        // PNG 는 사진이 깔린 판에서 수 MB 가 된다. 글자를 읽는 데는 JPEG 로 넉넉하다.
        const shot = await renderToBlob(p.ops, p.style, { type: "image/jpeg", quality: 0.82 });
        if (shot) images.push(shot);
      } catch { /* 그림 없이 */ }
    }
    for (const x of shots) {
      try { images.push(await (await fetch(x.dataUrl)).blob()); } catch { /* 건너뛴다 */ }
    }

    const system = onPage
      ? chatSystem({
          brain: p.brain, style: p.style, pageTypes: p.pageTypes,
          web: !!web?.on,
          pageType: p.pageType!, slide: p.slide!,
          slideIndex: p.slideIndex, totalSlides: p.project?.slides.length ?? 1,
          // 같은 제안서의 다른 장들. 앞뒤 흐름을 보고 판단하게 한다.
          deck: (p.project?.slides ?? []).map((s2) => ({
            pageTypeId: s2.pageTypeId,
            pageTypeName: p.pageTypes.find((t) => t.id === s2.pageTypeId)?.name ?? s2.pageTypeId,
            content: s2.content,
          })),
        })
      : librarySystem({
          brain: p.brain,
          web: !!web?.on,
          categories: p.categories.map((c) => ({ id: c.id, name: c.name })),
          projects: p.allProjects.map((x) => ({ id: x.id, title: x.title, client: x.client, slides: x.slides })),
        });

    // 답이 써지는 대로 보여 준다. 길게 기다리며 빈 화면을 보지 않게.
    const ctl = new AbortController();
    stopper.current = ctl;
    setLive("");
    const r = await ask<Reply>({
      system, messages: history,
      images: images.length ? images : undefined,
      onText: (whole) => setLive(sayOf(whole)),
      signal: ctl.signal,
      ...(web?.on ? { tools: web.tools } : {}),
    });
    stopper.current = null;
    setBusy(false); setLive("");
    if (r.model) setModel(r.model);

    if (!r.ok || !r.data) { if (r.error) setErr(r.error); return; }

    const all = r.data.actions ?? [];
    const now = all.filter((a) => !needsOk(a));
    const later = all.filter(needsOk);
    let made: string[] = [];
    if (now.length) { made = p.onActions(now); p.onNote(text); }

    // 시안을 냈으면 그 이름을 말에 남긴다.
    // 다음에 "이것도 별로" 라고 하면 AI 가 뭘 이미 보여줬는지 알아야 한다.
    const 낸시안 = all.find((a) => a.do === "시안") as Extract<Action, { do: "시안" }> | undefined;
    const say =
      (r.data.say || "고쳤습니다.") +
      (낸시안?.options?.length
        ? `\n\n시안: ${낸시안.options.map((o) => o.name).join(" · ")}`
        : "");
    p.onTurns((t) => {
      const next = [...t, { role: "assistant" as const, text: say, ...(made.length ? { made } : {}) }];
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
          : <>보관함 · 제안서 <b>{p.allProjects.length}건</b><span className="eye">무엇이든 물어보십시오</span></>}
        {model && <span className="whomodel" title="방금 답한 모델입니다">{modelName(model)}</span>}
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
            <Say text={m.text} />

            {/* 만든 결과를 바로 보여 준다. 열어 보지 않고도 고를 수 있어야 한다. */}
            {m.made?.map((id) => {
              const made = p.allProjects.find((x) => x.id === id);
              if (!made) return null;
              return (
                <div className="madecard" key={id}>
                  <div className="row" style={{ marginBottom: 6 }}>
                    <b className="grow">{made.title}</b>
                    <small>{made.slides.length}장</small>
                  </div>
                  <div className="madeshots">
                    {made.slides.slice(0, 8).map((s2) => {
                      const t = p.pageTypes.find((x) => x.id === s2.pageTypeId);
                      const ops = t
                        ? interpret(t, s2.content, {
                            style: p.style, assets: made.assets,
                            adjust: s2.adjust, extras: s2.extras,
                          })
                        : [];
                      return (
                        <div className="madeshot" key={s2.id}>
                          <SlideView ops={ops} style={p.style} zoom={0.072} />
                        </div>
                      );
                    })}
                    {made.slides.length > 8 && <span className="more">+{made.slides.length - 8}</span>}
                  </div>
                  <button className="btn sm accent" style={{ width: "100%", marginTop: 7 }}
                    onClick={() => p.onOpenProject(id)}>이 안으로 작업하기</button>
                </div>
              );
            })}
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

        {busy && (
          <div className="bubble assistant">
            {live
              ? <><Say text={live} /><span className="caret" /></>
              : <p className="thinking">
                  <span className="spin" aria-hidden />
                  {web?.on ? "찾아보는 중" : onPage ? "화면을 보고 생각하는 중" : "읽는 중"}
                  {초 > 1 ? ` · ${초}초째` : "…"}
                </p>}
            <button className="btn sm" style={{ marginTop: 7 }}
              onClick={() => stopper.current?.abort()}>멈추기</button>
          </div>
        )}
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
        onDrop={(e) => { e.preventDefault(); void take(Array.from(e.dataTransfer.files)); }}>

        {/* 붙여 둔 사진 */}
        {pics.length > 0 && (
          <div className="picrow">
            {pics.map((x) => (
              <span className="pic" key={x.key}>
                <img src={x.dataUrl} alt="" />
                <button onClick={() => setPics((s2) => s2.filter((y) => y.key !== x.key))}
                  title="이 사진 삭제">×</button>
              </span>
            ))}
          </div>
        )}
        {docs.length > 0 && (
          <div className="docrow">
            {docs.map((d) => (
              <span className={`docchip ${d.text ? "" : "bad"}`} key={d.id} title={d.note ?? ""}>
                {d.name}
                <small>{d.text ? `글 ${d.text.length.toLocaleString()}자` : (d.note ?? "못 읽음")}</small>
                <button onClick={() => setDocs((s2) => s2.filter((y) => y.id !== d.id))}
                  title="이 자료 삭제">×</button>
              </span>
            ))}
          </div>
        )}
        {reading && <small className="picerr" style={{ color: "var(--muted)" }}>{reading}</small>}
        {mic.오류 && (
          <div className="picerr">
            {mic.오류}
            {mic.틀에막힘 && (
              <button className="btn sm" style={{ marginLeft: 8 }} onClick={mic.새탭}>새 탭에서 열기</button>
            )}
          </div>
        )}
        {web && !web.on && <small className="picerr">{whyNot(web)}</small>}
        {picErr && <small className="picerr">{picErr}</small>}

        {/*
          현수막일 때만 뜨는 보기 명령어.

          직원이 "뭐라고 적어야 하지" 에서 멈추면 이 기능은 안 쓰인다.
          눌러서 글칸에 넣고 거기서 손봐 보내면 된다. 바로 보내지 않는 까닭은
          대개 한 마디를 더 붙이고 싶어 하기 때문이다 — "유채꽃" 뒤에 "한라산도".
        */}
        {onPage && p.pageType?.자유판 && (
          <div className="보기줄">
            <small>이렇게 시켜 보십시오</small>
            {["시안 3개 만들어줘", "유채꽃 넣어서 봄 느낌으로", "색을 바꿔서 다시",
              "제목 더 크게", "글씨를 왼쪽으로 몰아줘"].map((t) => (
              <button key={t} className="보기칩" type="button"
                onClick={() => {
                  setDraft((d) => (d.trim() ? `${d.trim()} ${t}` : t));
                  boxRef.current?.focus();
                }}>
                {t}
              </button>
            ))}
          </div>
        )}

        <textarea ref={boxRef} value={draft} onChange={(e) => setDraft(e.target.value)}
          placeholder={onPage
            ? "이 페이지를 어떻게 고칠까요? (사진·자료는 끌어다 놓으십시오)"
            : "무엇을 만들까요? 제안요청서를 끌어다 놓으셔도 됩니다"}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (files.length) { e.preventDefault(); void take(files); }
          }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />

        {/* 연장은 한 줄, 보내기는 그 아래 한 줄 — 좁아져도 짓눌리지 않는다 */}
        <div className="toolrow">
          {mic.can && (
            <button className={`btn sm ${mic.듣는중 ? "accent" : ""}`} onClick={mic.toggle}
              title={mic.듣는중 ? "말이 끝나면 눌러 주십시오" : "말로 적습니다"}>
              {mic.듣는중 ? "● 듣는 중" : "🎤 말하기"}
            </button>
          )}
          <button className={`btn sm ${web?.on ? "accent" : ""}`} disabled={webBusy}
            title="지금의 사실(시세 · 최근 소식 · 경쟁사)이 필요할 때 켜 주십시오"
            onClick={async () => {
              if (web?.on) { setWeb(null); return; }
              setWebBusy(true);
              setWeb(await readyWeb());
              setWebBusy(false);
            }}>
            {webBusy ? "여는 중…" : web?.on ? "🌐 검색 켬" : "🌐 인터넷"}
          </button>
          <label className="btn sm" style={{ cursor: "pointer" }}
            title="사진과 자료(한글 · 워드 · 파워포인트 · 엑셀 · PDF)를 올립니다">
            + 파일
            <input type="file" multiple style={{ display: "none" }}
              onChange={(e) => {
                const got = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (got.length) void take(got);
              }} />
          </label>
        </div>
        <button className="btn primary" style={{ width: "100%" }} onClick={send}
          disabled={busy || !!reading || (!draft.trim() && !pics.length && !docs.length)}>보내기</button>
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
          placeholder={onPage ? "문구를 어떻게 다듬을까요?" : "제안서를 열어 주십시오"}
          disabled={!onPage}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button className="btn primary" onClick={send} disabled={busy || !draft.trim() || !onPage}>보내기</button>
      </div>
    </>
  );
}

/**
 * 아직 다 써지지 않은 답에서 사람에게 할 말만 꺼낸다.
 * AI 는 JSON 으로 답하는데, 그 날것을 보여 줄 수는 없다.
 */
function sayOf(partial: string): string {
  const at = partial.indexOf('"say"');
  if (at < 0) return "";
  const q = partial.indexOf('"', partial.indexOf(":", at) + 1);
  if (q < 0) return "";
  let out = "";
  for (let i = q + 1; i < partial.length; i++) {
    const c = partial[i];
    if (c === "\\") {
      const n = partial[i + 1];
      out += n === "n" ? "\n" : n === "t" ? "\t" : n ?? "";
      i++;
      continue;
    }
    if (c === '"') break;
    out += c;
  }
  return out;
}

/** 모델 번호를 사람이 읽는 이름으로 */
function modelName(id: string): string {
  if (/opus/i.test(id)) return "Opus 5.5";
  if (/sonnet/i.test(id)) return "Sonnet";
  if (/haiku/i.test(id)) return "Haiku";
  if (id === "complex") return "가장 센 모델";
  return id;
}
