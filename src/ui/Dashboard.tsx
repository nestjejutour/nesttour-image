import { useMemo, useState } from "react";
import type { Category, PageType, Project, StylePreset } from "../core/types";
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
  onDelete: (id: string) => void;
  onAddCategory: (name: string, kind: Category["kind"]) => void;
  onRenameCategory: (id: string, name: string) => void;
  onDeleteCategory: (id: string) => void;
}

const PER_ROW = 5;

export function Dashboard(p: Props) {
  const { projects, categories, style, pageTypes } = p;
  const [sel, setSel] = useState<string>("all");
  const [mood, setMood] = useState<Mood | null>(null);
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"고침" | "만듦" | "완료" | "이름">("고침");
  const [period, setPeriod] = useState<"전체" | "오늘" | "이번 주" | "이번 달">("전체");
  const [onlyDone, setOnlyDone] = useState<"전체" | "진행 중" | "완료">("전체");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<Category["kind"]>("우리 결과물");
  const [editId, setEditId] = useState<string | null>(null);

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

  const inCat = (id: string) => sorted(projects.filter((x) => x.category === id && match(x)));
  const filtered = projects.filter(match);
  // 최근에 손댄 것부터. 너무 많으면 고르기가 더 어렵다.
  const inProgress = projects
    .filter((x) => x.status === "진행 중")
    .slice()
    .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1))
    .slice(0, 3);

  const cats = [...categories].sort((a, b) => a.order - b.order);
  const shown = sel === "all" ? cats.filter((c) => inCat(c.id).length > 0) : cats.filter((c) => c.id === sel);
  const expanded = sel !== "all" || !!mood || !!q.trim();

  return (
    <div className="dash">
      {/* ── 왼쪽: 분류 ── */}
      <div className="dash-nav">
        <p className="sec" style={{ marginTop: 0 }}>분류</p>
        <button className={`navitem ${sel === "all" ? "on" : ""}`} onClick={() => setSel("all")}>
          전체 <span>{filtered.length}</span>
        </button>
        {cats.map((c) => (
          <div key={c.id}>
            {editId === c.id ? (
              <div className="catedit">
                <input
                  autoFocus
                  defaultValue={c.name}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      p.onRenameCategory(c.id, (e.target as HTMLInputElement).value);
                      setEditId(null);
                    }
                    if (e.key === "Escape") setEditId(null);
                  }}
                />
                <div className="row" style={{ marginTop: 6 }}>
                  {!c.builtIn && inCat(c.id).length === 0 && (
                    <button className="btn sm" onClick={() => { p.onDeleteCategory(c.id); setEditId(null); }}>
                      삭제
                    </button>
                  )}
                  <button className="btn sm" onClick={() => setEditId(null)}>닫기</button>
                </div>
              </div>
            ) : (
              <button
                className={`navitem ${sel === c.id ? "on" : ""}`}
                onClick={() => setSel(c.id)}
                onDoubleClick={() => setEditId(c.id)}
                title="두 번 누르면 이름을 고칩니다"
              >
                {c.name}
                {c.kind === "참고 자료" && <em>참고</em>}
                <span>{inCat(c.id).length}</span>
              </button>
            )}
          </div>
        ))}

        {adding ? (
          <div className="catedit">
            <input
              autoFocus
              placeholder="새 분류 이름"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  p.onAddCategory(newName.trim(), newKind);
                  setNewName(""); setAdding(false);
                }
                if (e.key === "Escape") setAdding(false);
              }}
            />
            <select value={newKind} onChange={(e) => setNewKind(e.target.value as Category["kind"])}>
              <option value="우리 결과물">우리 결과물 — 뼈대로 쓸 수 있음</option>
              <option value="참고 자료">참고 자료 — 받은 것 중 좋은 것</option>
            </select>
            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn sm primary" disabled={!newName.trim()}
                onClick={() => { p.onAddCategory(newName.trim(), newKind); setNewName(""); setAdding(false); }}>
                추가
              </button>
              <button className="btn sm" onClick={() => setAdding(false)}>취소</button>
            </div>
          </div>
        ) : (
          <button className="navitem add" onClick={() => setAdding(true)}>+ 분류 추가</button>
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
              지난 완성본에서 출발하는 게 가장 빠릅니다. 훑다가 마음에 드는 장을 오른쪽에 담으세요.
            </p>
          </div>
          <div className="spacer" />
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
                  onDelete={() => p.onDelete(pr.id)} />
              ))}
            </div>
          </>
        )}

        {shown.length === 0 && (
          <div className="empty-state">
            <p style={{ fontSize: 18, color: "var(--ink)", marginTop: 0 }}>여기엔 아직 자료가 없습니다</p>
            <p style={{ fontSize: 15.5 }}>완성본을 올리거나 새 제안서를 만들면 여기 쌓입니다.</p>
          </div>
        )}

        {shown.map((c) => {
          const list = inCat(c.id);
          if (!list.length) return null;
          const visible = expanded ? list : list.slice(0, PER_ROW);
          return (
            <section key={c.id}>
              <div className="rowhead">
                <p className="sec" style={{ margin: 0 }}>
                  {c.name}
                  {c.kind === "참고 자료" && <em className="refmark">참고 자료</em>}
                </p>
                <span className="cnt">{list.length}건</span>
                {!expanded && list.length > PER_ROW && (
                  <button className="btn sm" onClick={() => setSel(c.id)}>
                    + 전체 보기 ({list.length})
                  </button>
                )}
              </div>
              <div className={expanded ? "cards" : "strip"}>
                {visible.map((pr) => (
                  <Card key={pr.id} pr={pr} {...{ style, pageTypes }}
                    moods={moodsFor.get(pr.id) ?? []} onClick={() => p.onBrowse(pr.id)}
                    onDelete={() => p.onDelete(pr.id)} />
                ))}
              </div>
            </section>
          );
        })}
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
  pr, style, pageTypes, moods, onClick, onDelete,
}: {
  pr: Project; style: StylePreset; pageTypes: PageType[];
  moods: Mood[]; onClick: () => void; onDelete?: () => void;
}) {
  const [asking, setAsking] = useState(false);
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
              <button className="btn sm accent" onClick={() => { onDelete(); setAsking(false); }}>지움</button>
              <button className="btn sm" onClick={() => setAsking(false)}>취소</button>
            </div>
          </div>
        ) : (
          <button className="carddel" title="지우기"
            onClick={(e) => { e.stopPropagation(); setAsking(true); }}>×</button>
        )
      )}
      <div className="thumb">
        {ops.length ? <SlideView ops={ops} style={style} zoom={0.26} /> : <span className="empty">표지 없음</span>}
      </div>
      <div className="meta">
        <b>{pr.title}</b>
        <small>
          {pr.client || "고객사 없음"}
          {kind !== "미분류" && ` · ${kind}`} · {pr.slides.length}장
        </small>
        <div className="chips">
          {moods.slice(0, 3).map((m) => <span className="chip" key={m}>{m}</span>)}
        </div>
        {/* 날짜는 카드마다 같은 자리(바닥)에 둔다. 그래야 눈으로 훑어진다. */}
        <div className="whenrow">
          {pr.status === "완료" ? (
            <><b className="done">완료</b> {when(pr.completedAt ?? pr.updatedAt)}</>
          ) : (
            <><b className="doing">진행 중</b> {when(pr.updatedAt)} 고침</>
          )}
        </div>
      </div>
    </div>
  );
}
