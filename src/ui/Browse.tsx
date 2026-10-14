import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, PageType, Project, Slide, StylePreset } from "../core/types";
import { GripH, usePanel } from "./panels";
import { interpret } from "../core/interpret";
import { SlideView } from "../render/html";
import { moodsOf } from "../core/mood";

/**
 * 넘겨보기 — 지난 완성본을 한 장씩 훑는 화면.
 *
 * 실무에서 제안서를 쓸 때 출발점은 빈 종이가 아니라 "지난 완성본"이다.
 * 그래서 훑다가 두 가지를 할 수 있어야 한다.
 *   ① 이 제안서 전체를 뼈대로 새로 시작
 *   ② 이 페이지 한 장만 뽑아 쓰기   ← 실무에서 더 자주 쓴다
 */

interface Props {
  project: Project;
  style: StylePreset;
  pageTypes: PageType[];
  onClose: () => void;
  /** 이 제안서를 뼈대로 새로 시작 */
  onUseAsBase: (p: Project, keepText: boolean) => void;
  /** 이 페이지 한 장 담기 */
  onTakePage: (s: Slide) => void;
  /** 담아둔 장수 (버튼 문구에 쓴다) */
  takenCount: number;
  /** 편집기로 열기 */
  onOpen: (id: string) => void;
  /** 분류 이름 (내부 id 가 아니라 사람이 읽는 이름) */
  categoryName: string;
  /** 나가지 않고 다른 제안서로 건너뛰기 */
  allProjects: Project[];
  categories: Category[];
  onPick: (id: string) => void;
}

export function Browse({
  project, style, pageTypes, onClose, onUseAsBase, onTakePage, takenCount, onOpen, categoryName, allProjects, categories, onPick,
}: Props) {
  const [cur, setCur] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const [navCat, setNavCat] = useState<string>("all");
  const [zoom, setZoom] = useState(0.62);
  /** 아래 페이지 줄 높이 — 끌어서 조정, 기억된다 */
  const strip = usePanel("filmstrip", 104, 62, 420);
  const stageRef = useRef<HTMLDivElement>(null);

  // 화면이 넓으면 크게 보여야 한다. 보면서 고칠 수 있어야 하니까.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth - 130;   // 좌우 화살표 자리
      const h = el.clientHeight - 80;   // 아래 버튼 자리
      if (w <= 0 || h <= 0) return;
      const z = Math.min(w / (style.slide.widthIn * 96), h / (style.slide.heightIn * 96));
      setZoom(Math.max(0.25, Math.min(1.6, Number(z.toFixed(3)))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [style.slide.widthIn, style.slide.heightIn]);
  const typeOf = (id: string) => pageTypes.find((t) => t.id === id);
  const moods = useMemo(() => moodsOf(project, pageTypes), [project, pageTypes]);

  const pageNumbers = useMemo(() => {
    let n = 0;
    return project.slides.map((s) => (typeOf(s.pageTypeId)?.showPageNo === false ? 0 : ++n));
  }, [project.slides, pageTypes]);

  const opsOf = (i: number) => {
    const s = project.slides[i];
    const t = s && typeOf(s.pageTypeId);
    return t
      ? interpret(t, s.content, {
          style, assets: project.assets, pageNumber: pageNumbers[i],
          adjust: s.adjust, extras: s.extras,
        })
      : [];
  };

  const go = (d: number) =>
    setCur((c) => Math.max(0, Math.min(project.slides.length - 1, c + d)));

  const slide = project.slides[cur];

  return (
    <div className="browse">
      <div className="browse-head">
        <button className="btn sm" onClick={onClose}>← 보관함</button>
        <button className={`btn sm ${navOpen ? "accent" : ""}`} onClick={() => setNavOpen(!navOpen)}>
          다른 제안서
        </button>
        <div className="grow" style={{ minWidth: 0 }}>
          <b style={{ fontSize: 16.5 }}>{project.title}</b>
          <div style={{ color: "var(--muted)", fontSize: 14.5, marginTop: 2 }}>
            {project.client || "고객사 없음"} · {categoryName} · {project.slides.length}장
            {moods.map((m) => (
              <span className="chip" key={m}>{m}</span>
            ))}
          </div>
        </div>
        <button className="btn sm accent" onClick={() => onOpen(project.id)}>AI 와 고치기</button>
        <button className="btn sm" onClick={() => onUseAsBase(project, false)}
          title="페이지 구성만 가져오고 글은 비운 새 제안서를 만듭니다">
          구성만 베껴 새로 만들기
        </button>
        <button className="btn sm primary" onClick={() => onUseAsBase(project, true)}
          title="글까지 그대로 복사한 새 제안서를 만듭니다">
          통째로 베껴 새로 만들기
        </button>
      </div>

      <div className="browse-body">
        {navOpen && (
          <div className="browsenav">
            <p className="sec" style={{ marginTop: 0 }}>분류</p>
            <button className={`navitem ${navCat === "all" ? "on" : ""}`} onClick={() => setNavCat("all")}>
              전체 <span>{allProjects.length}</span>
            </button>
            {categories.map((c) => {
              const n = allProjects.filter((x) => x.category === c.id).length;
              if (!n) return null;
              return (
                <button key={c.id} className={`navitem ${navCat === c.id ? "on" : ""}`}
                  onClick={() => setNavCat(c.id)}>
                  {c.name} <span>{n}</span>
                </button>
              );
            })}

            <p className="sec">제안서</p>
            {allProjects
              .filter((x) => navCat === "all" || x.category === navCat)
              .map((x) => (
                <button key={x.id}
                  className={`navitem ${x.id === project.id ? "on" : ""}`}
                  onClick={() => { onPick(x.id); setCur(0); }}>
                  <span style={{ marginLeft: 0, opacity: 1, overflow: "hidden",
                                 textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {x.title}
                  </span>
                </button>
              ))}
          </div>
        )}

      <div className="browse-stage" ref={stageRef}>
        <button className="nav" onClick={() => go(-1)} disabled={cur === 0} aria-label="이전 장">‹</button>
        <div>
          <div className="stage-inner">
            <SlideView ops={opsOf(cur)} style={style} zoom={zoom} />
          </div>
          <div className="row" style={{ justifyContent: "center", marginTop: 12 }}>
            <span style={{ color: "#fff", fontSize: 15, minWidth: 74, textAlign: "center" }}>
              {cur + 1} / {project.slides.length}
            </span>
            <button className="btn sm accent" onClick={() => slide && onTakePage(slide)}>
              이 페이지 담기{takenCount > 0 ? ` (담은 것 ${takenCount}장)` : ""}
            </button>
          </div>
        </div>
        <button className="nav" onClick={() => go(1)}
          disabled={cur === project.slides.length - 1} aria-label="다음 장">›</button>
      </div>
      </div>

      <GripH onDrag={(dy) => strip.nudge(-dy)} onReset={strip.reset} />
      <div className="filmstrip" style={{ height: strip.size }}>
        {project.slides.map((s, i) => (
          <button key={s.id} className={`frame ${i === cur ? "on" : ""}`} onClick={() => setCur(i)}>
            <SlideView ops={opsOf(i)} style={style} zoom={(strip.size - 26) / (style.slide.heightIn * 96)} />
            <small>{i + 1}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
