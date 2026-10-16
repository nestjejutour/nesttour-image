import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, LibItem, PageType, Project, StylePreset } from "../core/types";
import { Library, 놓은것펼치기 } from "./Library";
import { 분류옵션 } from "./분류칸";
import { interpret } from "../core/interpret";
import { SlideView } from "../render/html";
import { clientKind, moodsOf, type Mood } from "../core/mood";

/**
 * 진열대 (첫 화면)
 *
 * 실무에서 제안서를 쓸 때 출발점은 빈 종이가 아니라 "지난 완성본"이다.
 * 그래서 첫 화면은 고르는 화면이 아니라 보는 화면이어야 한다.
 *
 * 왼쪽에서 좁히고 → 가운데 분류별 줄에서 훑고 → 눌러서 넘겨본다.
 */

interface Props {
  projects: Project[];
  categories: Category[];
  style: StylePreset;
  pageTypes: PageType[];
  ruleCount: number;
  onBrowse: (id: string) => void;
  onOpen: (id: string) => void;
  onNew: (categoryId: string) => void;
  /** 자료도 AI 도 없이, 백지 한 장으로 바로 시작 */
  onBlank: (categoryId: string) => void;
  /** 선택 페이지 칸 열기 */
  onOpenTray: () => void;
  trayCount: number;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string) => void;
  onAddCategory: (name: string, kind: Category["kind"], parentId?: string) => void;
  onRenameCategory: (id: string, name: string) => void;
  onDeleteCategory: (id: string) => void;
  /** 분류 차례 바꾸기 — 바뀐 차례대로 번호를 다시 매긴다 */
  onReorderCategories: (ids: string[]) => void;
  /** 갈래 바꾸기 (우리 결과물 ↔ 참고 자료) */
  onChangeKind: (id: string, kind: Category["kind"]) => void;
  /** 분류의 쓰임(문서·현수막) 바꾸기 */
  onChangeUse: (id: string, 용도: "문서" | "현수막") => void;
  /** 완성본 파일을 작업물로 등록한다 (자료함이 아니라 위 칸으로) */
  onRegister: (files: File[], categoryId: string) => void;
  등록중?: { 끝난: number; 전부: number; 지금: string } | null;
  /** 치워 둔 분류 도로 꺼내기 */
  onRestoreCategory: (id: string) => void;
  /* ── 분류에 쌓아 두는 자료 ── */
  /** 지금 고른 분류 ("all" 이면 전체) */
  sel: string;
  onSel: (id: string) => void;
  library: LibItem[];
  byName?: string;
  /** 대표인가 — 큰 분류를 지우거나 이름을 바꾸는 건 대표만 한다 */
  대표?: boolean;
  onAddLib: (xs: LibItem[]) => void;
  onRemoveLib: (id: string) => void;
  onRemoveLibMany: (ids: string[]) => void;
  onRenameLib: (id: string, name: string) => void;
  onMoveLib: (id: string, categoryId: string) => void;
  onMakeFolders: (parentId: string, names: string[]) => Record<string, string>;
  onNoteLib: (id: string, note: string) => void;
  /** 제안서를 다른 분류로 옮기기 */
  onMoveProject: (id: string, categoryId: string) => void;
}

const PER_ROW = 5;
/** 전체 화면에 띄우는 최근 작업 수 */
const 최근몇개 = 10;

export function Dashboard(p: Props) {
  const { projects, categories, style, pageTypes } = p;
  /**
   * 고른 분류.
   *
   * 여기 안에 두면 새 제안서를 만들러 갔다 취소하고 돌아올 때
   * 이 화면이 통째로 새로 서면서 "전체" 로 되돌아간다.
   * 보던 자리를 잃지 않게 바깥(App)이 들고 있는다.
   */
  const sel = p.sel;
  const setSel = p.onSel;
  const [mood, setMood] = useState<Mood | null>(null);
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"고침" | "만듦" | "완료" | "이름">("고침");
  const [period, setPeriod] = useState<"전체" | "오늘" | "이번 주" | "이번 달">("전체");
  const [onlyDone, setOnlyDone] = useState<"전체" | "진행 중" | "완료">("전체");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<Category["kind"]>("우리 결과물");
  /** 제자리에서 이름을 고치는 중인 분류 */
  const [고치는이름, set고치는이름] = useState<string | null>(null);
  /** 작은 메뉴(⋯)가 열린 분류 */
  const [메뉴, set메뉴] = useState<string | null>(null);
  /** 접어 둔 큰 분류 */
  const [접은것, set접은것] = useState<Set<string>>(() => new Set());

  const moodsFor = useMemo(() => {
    const m = new Map<string, Mood[]>();
    for (const pr of projects) m.set(pr.id, moodsOf(pr, pageTypes));
    return m;
  }, [projects, pageTypes]);

  const allMoods = useMemo(() => {
    const s = new Set<Mood>();
    moodsFor.forEach((v) => v.forEach((x) => s.add(x)));
    return [...s];
  }, [moodsFor]);

  /** 이 제안서의 기준 날짜 — 완료된 건 완료일, 아니면 마지막으로 고친 날 */
  const stamp = (pr: Project) => (pr.status === "완료" ? (pr.completedAt ?? pr.updatedAt) : pr.updatedAt);

  const inPeriod = (pr: Project) => {
    if (period === "전체") return true;
    const d = new Date(stamp(pr));
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date();
    if (period === "오늘") return d.toDateString() === now.toDateString();
    const days = (now.getTime() - d.getTime()) / 86400000;
    return period === "이번 주" ? days <= 7 : days <= 31;
  };

  const match = (pr: Project) => {
    if (mood && !(moodsFor.get(pr.id) ?? []).includes(mood)) return false;
    if (onlyDone !== "전체" && pr.status !== onlyDone) return false;
    if (!inPeriod(pr)) return false;
    if (!q.trim()) return true;
    const hay = `${pr.title} ${pr.client} ${pr.tags.join(" ")} ${pr.summary}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  };

  const sorted = (list: Project[]) =>
    list.slice().sort((a, b) => {
      if (sortBy === "이름") return a.title.localeCompare(b.title, "ko");
      const key = (x: Project) =>
        sortBy === "만듦"
          ? x.createdAt
          : sortBy === "완료"
            ? (x.status === "완료" ? (x.completedAt ?? x.updatedAt) : "")
            : x.updatedAt;
      return key(b) > key(a) ? 1 : key(b) < key(a) ? -1 : 0;
    });

  const inCat = (id: string) => {
    const 범위 = new Set(묶음(id));
    return sorted(projects.filter((x) => 범위.has(x.category) && match(x)));
  };
  /** 그 분류에 든 자료 수 — 옆에 적는 숫자는 제안서와 자료를 함께 센다 */
  const 자료수 = (id: string) => {
    const 범위 = new Set(묶음(id));
    return p.library.filter((x) => 범위.has(x.categoryId)).length;
  };
  const 모두수 = (id: string) => inCat(id).length + 자료수(id);
  const filtered = projects.filter(match);
  // 최근에 손댄 것부터. 너무 많으면 고르기가 더 어렵다.
  const inProgress = projects
    .filter((x) => x.status === "진행 중")
    .slice()
    .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1))
    .slice(0, 3);

  /**
   * 큰 분류 → 그 아래 세부 분류 차례로 한 줄씩 펴 놓는다.
   * (화면은 한 줄짜리 목록이고, 세부 분류는 한 칸 들여 쓴다)
   */
  const 줄세우기 = () => {
    const 아래 = (부모: string | undefined) =>
      [...categories]
        .filter((c) => !c.hidden && (c.parentId ?? undefined) === 부모)
        .sort((a, b) => a.order - b.order);
    const 줄: Category[] = [];
    for (const 큰 of 아래(undefined)) {
      줄.push(큰);
      if (접은것.has(큰.id)) continue;   // 접어 두었으면 속은 안 보인다
      for (const 세부 of 아래(큰.id)) 줄.push(세부);
    }
    // 부모를 잃은 것이 있으면 맨 뒤에라도 보여 준다. 숨어서 사라지면 안 된다.
    // 다만 접어 둔 분류의 속은 미아가 아니다 — 주워 담으면 맨 아래로 떨어진다.
    for (const c of categories) {
      if (c.hidden || 줄.some((x) => x.id === c.id)) continue;
      if (c.parentId && 접은것.has(c.parentId)) continue;
      줄.push(c);
    }
    return 줄;
  };
  const cats = 줄세우기();
  /** 이 분류가 무엇을 만드는 곳인가 (세부 분류는 큰 분류를 따른다) */
  const 쓰임 = (c: Category): "문서" | "현수막" =>
    (c.parentId ? categories.find((k) => k.id === c.parentId)?.용도 : c.용도) ?? c.용도 ?? "문서";

  // 바깥을 누르면 작은 메뉴가 닫힌다. 요즘 메뉴는 다 그렇게 닫힌다.
  useEffect(() => {
    if (!메뉴) return;
    const 닫기 = () => set메뉴(null);
    window.addEventListener("pointerdown", 닫기);
    return () => window.removeEventListener("pointerdown", 닫기);
  }, [메뉴]);
  /** 어느 분류의 세부 분류들 */
  const 세부들 = (id: string) => categories.filter((c) => c.parentId === id);
  /** 이 분류와 그 아래 세부 분류 전부 */
  const 묶음 = (id: string) => [id, ...세부들(id).map((c) => c.id)];

  /* ── 분류 차례 바꾸기 ── */
  /** 지금 끌고 있는 분류 / 그 위에 올라가 있는 분류 */
  /** 자료함이 건네준 "담는 손" — 빈 제안서 자리에서도 쓴다 */
  const 담기 = useRef<((files: File[]) => void) | null>(null);
  const [빈자리끌림, set빈자리끌림] = useState(false);
  const [끄는것, set끄는것] = useState<string | null>(null);
  /** 세부 분류를 넣는 중인 큰 분류 */
  const [세부넣기, set세부넣기] = useState<string | null>(null);
  const [세부이름, set세부이름] = useState("");

  const [놓을곳, set놓을곳] = useState<string | null>(null);

  /** 같은 칸에 걸린 형제들 (차례는 이 안에서만 바뀐다) */
  const 형제들 = (부모: string | undefined) =>
    [...categories]
      .filter((c) => (c.parentId ?? undefined) === (부모 ?? undefined))
      .sort((a, b) => a.order - b.order)
      .map((c) => c.id);

  /** 끌어다 놓은 자리로 옮긴다 */
  const 옮기기 = (from: string | null, to: string) => {
    if (!from || from === to) return;
    const a = categories.find((c) => c.id === from);
    const b = categories.find((c) => c.id === to);
    // 큰 분류와 세부 분류는 서로 자리를 바꾸지 않는다
    if (!a || !b || (a.parentId ?? null) !== (b.parentId ?? null)) return;
    const ids = 형제들(a.parentId);
    const i = ids.indexOf(from);
    const j = ids.indexOf(to);
    if (i < 0 || j < 0) return;
    ids.splice(i, 1);
    ids.splice(j, 0, from);
    p.onReorderCategories(ids);
  };

  const shown = sel === "all" ? cats.filter((c) => inCat(c.id).length > 0) : cats.filter((c) => c.id === sel);
  const expanded = sel !== "all" || !!mood || !!q.trim();

  return (
    <div className="dash">
      {/* ── 왼쪽: 분류 ── */}
      <div className="dash-nav">
        <p className="sec" style={{ marginTop: 0 }}>
          분류
          {p.대표 && (
            <button className="secadd" title="분류 하나 더 만들기"
              onClick={() => { setAdding(true); set세부넣기(null); }}>+</button>
          )}
        </p>
        <button className={`navitem ${sel === "all" ? "on" : ""}`} onClick={() => setSel("all")}>
          <span className="twist 빈" aria-hidden /><b>전체</b>
          <span className="cnt">{filtered.length + p.library.length}</span>
        </button>
        {cats.map((c) => {
          const 접힘 = 접은것.has(c.id);
          const 세부 = 세부들(c.id);
          return (
          <div
            key={c.id}
            className={[
              "navrow",
              c.parentId ? "세부" : "",
              끄는것 === c.id ? "끄는중" : "",
              놓을곳 === c.id ? "놓을자리" : "",
              메뉴 === c.id ? "메뉴열림" : "",
            ].join(" ")}
            draggable={고치는이름 !== c.id}
            onDragStart={(e) => {
              set끄는것(c.id);
              e.dataTransfer.effectAllowed = "move";
              try { e.dataTransfer.setData("text/plain", c.id); } catch { /* 안 받는 브라우저도 있다 */ }
            }}
            onDragEnd={() => { set끄는것(null); set놓을곳(null); }}
            onDragOver={(e) => {
              if (!끄는것 || 끄는것 === c.id) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              set놓을곳(c.id);
            }}
            onDragLeave={() => set놓을곳((x) => (x === c.id ? null : x))}
            onDrop={(e) => {
              e.preventDefault();
              옮기기(끄는것 ?? e.dataTransfer.getData("text/plain"), c.id);
              set끄는것(null); set놓을곳(null);
            }}
          >
            {고치는이름 === c.id ? (
              /* 이름은 제자리에서 고친다. 따로 상자를 띄우지 않는다 */
              <input
                className="catrename"
                autoFocus
                defaultValue={c.name}
                onBlur={(e) => { p.onRenameCategory(c.id, e.target.value); set고치는이름(null); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") { set고치는이름(null); }
                }}
              />
            ) : (
              <button
                className={`navitem ${sel === c.id ? "on" : ""}`}
                onClick={() => setSel(c.id)}
                onDoubleClick={() => set고치는이름(c.id)}
                title="끌어서 차례를 바꿉니다"
              >
                {세부.length > 0 ? (
                  <span className="twist" aria-hidden
                    onClick={(e) => {
                      e.stopPropagation();
                      set접은것((t) => {
                        const n = new Set(t);
                        n.has(c.id) ? n.delete(c.id) : n.add(c.id);
                        return n;
                      });
                    }}>{접힘 ? "▸" : "▾"}</span>
                ) : <span className="twist 빈" aria-hidden />}
                <b>{c.name.trim() || "(이름 없음)"}</b>
                {c.kind === "참고 자료" && <em>참고</em>}
                <span className="cnt" title={`제안서 ${inCat(c.id).length}건 · 자료 ${자료수(c.id)}개`}>
                  {모두수(c.id)}
                </span>
              </button>
            )}

            {고치는이름 !== c.id && (
              <span className="rowtools">
                {!c.parentId && (
                  <button className="rowbtn" title="세부 분류 넣기"
                    onClick={() => { set세부넣기(c.id); set세부이름(""); setAdding(false); set메뉴(null);
                                     set접은것((t) => { const n = new Set(t); n.delete(c.id); return n; }); }}>+</button>
                )}
                {(p.대표 || !!c.parentId) && (
                  <button className="rowbtn" title="더 보기"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => set메뉴(메뉴 === c.id ? null : c.id)}>⋯</button>
                )}
              </span>
            )}

            {/* 더 보기 — 요즘 흔한 작은 메뉴. 바깥을 누르면 닫힌다 */}
            {메뉴 === c.id && (
              <div className="rowmenu" onPointerDown={(e) => e.stopPropagation()}>
                <button onClick={() => { set고치는이름(c.id); set메뉴(null); }}>이름 변경</button>
                {!c.parentId && (
                  <button onClick={() => { p.onChangeKind(c.id, c.kind === "참고 자료" ? "우리 결과물" : "참고 자료"); set메뉴(null); }}>
                    {c.kind === "참고 자료" ? "우리 결과물로" : "참고 자료로"}
                  </button>
                )}
                {!c.parentId && (
                  <button onClick={() => { p.onChangeUse(c.id, c.용도 === "현수막" ? "문서" : "현수막"); set메뉴(null); }}>
                    {c.용도 === "현수막" ? "문서 분류로" : "인쇄물(현수막) 분류로"}
                  </button>
                )}
                <button className="빨강" onClick={() => { p.onDeleteCategory(c.id); set메뉴(null); }}>
                  삭제{모두수(c.id) > 0 && <small>{모두수(c.id)}건은 다른 분류로 이동</small>}
                </button>
              </div>
            )}

            {/* 세부 분류 넣기 */}
            {세부넣기 === c.id && (
              <input
                className="catnew 세부"
                autoFocus
                placeholder={`${c.name} 안에 넣을 이름`}
                value={세부이름}
                onChange={(e) => set세부이름(e.target.value)}
                onBlur={() => { if (!세부이름.trim()) set세부넣기(null); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && 세부이름.trim()) {
                    p.onAddCategory(세부이름.trim(), c.kind, c.id);
                    set세부이름("");
                  }
                  if (e.key === "Escape") { set세부이름(""); set세부넣기(null); }
                }}
              />
            )}
          </div>
          );
        })}

        {adding && (
          /* 이름 하나만 받는다. 적고 Enter. */
          <input
            className="catnew"
            autoFocus
            placeholder="새 분류 이름"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={() => { if (!newName.trim()) setAdding(false); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) {
                p.onAddCategory(newName.trim(), newKind);
                setNewName("");   // 이어서 또 넣을 수 있게 칸만 비운다
              }
              if (e.key === "Escape") { setNewName(""); setAdding(false); }
            }}
          />
        )}

        {p.대표 && categories.some((c) => c.hidden) && (
          <div className="hiddencats">
            <small>삭제한 분류</small>
            {categories.filter((c) => c.hidden).map((c) => (
              <button key={c.id} className="navitem" onClick={() => p.onRestoreCategory(c.id)}
                title="눌러서 복원합니다">
                {c.name.trim() || "(이름 없음)"}<span>복원</span>
              </button>
            ))}
          </div>
        )}

        {allMoods.length > 0 && (
          <>
            <p className="sec">분위기</p>
            <div className="chips">
              {allMoods.map((m) => (
                <button key={m} className={`chip btnchip ${mood === m ? "on" : ""}`}
                  onClick={() => setMood(mood === m ? null : m)}>
                  {m}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── 가운데: 진열 ── */}
      <div className="dash-main">
        <div className="dash-top">
          <div>
            <h1>보관함</h1>
            <p className="lede" style={{ margin: 0 }}>
              완성본을 분류·기간별로 조회하고, 필요한 장을 선택해 새 제안서로 구성합니다.
            </p>
          </div>
          <div className="spacer" />
          {/* 작성 경로 두 가지. 나란히 붙여 두어야 고르기 쉽다. */}
          <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
            <button className="btn" onClick={() => p.onBlank(sel === "all" ? "proposal" : sel)}
              title="빈 표지 한 장으로 시작해 직접 작성합니다">
              신규 등록
            </button>
            <button className="btn primary" onClick={() => p.onNew(sel === "all" ? "proposal" : sel)}
              title="자료를 등록하면 AI 가 페이지 구성을 작성합니다">
              자료 기반 작성
            </button>
            <button className={`btn ${p.trayCount ? "accent" : ""}`} onClick={p.onOpenTray}
              title="여러 제안서에서 골라 둔 페이지로 새 제안서를 구성합니다">
              선택하여 만들기{p.trayCount ? ` ${p.trayCount}` : ""}
            </button>
          </div>
          <input
            className="search"
            placeholder="이름 · 고객사 · 태그로 찾기"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="filters">
          <span className="flabel">정렬</span>
          {(["고침", "만듦", "완료", "이름"] as const).map((v) => (
            <button key={v} className={`btnchip chip ${sortBy === v ? "on" : ""}`} onClick={() => setSortBy(v)}>
              {v === "고침" ? "최근 고친 순" : v === "만듦" ? "만든 순" : v === "완료" ? "완료한 순" : "이름순"}
            </button>
          ))}
          <span className="fdiv" />
          <span className="flabel">기간</span>
          {(["전체", "오늘", "이번 주", "이번 달"] as const).map((v) => (
            <button key={v} className={`btnchip chip ${period === v ? "on" : ""}`} onClick={() => setPeriod(v)}>
              {v}
            </button>
          ))}
          <span className="fdiv" />
          <span className="flabel">상태</span>
          {(["전체", "진행 중", "완료"] as const).map((v) => (
            <button key={v} className={`btnchip chip ${onlyDone === v ? "on" : ""}`} onClick={() => setOnlyDone(v)}>
              {v}
            </button>
          ))}
        </div>

        <div className="status">
          <span><b>{projects.length}</b> 사례</span>
          <span><b>{p.ruleCount}</b> 규칙</span>
          <span><b>{pageTypes.length}</b> 페이지 타입</span>
          <span className="note">쌓일수록 AI 가 더 잘 만듭니다</span>
        </div>

        {inProgress.length > 0 && sel === "all" && !q.trim() && !mood && (
          <>
            <p className="sec">
              이어서 하기 <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                — 최근에 손댄 것부터
              </span>
            </p>
            <div className="strip">
              {inProgress.map((pr) => (
                <Card key={pr.id} pr={pr} {...{ style, pageTypes }}
                  moods={moodsFor.get(pr.id) ?? []} onClick={() => p.onOpen(pr.id)}
                  onDelete={() => p.onDelete(pr.id)}
                  onToggleStatus={() => p.onToggleStatus(pr.id)} />
              ))}
            </div>
          </>
        )}

        {shown.length === 0 && (
          <div className="empty-state">
            <p style={{ fontSize: 18, color: "var(--ink)", marginTop: 0 }}>여기엔 아직 제안서가 없습니다</p>
            <p style={{ fontSize: 15.5 }}>완성본을 올리거나 새 제안서를 만들면 여기 쌓입니다. 아래에 자료를 넣어 두셔도 됩니다.</p>
          </div>
        )}

        {/* 전체는 분류 화면을 되풀이할 자리가 아니다. 최근 손댄 것만 보여 준다 */}
        {sel === "all" && filtered.length > 0 && (
          <section>
            <div className="rowhead">
              <p className="sec" style={{ margin: 0 }}>최근 작업</p>
              <span className="cnt">전체 {filtered.length}건</span>
            </div>
            <div className="cards">
              {sorted(filtered).slice(0, 최근몇개).map((pr) => (
                <Card key={pr.id} pr={pr} {...{ style, pageTypes }}
                  moods={moodsFor.get(pr.id) ?? []} onClick={() => p.onBrowse(pr.id)}
                  onDelete={() => p.onDelete(pr.id)}
                  categories={categories}
                  어디={categories.find((c) => c.id === pr.category)?.name}
                  onMove={(cid) => p.onMoveProject(pr.id, cid)}
                  onToggleStatus={() => p.onToggleStatus(pr.id)} />
              ))}
            </div>
            {filtered.length > 최근몇개 && (
              <p className="lede" style={{ marginTop: 9, fontSize: 13.5 }}>
                {filtered.length - 최근몇개}건이 더 있습니다. 왼쪽에서 분류를 고르시면 그 분류의 것이 모두 보입니다.
              </p>
            )}
          </section>
        )}

        {sel !== "all" && shown.map((c) => {
          const list = inCat(c.id);
          const visible = expanded ? list : list.slice(0, PER_ROW);
          return (
            <section key={c.id}>
              <div className="rowhead">
                <p className="sec" style={{ margin: 0 }}>
                  {c.name}
                  {c.kind === "참고 자료" && <em className="refmark">참고 자료</em>}
                </p>
                <span className="cnt">{쓰임(c) === "현수막" ? "작업물" : "제안서"} {list.length}건</span>
                {쓰임(c) === "현수막" && <em className="refmark">인쇄물 · 규격으로 만듭니다</em>}
                <div className="spacer" />
                <label className="btn sm" title="완성된 파일을 작업물로 등록합니다">
                  + 완성본 등록
                  <input type="file" multiple className="숨은칸"
                    onChange={(e) => {
                      const fs = Array.from(e.target.files ?? []);
                      e.target.value = "";
                      p.onRegister(fs, c.id);
                    }} />
                </label>
                {!expanded && list.length > PER_ROW && (
                  <button className="btn sm" onClick={() => setSel(c.id)}>
                    + 전체 보기 ({list.length})
                  </button>
                )}
              </div>
              {list.length ? (
                <div className={expanded ? "cards" : "strip"}>
                  {visible.map((pr) => (
                    <Card key={pr.id} pr={pr} {...{ style, pageTypes }}
                      moods={moodsFor.get(pr.id) ?? []} onClick={() => p.onBrowse(pr.id)}
                      onDelete={() => p.onDelete(pr.id)}
                      categories={categories}
                      onMove={(cid) => p.onMoveProject(pr.id, cid)}
                    onToggleStatus={() => p.onToggleStatus(pr.id)} />
                  ))}
                </div>
              ) : (
                <div
                  className={`빈자리 ${빈자리끌림 ? "들어옴" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); set빈자리끌림(true); }}
                  onDragLeave={() => set빈자리끌림(false)}
                  onDrop={(e) => {
                    e.preventDefault(); set빈자리끌림(false);
                    void 놓은것펼치기(e.dataTransfer).then((fs) => p.onRegister(fs, c.id));
                  }}
                >
                  {p.등록중 ? (
                    <>
                      <b>{p.등록중.끝난 + 1} / {p.등록중.전부} 등록하는 중</b>
                      <div className="libbar"><i style={{ width: `${((p.등록중.끝난 + 1) / p.등록중.전부) * 100}%` }} /></div>
                      <small>{p.등록중.지금}</small>
                    </>
                  ) : (
                    <>
                      <b>이 분류에는 아직 {쓰임(c) === "현수막" ? "작업물" : "제안서"}이 없습니다</b>
                      <small>
                        완성된 파일을 여기에 끌어다 놓으면 한 건씩 등록됩니다.
                        규격은 파일에서 읽어 내므로 적지 않으셔도 됩니다.
                      </small>
                      <div className="row" style={{ gap: 7, marginTop: 10 }}>
                        <button className="btn sm primary" onClick={() => p.onNew(c.id)}>신규 등록</button>
                        <button className="btn sm" onClick={() => p.onBlank(c.id)}>새로 만들기</button>
                        <label className="btn sm">
                          + 파일 여러 개
                          <input type="file" multiple className="숨은칸"
                            onChange={(e) => {
                              const fs = Array.from(e.target.files ?? []);
                              e.target.value = "";
                              p.onRegister(fs, c.id);
                            }} />
                        </label>
                        <label className="btn sm">
                          + 폴더째
                          <input type="file" multiple className="숨은칸"
                            ref={(el) => { if (el) el.setAttribute("webkitdirectory", ""); }}
                            onChange={(e) => {
                              const fs = Array.from(e.target.files ?? []);
                              e.target.value = "";
                              p.onRegister(fs, c.id);
                            }} />
                        </label>
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>
          );
        })}

        {/* 분류에 쌓아 두는 자료 — 현수막 .ai 처럼 제안서가 아닌 것들 */}
        <Library
          sel={sel}
          categories={categories.filter((c) => !c.hidden)}
          items={p.library}
          byName={p.byName}
          onAdd={p.onAddLib}
          onRemove={p.onRemoveLib}
          onRemoveMany={p.onRemoveLibMany}
          onRename={p.onRenameLib}
          onMove={p.onMoveLib}
          onMakeFolders={p.onMakeFolders}
          onNote={p.onNoteLib}
          onReady={(fn) => { 담기.current = fn; }}
        />
      </div>
    </div>
  );
}

/** 언제 손봤는지 */
function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (sameDay) return `오늘 ${hh}:${mm}`;
  const yr = d.getFullYear() === now.getFullYear() ? "" : `${d.getFullYear()}. `;
  return `${yr}${d.getMonth() + 1}. ${d.getDate()}. ${hh}:${mm}`;
}

function Card({
  pr, style, pageTypes, moods, onClick, onDelete, onToggleStatus, categories, onMove, 어디,
}: {
  pr: Project; style: StylePreset; pageTypes: PageType[];
  moods: Mood[]; onClick: () => void; onDelete?: () => void;
  onToggleStatus?: () => void;
  /** 어느 분류에 든 것인가 (여럿이 섞여 보일 때만 적는다) */
  어디?: string;
  /** 다른 분류로 옮기기 */
  categories?: Category[];
  onMove?: (categoryId: string) => void;
}) {
  const [asking, setAsking] = useState(false);
  /** 옮길 곳을 고르는 중 */
  const [옮길까, set옮길까] = useState(false);
  const first = pr.slides[0];
  const t = first && pageTypes.find((x) => x.id === first.pageTypeId);
  const ops = t
    ? interpret(t, first.content, { style, assets: pr.assets, adjust: first.adjust, extras: first.extras })
    : [];
  const kind = clientKind(pr.client);

  return (
    <div className="card cardwrap" onClick={asking ? undefined : onClick} role="button">
      {onDelete && (
        asking ? (
          <div className="cardask" onClick={(e) => e.stopPropagation()}>
            <b>지울까요?</b>
            <div className="row">
              <button className="btn sm accent" onClick={() => { onDelete(); setAsking(false); }}>삭제</button>
              <button className="btn sm" onClick={() => setAsking(false)}>취소</button>
            </div>
          </div>
        ) : (
          <button className="carddel" title="삭제"
            onClick={(e) => { e.stopPropagation(); setAsking(true); }}>×</button>
        )
      )}
      {onMove && categories && !asking && (
        옮길까 ? (
          <div className="cardask" onClick={(e) => e.stopPropagation()}>
            <b>어느 분류로 옮길까요?</b>
            <select autoFocus defaultValue={pr.category}
              onChange={(e) => { onMove(e.target.value); set옮길까(false); }}>
              <분류옵션 categories={categories} />
            </select>
            <div className="row" style={{ marginTop: 7 }}>
              <button className="btn sm" onClick={() => set옮길까(false)}>취소</button>
            </div>
          </div>
        ) : (
          <button className="cardmove" title="다른 분류로 옮기기"
            onClick={(e) => { e.stopPropagation(); set옮길까(true); }}>⇄</button>
        )
      )}
      <div className="thumb">
        {ops.length
          ? <SlideView ops={ops} style={style} zoom={0.26} />
          : <span className="empty">{pr.slides.length ? "표지 없음" : "아직 비어 있음"}</span>}
      </div>
      <div className="meta">
        <b>{pr.title}</b>
        <small>
          {어디 && <b className="어디">{어디}</b>}
          {pr.client || "고객사 없음"}
          {kind !== "미분류" && ` · ${kind}`} · {pr.slides.length}장
        </small>
        <div className="chips">
          {moods.slice(0, 3).map((m) => <span className="chip" key={m}>{m}</span>)}
        </div>
        {/* 날짜는 카드마다 같은 자리(바닥)에 둔다. 그래야 눈으로 훑어진다. */}
        <div className="whenrow">
          {/* 딱지를 눌러 상태를 바꾼다 */}
          <button
            className={`statustag ${pr.status === "완료" ? "done" : "doing"}`}
            title={pr.status === "완료" ? "눌러서 다시 진행 중으로" : "눌러서 완료로 표시"}
            onClick={(e) => { e.stopPropagation(); onToggleStatus?.(); }}
          >
            {pr.status}
          </button>
          {pr.status === "완료"
            ? when(pr.completedAt ?? pr.updatedAt)
            : `${when(pr.updatedAt)} 고침`}
        </div>
      </div>
    </div>
  );
}
