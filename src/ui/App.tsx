import { useEffect, useMemo, useState } from "react";
import { load, save, uid, type DB } from "../store/db";
import type { Content, HistoryEntry, Project, Rule } from "../core/types";
import { buildBrain } from "../ai/brain";
import { interpret } from "../core/interpret";
import { SlideView } from "../render/html";
import { Editor } from "./Editor";
import { NewProject } from "./NewProject";

type View = "보관함" | "규칙" | "스타일";

export function App() {
  const [db, setDb] = useState<DB>(() => load());
  const [view, setView] = useState<View>("보관함");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => { save(db); }, [db]);

  const style = db.styles[0];
  const project = db.projects.find((p) => p.id === openId) ?? null;

  const putProject = (apply: (p: Project) => Project) =>
    setDb((d) => ({
      ...d,
      projects: d.projects.map((x) => (x.id === openId ? apply(x) : x)),
    }));

  const create = () => setCreating(true);

  /** 공장에 쌓인 것(스타일·규칙·페이지타입·지난 제안서)을 전부 녹여 AI 지시문을 만든다 */
  const brain = useMemo(
    () =>
      buildBrain({
        style,
        rules: db.rules,
        pageTypes: db.pageTypes,
        pastProjects: db.projects.filter((p) => p.id !== openId),
      }),
    [style, db.rules, db.pageTypes, db.projects, openId],
  );

  const saveRule = (text: string) =>
    setDb((d) => ({
      ...d,
      rules: [
        ...d.rules,
        {
          id: uid(), styleId: style.id, text, source: "대표지시" as const,
          sourceProjectId: openId ?? undefined, enabled: true,
          createdAt: new Date().toISOString(),
        },
      ],
    }));

  const addHistory = (e: { slideIndex: number; instruction: string; before: Content; after: Content }) =>
    setDb((d) => ({
      ...d,
      history: [
        ...d.history,
        { id: uid(), projectId: openId ?? "", ...e, createdAt: new Date().toISOString() } as HistoryEntry,
      ],
    }));

  if (creating) {
    return (
      <div className="app">
        <Header view={view} setView={setView} onNew={create} inEditor />
        <NewProject
          style={style}
          rules={db.rules}
          pageTypes={db.pageTypes}
          pastProjects={db.projects}
          onCancel={() => setCreating(false)}
          onDone={(p) => {
            setDb((d) => ({ ...d, projects: [p, ...d.projects] }));
            setCreating(false);
            setOpenId(p.id);
          }}
        />
      </div>
    );
  }

  if (project) {
    return (
      <div className="app">
        <Header view={view} setView={setView} onNew={create} inEditor />
        <Editor
          project={project}
          style={style}
          pageTypes={db.pageTypes}
          onChange={putProject}
          onBack={() => setOpenId(null)}
          aiSystem={brain.system}
          onSaveRule={saveRule}
          onHistory={addHistory}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <Header view={view} setView={setView} onNew={create} />
      {view === "보관함" && (
        <Library db={db} setDb={setDb} onOpen={setOpenId} onNew={create} />
      )}
      {view === "규칙" && <Rules db={db} setDb={setDb} />}
      {view === "스타일" && <StyleView db={db} />}
    </div>
  );
}

/* ───────────────────────── 머리띠 ───────────────────────── */

function Header({
  view, setView, onNew, inEditor,
}: { view: View; setView: (v: View) => void; onNew: () => void; inEditor?: boolean }) {
  return (
    <div className="topbar">
      <div className="brand">MTMB <span>디자인 스튜디오</span></div>
      {!inEditor && (
        <div className="tabs">
          {(["보관함", "규칙", "스타일"] as View[]).map((v) => (
            <button key={v} className={`tab ${view === v ? "on" : ""}`} onClick={() => setView(v)}>
              {v}
            </button>
          ))}
        </div>
      )}
      <div className="spacer" />
      {!inEditor && <button className="btn primary" onClick={onNew}>+ 새 제안서</button>}
    </div>
  );
}

/* ───────────────────────── 보관함 ───────────────────────── */

function Library({
  db, setDb, onOpen, onNew,
}: { db: DB; setDb: (f: (d: DB) => DB) => void; onOpen: (id: string) => void; onNew: () => void }) {
  const [q, setQ] = useState("");
  const style = db.styles[0];

  const list = db.projects.filter((p) => {
    const t = `${p.title} ${p.client} ${p.tags.join(" ")}`.toLowerCase();
    return t.includes(q.toLowerCase());
  });

  return (
    <div className="page">
      <h1>보관함</h1>
      <p className="lede">
        만든 제안서가 여기 쌓입니다. 쌓인 제안서는 다음 제안서를 만들 때 AI 가 참고하는 사례가 됩니다.
      </p>

      {db.projects.length > 0 && (
        <div className="row" style={{ marginBottom: 18, maxWidth: 420 }}>
          <input
            className="grow"
            placeholder="이름 · 고객사 · 태그로 찾기"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ border: "1px solid var(--line)", borderRadius: 7, padding: "8px 11px" }}
          />
        </div>
      )}

      {db.projects.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: 15, color: "var(--ink)", marginTop: 0 }}>아직 만든 제안서가 없습니다</p>
          <p style={{ fontSize: 13 }}>
            “+ 새 제안서”를 누르면 핫플트립 미니멀 스타일로 바로 시작합니다.
          </p>
          <button className="btn primary" onClick={onNew}>+ 새 제안서 만들기</button>
        </div>
      ) : (
        <div className="cards">
          {list.map((p) => {
            const first = p.slides[0];
            const t = first && db.pageTypes.find((x) => x.id === first.pageTypeId);
            const ops = t ? interpret(t, first.content, { style, assets: p.assets }) : [];
            return (
              <button className="card" key={p.id} onClick={() => onOpen(p.id)}>
                <div className="thumb">
                  {ops.length ? (
                    <SlideView ops={ops} style={style} zoom={0.26} />
                  ) : (
                    <span className="empty">표지 없음</span>
                  )}
                </div>
                <div className="meta">
                  <b>{p.title}</b>
                  <small>
                    {p.client || "고객사 미입력"} · {p.category} · {p.slides.length}장
                    {" · "}
                    <span style={{ color: p.status === "완료" ? "var(--muted)" : "var(--accent)" }}>
                      {p.status}
                    </span>
                  </small>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── 규칙 창고 ───────────────────────── */

function Rules({ db, setDb }: { db: DB; setDb: (f: (d: DB) => DB) => void }) {
  const [draft, setDraft] = useState("");

  const toggle = (id: string) =>
    setDb((d) => ({
      ...d,
      rules: d.rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    }));

  const add = () => {
    if (!draft.trim()) return;
    const r: Rule = {
      id: uid(),
      styleId: db.styles[0].id,
      text: draft.trim(),
      source: "직접입력",
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    setDb((d) => ({ ...d, rules: [...d.rules, r] }));
    setDraft("");
  };

  const on = db.rules.filter((r) => r.enabled).length;

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <h1>규칙</h1>
      <p className="lede">
        “앞으로도 이렇게 해라”를 모아 두는 곳입니다. 켜 둔 규칙 {on}개는 AI 가 페이지를 만들거나
        고칠 때마다 전부 읽습니다. 쓰다가 생기는 취향을 여기에 쌓으면 결과가 점점 좋아집니다.
      </p>

      <div className="row" style={{ marginBottom: 20 }}>
        <input
          className="grow"
          placeholder="예: 숫자는 천 단위 쉼표를 꼭 넣는다"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          style={{ border: "1px solid var(--line)", borderRadius: 7, padding: "8px 11px" }}
        />
        <button className="btn primary" onClick={add}>규칙 추가</button>
      </div>

      {db.rules.map((r) => (
        <div className={`rule ${r.enabled ? "" : "off"}`} key={r.id}>
          <input type="checkbox" checked={r.enabled} onChange={() => toggle(r.id)} />
          <div className="txt">{r.text}</div>
          <span className="tag">{r.source}</span>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── 스타일 보기 ───────────────────────── */

function StyleView({ db }: { db: DB }) {
  const s = db.styles[0];
  const colorNames: Record<string, string> = {
    ink: "본문 글자", muted: "흐린 글자", line: "얇은 선", lineStrong: "진한 선",
    background: "바탕", accent: "강조 (코랄)", white: "흰색", todo: "빈칸 표시",
  };
  const typeNames: Record<string, string> = {
    coverTitleBold: "표지 제목 (굵게)", coverTitleThin: "표지 제목 (얇게)",
    pageTitle: "페이지 제목", subtitle: "부제", body: "본문", caption: "작은 설명",
    keyNumber: "핵심 숫자", keyNumberBig: "큰 숫자", sectionNo: "구분 장 번호",
    keyword: "핵심 단어", rowLabel: "항목명", cardNo: "카드 번호",
    cardTitle: "카드 제목", overlay: "사진 위 글씨",
  };

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <h1>{s.name}</h1>
      <p className="lede">
        모든 페이지가 이 값을 가져다 씁니다. 여기 숫자를 바꾸면 만든 제안서 전체가 한 번에 바뀝니다.
        페이지 쪽에서 색이나 크기를 직접 쓰는 일은 없습니다.
      </p>

      <p className="sec">판 크기</p>
      <table className="spec">
        <tbody>
          <tr><td>비율</td><td>16:9 · {s.slide.widthIn} × {s.slide.heightIn} 인치</td></tr>
          <tr><td>글꼴</td><td>{s.font.family} (없으면 {s.font.fallback[0]})</td></tr>
          <tr><td>얇은 선 두께</td><td>{s.hairline}pt</td></tr>
        </tbody>
      </table>

      <p className="sec">색</p>
      <table className="spec">
        <tbody>
          {Object.entries(s.color).map(([k, v]) => (
            <tr key={k}>
              <td>{colorNames[k] ?? k}</td>
              <td><span className="swatch" style={{ background: v }} />{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="sec">글자 크기</p>
      <table className="spec">
        <tbody>
          {Object.entries(s.type).map(([k, v]) => (
            <tr key={k}>
              <td>{typeNames[k] ?? k}</td>
              <td>{v.size}pt {v.bold ? "· 굵게" : ""} {v.color ? `· ${colorNames[v.color] ?? v.color}` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="sec">페이지 타입 {db.pageTypes.length}종</p>
      <table className="spec">
        <tbody>
          {db.pageTypes.map((t) => (
            <tr key={t.id}><td>{t.name}</td><td>{t.description}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
