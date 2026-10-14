import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, Content, PageType, Project, StylePreset, Todo } from "../core/types";
import { collectTodos, interpret } from "../core/interpret";
import { SlideView } from "../render/html";
import { downloadPptx } from "../render/pptx";
import { SlotForm } from "./SlotForm";
import { uid } from "../store/db";
import { SourceDrawer } from "./SourceDrawer";
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
}

export function Editor({ project, style, pageTypes, categories, allProjects, cur, onCur, onChange, onBack, aiSystem, onSaveRule, onHistory, onStyleChange, turnsOf, onTurns }: Props) {
  const [zoom, setZoom] = useState(0.78);
  /** 폭에 맞춰 자동으로 줄인다. +/- 를 누르면 손맛을 지킨다. */
  const [autoFit, setAutoFit] = useState(true);
  const stageRef = useRef<HTMLDivElement>(null);
  const [adding, setAdding] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [msg, setMsg] = useState("");
  const [editTitle, setEditTitle] = useState(false);
  const [srcOpen, setSrcOpen] = useState(false);

  const typeOf = (id: string) => pageTypes.find((t) => t.id === id);

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
        return {
          ops: interpret(t, s.content, {
            style,
            assets: project.assets,
            pageNumber: pageNumbers[i],
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
      setZoom(Math.max(0.2, Math.min(1.2, Number(z.toFixed(3)))));
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
          <b style={{ fontSize: 14, cursor: "text" }} onClick={() => setEditTitle(true)} title="눌러서 이름 고치기">
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
        <small style={{ color: "var(--muted)" }}>
          {project.client || "고객사 미입력"} · {project.slides.length}장 · {style.name}
          {project.styleOverride && <span className="chip">이 건만 규격 바꿈</span>}
        </small>
        <button className={`btn sm ${srcOpen ? "accent" : ""}`} onClick={() => setSrcOpen(!srcOpen)}>
          지난 자료
        </button>
        <div className="spacer" />
        {todos.length > 0 && (
          <small style={{ color: "var(--todo)", fontWeight: 600 }}>
            빈칸 {todos.length}개
          </small>
        )}
        {msg && <small style={{ color: "var(--todo)" }}>{msg}</small>}
        {/* 옆 패널에서는 인쇄 창을 열 수 없다 */}
        {!hasClaude() && (
          <button className="btn sm" onClick={printPdf} disabled={!project.slides.length}>
            PDF 인쇄
          </button>
        )}
        <button
          className="btn sm primary"
          disabled={!project.slides.length}
          onClick={async () => {
            setMsg("");
            const r = await downloadPptx(plans, style, project.title);
            if (!r.ok) setMsg(r.error ?? "내보내기 실패");
          }}
        >
          PPT 내보내기
        </button>
      </div>

      <div className="editor">
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
          {adding && (
            <div style={{ marginTop: 8 }}>
              {["표지", "본문", "마무리"].map((g) => (
                <div key={g}>
                  <p className="sec">{g}</p>
                  {pageTypes.filter((t) => t.group === g).map((t) => (
                    <button key={t.id} className="pagechip" onClick={() => addPage(t)}>
                      {t.name}
                      <small>{t.description}</small>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 가운데: 미리보기 (회색 바탕 위에) ── */}
        <div className="stage" ref={stageRef}>
          {slide ? (
            <div>
              <div className="stage-inner">
                <SlideView ops={plans[cur]?.ops ?? []} style={style} zoom={zoom} />
              </div>
              <div className="zoom" style={{ marginTop: 12, justifyContent: "center" }}>
                <button className="btn sm" onClick={() => { setAutoFit(false); setZoom((z) => Math.max(0.2, z - 0.1)); }}>−</button>
                <span style={{ minWidth: 48, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
                <button className="btn sm" onClick={() => { setAutoFit(false); setZoom((z) => Math.min(1.6, z + 0.1)); }}>+</button>
                <button className={`btn sm ${autoFit ? "accent" : ""}`} onClick={() => setAutoFit(true)}>맞춤</button>
              </div>
            </div>
          ) : (
            <div style={{ color: "#fff", textAlign: "center" }}>
              <p style={{ fontSize: 15, marginBottom: 6 }}>아직 페이지가 없습니다</p>
              <p style={{ fontSize: 13, opacity: 0.8 }}>왼쪽에서 “페이지 추가”를 눌러 주세요</p>
            </div>
          )}
        </div>

        {/* ── 오른쪽: 내용 고치기 ── */}
        <div className="pane-right">
          {slide && slideType ? (
            <>
              <div className="row" style={{ marginBottom: 14 }}>
                <div className="grow">
                  <b style={{ fontSize: 14 }}>{slideType.name}</b>
                  <div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 2 }}>
                    {cur + 1}번째 페이지
                  </div>
                </div>
                <button className="btn sm" onClick={() => movePage(cur, -1)} disabled={cur === 0}>↑</button>
                <button className="btn sm" onClick={() => movePage(cur, 1)}
                  disabled={cur === project.slides.length - 1}>↓</button>
                <button className="btn sm" onClick={() => removePage(cur)}>삭제</button>
              </div>

              <p className="sec" style={{ marginTop: 0 }}>내용 직접 고치기</p>

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
    if (t.startsWith("data:") || /\.(png|jpe?g|webp|svg|gif)$/i.test(t)) continue;
    return t.slice(0, 22);
  }
  return "";
}
