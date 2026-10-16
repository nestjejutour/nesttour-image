import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, Content, DeckDraft, Draft, PageType, Project, StylePreset, Todo } from "../core/types";
import { collectTodos, interpret } from "../core/interpret";
import { styleFor } from "../core/scope";
import { setAt } from "../core/content";
import { readShrunk } from "../core/image";
import type { Extra, Nudge } from "../core/types";
import { SlideView } from "../render/html";
import { downloadPptx } from "../render/pptx";
import { 규격묻기 } from "./규격묻기";
import { 인쇄크기말 } from "../render/canvas";
import { downloadPdf } from "../render/pdf";
import { PRINT_SIZES, SLIDE_SIZES, slideSizeOf, 작게끝 } from "../core/paper";
import { SlotForm } from "./SlotForm";
import { uid } from "../store/db";
import { SourceDrawer } from "./SourceDrawer";
import { Drafts } from "./Drafts";
import { DeckDrafts } from "./DeckDrafts";
import { Files } from "./Files";
import type { Action } from "../ai/chat";
import type { ChatTurn } from "../store/db";

import { hasClaude } from "../platform";

interface Props {
  project: Project;
  style: StylePreset;
  pageTypes: PageType[];
  /** 반드시 '직전 상태'를 받아서 바꾼다. 두 가지 변경이 겹쳐도 서로 덮어쓰지 않는다. */
  onChange: (apply: (p: Project) => Project) => void;
  onBack: () => void;
  /** 분류 목록 (편집기에서 분류를 바꿀 수 있게) */
  categories: Category[];
  /** 지난 자료 서랍에 보여줄 제안서들 */
  allProjects: Project[];
  /** 지금 보고 있는 페이지 (위에서 들고 있다. 대화 선반이 같이 봐야 한다) */
  cur: number;
  onCur: (i: number) => void;
  /** 쌓인 걸 전부 녹여 넣은 AI 지시문 */
  aiSystem: string;
  /** 지시가 원칙이 될 때 */
  onSaveRule: (text: string, scope?: any) => void;
  /** 수정 기록 창고에 남긴다 */
  onHistory: (e: { slideIndex: number; instruction: string; before: Content; after: Content }) => void;
  /** 규격 바꾸기 (대표 확인을 받은 뒤에만 불린다) */
  onStyleChange: (path: string, value: number | string, scope: "제안서" | "스타일") => void;
  /** 이 페이지에서 오간 대화 (창고에서 온다) */
  turnsOf: (slideId: string) => ChatTurn[];
  onTurns: (slideId: string, apply: (t: ChatTurn[]) => ChatTurn[]) => void;
  /** 회사 서버에 연결되어 있으면 큰 원본 파일도 보관된다 */
  toServer: boolean;
  /** 이 건의 판 크기 바꾸기 (16:9 / 4:3 / A4 …) */
  onSlideSize: (widthIn: number, heightIn: number) => void;
  /** AI 가 내놓은 시안들 (고르기 전까지 제안서는 그대로다) */
  drafts: Draft[];
  deckDrafts: DeckDraft[];
  onPickDeck: (d: DeckDraft) => void;
  onCloseDecks: () => void;
  onPickDraft: (d: Draft) => void;
  onCloseDrafts: () => void;
  /** 덮어쓰기 전의 밑 규격 — 시안마다 다르게 그리려면 필요하다 */
  baseStyle: StylePreset;
}

export function Editor({ project, style, pageTypes, categories, allProjects, cur, onCur, onChange, onBack, aiSystem, onSaveRule, onHistory, onStyleChange, turnsOf, onTurns, toServer, onSlideSize,
  drafts, onPickDraft, onCloseDrafts, baseStyle,
  deckDrafts, onPickDeck, onCloseDecks }: Props) {
  const [zoom, setZoom] = useState(0.78);
  /** 폭에 맞춰 자동으로 줄인다. +/- 를 누르면 손맛을 지킨다. */
  const [autoFit, setAutoFit] = useState(true);
  const stageRef = useRef<HTMLDivElement>(null);
  const [adding, setAdding] = useState(false);
  /** 페이지 모양이 많아졌다. 이름으로 걸러 찾는다. */
  const [findType, setFindType] = useState("");
  const [printing, setPrinting] = useState(false);
  const [busyOut, setBusyOut] = useState("");
  const [msg, setMsg] = useState("");
  const [editTitle, setEditTitle] = useState(false);
  const [srcOpen, setSrcOpen] = useState(false);
  /** 이 건의 파일함 */
  const [filesOpen, setFilesOpen] = useState(false);
  /** 화면에서 집어 둔 것 */
  const [picked, setPicked] = useState<string | null>(null);

  const typeOf = (id: string) => pageTypes.find((t) => t.id === id);

  /** 현수막·배너처럼 판 크기가 자유로운 것인가. 이쪽은 인쇄용 저장이 본 일이다 */
  const 인쇄물인가 = project.slides.some((s2) => typeOf(s2.pageTypeId)?.자유판);

  /**
   * 판이 납작한가 (가로가 세로의 2.5배 넘게).
   *
   * 400×70cm 는 5.7배다. 양옆 칸(220 + 376)에 대화창까지 자리를 먹으면
   * 가운데가 525px 밖에 안 남아 현수막이 3% 로 뜬다 — 손톱만 하다.
   * 보면서 일을 할 수가 없다. 이럴 때는 미리보기를 가로로 눕히고
   * 양옆 칸을 그 아래로 내린다.
   */
  const 납작한가 =
    style.slide.widthIn / Math.max(0.1, style.slide.heightIn) >= 2.5;

  /** 규격을 바꾸는 창이 열려 있는가 */
  const [규격바꾸기, set규격바꾸기] = useState(false);

  /** 지금 판을 cm 로 — 400 × 70 cm */
  const 지금규격 = (() => {
    const 자 = (인치: number) => {
      const cm = 인치 * 2.54;
      return Number.isInteger(Math.round(cm * 10) / 10) && Math.abs(cm - Math.round(cm)) < 0.05
        ? String(Math.round(cm)) : cm.toFixed(1);
    };
    return `${자(style.slide.widthIn)} × ${자(style.slide.heightIn)} cm`;
  })();

  /** 페이지마다 번호를 매긴다 (번호 안 찍는 페이지는 세지 않는다) */
  const pageNumbers = useMemo(() => {
    let n = 0;
    return project.slides.map((s) => {
      const t = typeOf(s.pageTypeId);
      if (t?.showPageNo === false) return 0;
      n += 1;
      return n;
    });
  }, [project.slides, pageTypes]);

  const plans = useMemo(
    () =>
      project.slides.map((s, i) => {
        const t = typeOf(s.pageTypeId);
        if (!t) return { ops: [] };
        // 시안을 고른 장은 그 장만의 규격을 갖는다
        const 이장규격 = s.styleOverride ? styleFor(style, s.styleOverride) : style;
        return {
          ops: interpret(t, s.content, {
            style: 이장규격,
            assets: project.assets,
            pageNumber: pageNumbers[i],
            adjust: s.adjust,
            extras: s.extras,
          }),
        };
      }),
    [project, style, pageTypes, pageNumbers],
  );

  const todos: Todo[] = useMemo(
    () =>
      project.slides.flatMap((s, i) => {
        const t = typeOf(s.pageTypeId);
        return t ? collectTodos(t, s.content, i) : [];
      }),
    [project.slides, pageTypes],
  );

  const slide = project.slides[cur];
  const slideType = slide ? typeOf(slide.pageTypeId) : undefined;

  const patch = (fn: (p: Project) => Partial<Project>) =>
    onChange((prev) => ({ ...prev, ...fn(prev), updatedAt: new Date().toISOString() }));

  const addPage = (t: PageType) => {
    const s = { id: uid(), pageTypeId: t.id, content: structuredClone(t.sample) };
    patch((p) => ({ slides: [...p.slides, s] }));
    onCur(project.slides.length);
    setAdding(false);
  };

  const removePage = (i: number) => {
    patch((p) => ({ slides: p.slides.filter((_, k) => k !== i) }));
    onCur(Math.max(0, Math.min(i, project.slides.length - 2)));
  };

  const movePage = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= project.slides.length) return;
    patch((p) => {
      const n = [...p.slides];
      [n[i], n[j]] = [n[j], n[i]];
      return { slides: n };
    });
    onCur(j);
  };

  /** AI 가 돌려준 할 일 목록을 실제로 반영한다 */
  const applyActions = (as: Action[]) => {
    patch((p) => {
      let slides = [...p.slides];
      for (const a of as) {
        switch (a.do) {
          case "내용수정":
            slides[cur] = { ...slides[cur], content: a.content };
            break;
          case "타입바꾸기":
            if (pageTypes.some((t) => t.id === a.pageTypeId))
              slides[cur] = { ...slides[cur], pageTypeId: a.pageTypeId, content: a.content };
            break;
          case "페이지추가": {
            if (!pageTypes.some((t) => t.id === a.pageTypeId)) break;
            const at = Math.max(0, Math.min(slides.length, a.at ?? slides.length));
            slides.splice(at, 0, { id: uid(), pageTypeId: a.pageTypeId, content: a.content ?? {} });
            break;
          }
          case "페이지삭제":
            if (slides.length > 1 && slides[a.at]) slides.splice(a.at, 1);
            break;
          case "페이지이동": {
            const f = a.from, t = a.to;
            if (slides[f] && t >= 0 && t < slides.length) {
              const [m] = slides.splice(f, 1);
              slides.splice(t, 0, m);
            }
            break;
          }
        }
      }
      return { slides };
    });
  };

  /** 화면에서 끌어 옮긴 자리를 저장한다 */
  const nudgeAt = (at: string, d: Nudge) =>
    patch((p) => ({
      slides: p.slides.map((s2, i) => {
        if (i !== cur) return s2;
        const prev: Nudge = s2.adjust?.[at] ?? {};
        return {
          ...s2,
          adjust: {
            ...(s2.adjust ?? {}),
            [at]: {
              dx: (prev.dx ?? 0) + (d.dx ?? 0),
              dy: (prev.dy ?? 0) + (d.dy ?? 0),
              dw: (prev.dw ?? 0) + (d.dw ?? 0),
              dh: (prev.dh ?? 0) + (d.dh ?? 0),
            },
          },
        };
      }),
    }));

  /** 화면에서 고친 글을 내용에 쓴다 */
  const writeText = (bindPath: string, text: string) =>
    patch((p) => ({
      slides: p.slides.map((s2, i) => (i === cur ? { ...s2, content: setAt(s2.content, bindPath, text) } : s2)),
    }));

  /** 이 페이지에만 사진 한 장 더 넣기 */
  const addExtraPhoto = (dataUrl: string) => {
    const key = `추가사진-${uid()}`;
    const ex: Extra = { id: uid(), type: "image", x: 3.2, y: 1.8, w: 3.2, h: 2.1, value: key };
    patch((p) => ({
      assets: { ...p.assets, [key]: dataUrl },
      slides: p.slides.map((s2, i) => (i === cur ? { ...s2, extras: [...(s2.extras ?? []), ex] } : s2)),
    }));
    setPicked(`x:${ex.id}`);
  };

  /** 집어 둔 것 지우기 (추가한 것만 지울 수 있다) */
  const removePicked = () => {
    if (!picked?.startsWith("x:")) return;
    const id = picked.slice(2);
    patch((p) => ({
      slides: p.slides.map((s2, i) =>
        i === cur ? { ...s2, extras: (s2.extras ?? []).filter((x) => x.id !== id) } : s2),
    }));
    setPicked(null);
  };

  /** 집어 둔 것을 원래 자리로 */
  const resetPicked = () => {
    if (!picked) return;
    patch((p) => ({
      slides: p.slides.map((s2, i) => {
        if (i !== cur) return s2;
        const next = { ...(s2.adjust ?? {}) };
        delete next[picked];
        return { ...s2, adjust: next };
      }),
    }));
  };

  // 창이나 서랍이 열리고 닫힐 때마다 미리보기를 폭에 맞춘다
  useEffect(() => {
    if (!autoFit) return;
    const el = stageRef.current;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth - 56;
      const h = el.clientHeight - 86;
      if (w <= 0 || h <= 0) return;
      const z = Math.min(w / (style.slide.widthIn * 96), h / (style.slide.heightIn * 96));
      setZoom(Math.max(작게끝, Math.min(1.2, Number(z.toFixed(3)))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [autoFit, style.slide.widthIn, style.slide.heightIn]);

  // 인쇄(PDF)는 미리보기를 그대로 내보낸다. 그래서 모양이 같다.
  const printPdf = () => {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 120);
  };

  if (printing) {
    return (
      <div className="print-root">
        {plans.map((p, i) => (
          <div className="print-page" key={i}>
            <SlideView ops={p.ops} style={style} zoom={1} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="topbar" style={{ borderTop: "1px solid var(--line)" }}>
        <button className="btn sm" onClick={onBack}>← 보관함</button>
        {editTitle ? (
          <input
            autoFocus
            className="search"
            defaultValue={project.title}
            style={{ width: 230 }}
            onBlur={(e) => { patch(() => ({ title: e.target.value || "제목 없음" })); setEditTitle(false); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditTitle(false);
            }}
          />
        ) : (
          <b style={{ fontSize: 16.5, cursor: "text" }} onClick={() => setEditTitle(true)} title="클릭하여 제목 수정">
            {project.title}
          </b>
        )}
        {/* 분류가 정해져야 어떤 규칙이 걸릴지 정해진다 */}
        <select
          className="scopesel"
          value={project.category}
          onChange={(e) => patch(() => ({ category: e.target.value }))}
          title="분류 — 여기에 따라 적용되는 규칙이 달라집니다"
        >
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {/*
          판 크기.

          현수막은 16:9·A4 같은 정해진 네모가 없다. 고객사가 "400×70" 이라고 부르면
          그 숫자가 곧 주문서다. 그래서 고르는 칸 대신 지금 치수를 적어 두고,
          누르면 cm 로 고쳐 넣게 한다.
          (고르는 칸을 두면 400×70 이 어느 네모에도 안 맞아서 "와이드 16:9" 로 잘못 보였고,
           모르고 건드리면 현수막 크기가 통째로 날아갔다)
        */}
        {인쇄물인가 ? (
          <button className="btn sm" onClick={() => set규격바꾸기(true)}
            title="누르면 가로·세로를 cm 로 고칠 수 있습니다">
            📐 {지금규격}
          </button>
        ) : (
          <select
            className="scopesel"
            value={slideSizeOf(style.slide.widthIn, style.slide.heightIn).id}
            onChange={(e) => {
              const s2 = SLIDE_SIZES.find((x) => x.id === e.target.value);
              if (s2) onSlideSize(s2.widthIn, s2.heightIn);
            }}
            title="판 크기 — 요즘은 와이드 16:9 를 가장 많이 씁니다"
          >
            {SLIDE_SIZES.map((s2) => <option key={s2.id} value={s2.id}>{s2.name}</option>)}
            {/* 어느 네모에도 안 맞는 크기면 그 크기를 그대로 보여 준다. 거짓으로 16:9 라고 하지 않는다 */}
            {!SLIDE_SIZES.some((x) => x.id === slideSizeOf(style.slide.widthIn, style.slide.heightIn).id) && (
              <option value={slideSizeOf(style.slide.widthIn, style.slide.heightIn).id}>
                {지금규격}
              </option>
            )}
          </select>
        )}
        <small style={{ color: "var(--muted)" }}>
          {project.client || "고객사 미입력"} · {project.slides.length}장 · {style.name}
          {project.styleOverride && <span className="chip">이 건만 규격 바꿈</span>}
        </small>
        <button className={`btn sm ${srcOpen ? "accent" : ""}`} onClick={() => { setSrcOpen(!srcOpen); setFilesOpen(false); }}>
          지난 자료
        </button>
        <button className={`btn sm ${filesOpen ? "accent" : ""}`} onClick={() => { setFilesOpen(!filesOpen); setSrcOpen(false); }}
          title="이 건의 원본 파일과 제작 자료를 보관하는 곳">
          파일함{project.docs?.length ? ` ${project.docs.length}` : ""}
        </button>
        {/*
          파일 고르는 창은 "사람이 직접 누른 것"이어야 열린다.
          코드로 눌러서 여는 방식은 옆 패널(아티팩트) 안에서 막힌다.
          그래서 버튼 자체를 입력칸의 이름표로 만든다.
        */}
        <label className="btn sm" style={{ cursor: "pointer" }}
          title="이 페이지 위에 사진을 한 장 얹습니다. 얹은 뒤 끌어서 옮기고 크기를 바꿀 수 있습니다">
          + 사진 추가
          <input type="file" accept="image/*" style={{ display: "none" }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              addExtraPhoto(await readShrunk(f));
            }} />
        </label>
        <button
          className={`btn sm ${project.status === "완료" ? "accent" : ""}`}
          title={project.status === "완료" ? "다시 진행 중으로" : "완료로 표시합니다"}
          onClick={() =>
            patch((p) =>
              p.status === "완료"
                ? { status: "진행 중", completedAt: undefined }
                : { status: "완료", completedAt: new Date().toISOString() },
            )
          }
        >
          {project.status === "완료" ? "완료됨" : "완료로 표시"}
        </button>
        <div className="spacer" />
        {todos.length > 0 && (
          <small style={{ color: "var(--todo)", fontWeight: 600 }}>
            미입력 {todos.length}건
          </small>
        )}
        {msg && <small style={{ color: "var(--todo)" }}>{msg}</small>}
        {busyOut && <small style={{ color: "var(--muted)" }}>{busyOut}</small>}
        {/* 인쇄 규격 — PDF 로 낼 때 어떤 종이에 앉힐지 */}
        <select
          className="scopesel"
          value={project.printPaper ?? "screen"}
          onChange={(e) => patch(() => ({ printPaper: e.target.value }))}
          title={PRINT_SIZES.find((x) => x.id === (project.printPaper ?? "screen"))?.note}
        >
          {PRINT_SIZES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <button
          className="btn sm"
          disabled={!project.slides.length || !!busyOut}
          onClick={async () => {
            setMsg(""); setBusyOut("PDF 만드는 중…");
            const r = await downloadPdf(plans, style, project.title,
              (d, t) => setBusyOut(`PDF 만드는 중… ${d}/${t}장`), project.printPaper);
            setBusyOut("");
            if (!r.ok) setMsg(r.error ?? "PDF 저장 실패");
          }}
        >
          PDF 저장
        </button>
        {/*
          인쇄소에 넘길 파일.
          위의 "PDF 저장" 은 화면에서 보는 배율로 뜬다 — 메일로 돌려 보기엔 맞지만
          400cm 현수막을 그대로 박으면 뭉개진다. 이 단추는 배율을 최대로 올려 뜬다.
          느리고 파일이 크다. 그래서 따로 두었다.
        */}
        <button
          className={`btn sm ${인쇄물인가 ? "primary" : ""}`}
          disabled={!project.slides.length || !!busyOut}
          title={`${인쇄크기말(style)} 로 뜹니다. 인쇄소에 이 파일을 넘기십시오.`}
          onClick={async () => {
            setMsg(""); setBusyOut(`인쇄용 PDF 만드는 중… (${인쇄크기말(style)})`);
            const r = await downloadPdf(plans, style, `${project.title} (인쇄용)`,
              (d, t) => setBusyOut(`인쇄용 PDF 만드는 중… ${d}/${t}장`), project.printPaper, true);
            setBusyOut("");
            if (!r.ok) setMsg(r.error ?? "인쇄용 PDF 저장 실패");
          }}
        >
          인쇄용 PDF
        </button>
        <button
          className="btn sm primary"
          disabled={!project.slides.length || !!busyOut}
          onClick={async () => {
            setMsg("");
            const r = await downloadPptx(plans, style, project.title);
            if (!r.ok) setMsg(r.error ?? "내보내기 실패");
          }}
        >
          PPT 저장
        </button>
      </div>

      <div className={`editor${납작한가 ? " 납작" : ""}`}>
        {/* ── 파일함 — 이 건에 딸린 원본·자료를 건별로 모아 둔다 ── */}
        {filesOpen && (
          <Files project={project} onChange={onChange} toServer={toServer}
            onClose={() => setFilesOpen(false)} />
        )}

        {/* ── 지난 자료 서랍 — 편집기를 나가지 않고 낱장을 꺼내 쓴다 ── */}
        {srcOpen && (
          <SourceDrawer
            projects={allProjects}
            categories={categories}
            style={style}
            pageTypes={pageTypes}
            currentId={project.id}
            onClose={() => setSrcOpen(false)}
            onInsert={(s2, fromAssets) => {
              patch((p) => {
                const slides = [...p.slides];
                slides.splice(cur + 1, 0, { ...s2, id: uid() });
                return { slides, assets: { ...fromAssets, ...p.assets } };
              });
              onCur(cur + 1);
            }}
          />
        )}

        {/* ── 왼쪽: 페이지 목록 ── */}
        <div className="pane-left">
          <p className="sec" style={{ marginTop: 0 }}>페이지 {project.slides.length}</p>
          {project.slides.map((s, i) => (
            <button
              key={s.id}
              className={`pagechip ${i === cur ? "on" : ""}`}
              onClick={() => onCur(i)}
            >
              {i + 1}. {typeOf(s.pageTypeId)?.name ?? "알 수 없음"}
              <small>{firstText(s.content) || "비어 있음"}</small>
            </button>
          ))}
          <button className="btn sm" style={{ width: "100%" }} onClick={() => setAdding(!adding)}>
            + 페이지 추가
          </button>
          {adding && (() => {
            const q = findType.trim().toLowerCase();
            const hit = (t: PageType) =>
              !q || `${t.name} ${t.description} ${t.group}`.toLowerCase().includes(q);
            const groups = [...new Set(pageTypes.map((t) => t.group))];
            const found = pageTypes.filter(hit).length;
            return (
              <div style={{ marginTop: 8 }}>
                <input className="search" style={{ width: "100%", marginBottom: 8 }}
                  autoFocus placeholder={`페이지 모양 찾기 (${pageTypes.length}종)`}
                  value={findType} onChange={(e) => setFindType(e.target.value)} />
                {found === 0 && <p className="chat-hint">찾는 모양이 없습니다. 창고 → 페이지 모양에서 직접 만드실 수 있습니다.</p>}
                {groups.map((g) => {
                  const list = pageTypes.filter((t) => t.group === g && hit(t));
                  if (!list.length) return null;
                  return (
                    <div key={g}>
                      <p className="sec">{g}</p>
                      {list.map((t) => (
                        <button key={t.id} className="pagechip" onClick={() => addPage(t)}>
                          {t.name}
                          <small>{t.description}</small>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* ── 가운데: 미리보기 (회색 바탕 위에) ── */}
        {/* 시안이 와 있으면 작업 자리를 덮는다. 나란히 놓고 견주는 게 먼저다. */}
        {deckDrafts.length > 0 && (
          <DeckDrafts
            deckDrafts={deckDrafts} project={project}
            baseStyle={baseStyle} pageTypes={pageTypes}
            onPick={onPickDeck} onClose={onCloseDecks}
            onAgain={() => { onCloseDecks(); setMsg("대화창에 어디가 마음에 안 드는지 적어 주시면 다시 내놓습니다."); }}
          />
        )}

        {drafts.length > 0 && (
          <Drafts
            drafts={drafts} project={project} slideIndex={cur}
            baseStyle={baseStyle} pageTypes={pageTypes}
            onPick={onPickDraft} onClose={onCloseDrafts}
            onAgain={() => { onCloseDrafts(); setMsg("대화창에 어디가 마음에 안 드는지 적어 주시면 다시 내놓습니다."); }}
          />
        )}

        {/* 규격 바꾸기 — 시안 칸과 같은 자리에 덮는다. 대화창은 그대로 보인다 */}
        {규격바꾸기 && (
          <div className="drafts" style={{ overflow: "auto", padding: 20 }}>
            <규격묻기
              분류이름={project.title || "인쇄물"}
              기본W={Math.round(style.slide.widthIn * 25.4)}
              기본H={Math.round(style.slide.heightIn * 25.4)}
              바꾸기
              onOk={(mmW, mmH) => {
                onSlideSize(Number((mmW / 25.4).toFixed(3)), Number((mmH / 25.4).toFixed(3)));
                set규격바꾸기(false);
              }}
              onCancel={() => set규격바꾸기(false)}
            />
          </div>
        )}

        <div className="stage" ref={stageRef}>
          {slide ? (
            <div>
              <div className="stage-inner">
                <SlideView
                  ops={plans[cur]?.ops ?? []}
                  style={slide?.styleOverride ? styleFor(style, slide.styleOverride) : style}
                  zoom={zoom}
                  edit={{
                    picked,
                    onPick: setPicked,
                    onMove: (at, dx, dy) => nudgeAt(at, { dx, dy }),
                    onResize: (at, dw, dh) => nudgeAt(at, { dw, dh }),
                    onText: writeText,
                  }}
                />
              </div>
              <div className="zoom" style={{ marginTop: 12, justifyContent: "center" }}>
                <button className="btn sm" onClick={() => { setAutoFit(false); setZoom((z) => Math.max(작게끝, z - 0.1)); }}>−</button>
                <span style={{ minWidth: 48, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
                <button className="btn sm" onClick={() => { setAutoFit(false); setZoom((z) => Math.min(1.6, z + 0.1)); }}>+</button>
                <button className={`btn sm ${autoFit ? "accent" : ""}`} onClick={() => setAutoFit(true)}>화면 맞춤</button>
                <span style={{ width: 14 }} />
                {picked && <button className="btn sm" onClick={resetPicked}>위치 초기화</button>}
                {picked?.startsWith("x:") && <button className="btn sm" onClick={removePicked}>삭제</button>}
              </div>
            </div>
          ) : (
            <div style={{ color: "#fff", textAlign: "center" }}>
              <p style={{ fontSize: 18, marginBottom: 6 }}>아직 페이지가 없습니다</p>
              <p style={{ fontSize: 15.5, opacity: 0.8 }}>왼쪽에서 “페이지 추가”를 눌러 주십시오</p>
            </div>
          )}
        </div>

        {/* ── 오른쪽: 내용 고치기 ── */}
        <div className="pane-right">
          {slide && slideType ? (
            <>
              <div className="row" style={{ marginBottom: 14 }}>
                <div className="grow">
                  <b style={{ fontSize: 16.5 }}>{slideType.name}</b>
                  <div style={{ color: "var(--muted)", fontSize: 14, marginTop: 2 }}>
                    {cur + 1}번째 페이지
                  </div>
                </div>
                <button className="btn sm" title="이전 페이지 보기"
                  onClick={() => onCur(Math.max(0, cur - 1))} disabled={cur === 0}>◀</button>
                <button className="btn sm" title="다음 페이지 보기"
                  onClick={() => onCur(Math.min(project.slides.length - 1, cur + 1))}
                  disabled={cur === project.slides.length - 1}>▶</button>
                <span className="fdiv" />
                <button className="btn sm" title="이 페이지를 앞으로 이동"
                  onClick={() => movePage(cur, -1)} disabled={cur === 0}>순서 ↑</button>
                <button className="btn sm" title="이 페이지를 뒤로 이동"
                  onClick={() => movePage(cur, 1)}
                  disabled={cur === project.slides.length - 1}>순서 ↓</button>
                <button className="btn sm" onClick={() => removePage(cur)}>삭제</button>
              </div>

              <p className="sec" style={{ marginTop: 0 }}>내용 입력</p>

              {todos.filter((t) => t.slideIndex === cur).length > 0 && (
                <div className="warn">
                  <b>이 페이지에 안 채운 칸이 있습니다</b>
                  <ul>
                    {todos.filter((t) => t.slideIndex === cur).map((t, i) => (
                      <li key={i}>{t.label}</li>
                    ))}
                  </ul>
                </div>
              )}

              <SlotForm
                slots={slideType.slots}
                content={slide.content}
                assets={project.assets}
                onAsset={(k, v) => patch((p) => ({ assets: { ...p.assets, [k]: v } }))}
                onChange={(next) =>
                  patch((p) => ({
                    slides: p.slides.map((s, i) => (i === cur ? { ...s, content: next } : s)),
                  }))
                }
              />
            </>
          ) : (
            <p style={{ color: "var(--muted)" }}>페이지를 고르면 여기서 내용을 고칠 수 있습니다.</p>
          )}
        </div>
      </div>
    </>
  );
}

/** 페이지 이름표에 쓸 한 줄. 사진 경로 같은 건 건너뛴다. */
function firstText(c: Record<string, any>): string {
  for (const v of Object.values(c)) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (!t) continue;
    // 사진 주소도, AI 가 그린 그림(SVG)도 사람이 읽을 글이 아니다.
    // 안 거르면 페이지 목록에 <svg xmlns="http://www… 가 그대로 뜬다.
    if (t.startsWith("data:") || t.startsWith("<svg") || /\.(png|jpe?g|webp|svg|gif)$/i.test(t)) continue;
    return t.slice(0, 22);
  }
  return "";
}
