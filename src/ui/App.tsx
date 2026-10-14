import { useEffect, useMemo, useState } from "react";
import { load, newProject, save, uid, type DB } from "../store/db";
import type { Category, Content, HistoryEntry, Project, Rule, Slide } from "../core/types";
import { buildBrain } from "../ai/brain";
import { Editor } from "./Editor";
import { NewProject } from "./NewProject";
import { Dashboard } from "./Dashboard";
import { Browse } from "./Browse";
import { Tray, type TrayItem } from "./Tray";
import { Rules } from "./Rules";
import { StyleView } from "./StyleView";

type View = "진열대" | "규칙" | "스타일";

export function App() {
  const [db, setDb] = useState<DB>(() => load());
  const [view, setView] = useState<View>("진열대");
  const [openId, setOpenId] = useState<string | null>(null);
  const [browseId, setBrowseId] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [tray, setTray] = useState<TrayItem[]>([]);

  useEffect(() => { save(db); }, [db]);

  const style = db.styles[0];
  const project = db.projects.find((p) => p.id === openId) ?? null;
  const browsing = db.projects.find((p) => p.id === browseId) ?? null;

  /* ── 공장에 쌓인 걸 전부 녹여 AI 지시문을 만든다 ── */
  const brain = useMemo(
    () => buildBrain({
      style, rules: db.rules, pageTypes: db.pageTypes,
      pastProjects: db.projects.filter((p) => p.id !== openId),
    }),
    [style, db.rules, db.pageTypes, db.projects, openId],
  );

  /* ── 창고에 쓰기 ── */
  const putProject = (apply: (p: Project) => Project) =>
    setDb((d) => ({ ...d, projects: d.projects.map((x) => (x.id === openId ? apply(x) : x)) }));

  const addProject = (p: Project) => {
    setDb((d) => ({ ...d, projects: [p, ...d.projects] }));
    setCreating(null); setBrowseId(null); setOpenId(p.id);
  };

  const saveRule = (text: string) =>
    setDb((d) => ({
      ...d,
      rules: [...d.rules, {
        id: uid(), styleId: style.id, text, source: "대표지시" as const,
        sourceProjectId: openId ?? undefined, enabled: true,
        createdAt: new Date().toISOString(),
      }],
    }));

  const addHistory = (e: { slideIndex: number; instruction: string; before: Content; after: Content }) =>
    setDb((d) => ({
      ...d,
      history: [...d.history,
        { id: uid(), projectId: openId ?? "", ...e, createdAt: new Date().toISOString() } as HistoryEntry],
    }));

  /**
   * 전체 규격 바꾸기. "type.pageTitle.size" 같은 길로 찾아 들어가 바꾼다.
   * 모든 제안서에 영향을 주므로, 대표님이 [적용] 을 누른 뒤에만 불린다.
   */
  const changeStyle = (path: string, value: number | string) =>
    setDb((d) => {
      const parts = path.split(".");
      const next = structuredClone(d.styles[0]) as any;
      let node = next;
      for (let i = 0; i < parts.length - 1; i++) {
        if (node[parts[i]] === undefined) return d; // 없는 길이면 아무것도 안 한다
        node = node[parts[i]];
      }
      const leaf = parts[parts.length - 1];
      if (node[leaf] === undefined) return d;
      node[leaf] = value;
      next.version = (next.version ?? 1) + 1;
      next.updatedAt = new Date().toISOString().slice(0, 10);
      return { ...d, styles: [next, ...d.styles.slice(1)] };
    });

  /* ── 분류(메뉴) 늘리고 고치기 ── */
  const addCategory = (name: string, kind: Category["kind"]) =>
    setDb((d) => ({
      ...d,
      categories: [...d.categories, {
        id: uid(), name, kind,
        order: Math.max(0, ...d.categories.map((c) => c.order)) + 1,
      }],
    }));

  const renameCategory = (id: string, name: string) =>
    setDb((d) => ({
      ...d,
      categories: d.categories.map((c) => (c.id === id && name.trim() ? { ...c, name: name.trim() } : c)),
    }));

  const deleteCategory = (id: string) =>
    setDb((d) => ({ ...d, categories: d.categories.filter((c) => c.id !== id) }));

  /* ── 담은 선반 ── */
  const takePage = (s: Slide, from: Project) =>
    setTray((t) => [...t, {
      key: uid(), slide: s, fromTitle: from.title, fromAssets: from.assets,
    }]);

  const moveTray = (key: string, d: -1 | 1) =>
    setTray((t) => {
      const i = t.findIndex((x) => x.key === key);
      const j = i + d;
      if (i < 0 || j < 0 || j >= t.length) return t;
      const n = [...t];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  /** 담은 장들로 한 벌을 만든다. 출처가 섞여도 지금 스타일로 다시 그려진다. */
  const makeFromTray = () => {
    if (!tray.length) return;
    const assets: Record<string, string> = {};
    for (const it of tray) Object.assign(assets, it.fromAssets);
    const p: Project = {
      ...newProject("담아서 만든 제안서", ""),
      slides: tray.map((it) => ({ ...it.slide, id: uid() })),
      assets,
    };
    setTray([]);
    addProject(p);
  };

  /** 지난 제안서를 뼈대로 새로 시작 */
  const useAsBase = (src: Project, keepText: boolean) => {
    const p: Project = {
      ...newProject(`${src.title} (복사본)`, src.client, src.category),
      slides: src.slides.map((s) => ({
        ...s, id: uid(), content: keepText ? structuredClone(s.content) : {},
      })),
      assets: keepText ? { ...src.assets } : {},
    };
    addProject(p);
  };

  /* ── 화면 고르기 ── */

  if (creating !== null) {
    return (
      <Shell view={view} setView={setView} onNew={() => setCreating("proposal")} bare>
        <NewProject
          style={style} rules={db.rules} pageTypes={db.pageTypes}
          pastProjects={db.projects}
          onCancel={() => setCreating(null)}
          onDone={(p) => addProject({ ...p, category: creating })}
        />
      </Shell>
    );
  }

  if (project) {
    return (
      <Shell view={view} setView={setView} onNew={() => setCreating("proposal")} bare>
        <Editor
          project={project} style={style} pageTypes={db.pageTypes}
          onChange={putProject} onBack={() => setOpenId(null)}
          aiSystem={brain.system} onSaveRule={saveRule} onHistory={addHistory}
          onStyleChange={changeStyle}
        />
      </Shell>
    );
  }

  if (browsing) {
    return (
      <Shell view={view} setView={setView} onNew={() => setCreating("proposal")} bare>
        <div className="withtray">
          <Browse
            project={browsing} style={style} pageTypes={db.pageTypes}
            onClose={() => setBrowseId(null)}
            onUseAsBase={useAsBase}
            onTakePage={(s) => takePage(s, browsing)}
            takenCount={tray.length}
            onOpen={(id) => { setBrowseId(null); setOpenId(id); }}
            categoryName={db.categories.find((c) => c.id === browsing.category)?.name ?? "미분류"}
          />
          <Tray items={tray} style={style} pageTypes={db.pageTypes}
            onRemove={(k) => setTray((t) => t.filter((x) => x.key !== k))}
            onMove={moveTray} onClear={() => setTray([])} onMake={makeFromTray} />
        </div>
      </Shell>
    );
  }

  return (
    <Shell view={view} setView={setView} onNew={() => setCreating("proposal")}>
      {view === "진열대" && (
        <div className="withtray">
          <Dashboard
            projects={db.projects} categories={db.categories}
            style={style} pageTypes={db.pageTypes} ruleCount={db.rules.filter((r) => r.enabled).length}
            onBrowse={setBrowseId} onOpen={setOpenId} onNew={(cat) => setCreating(cat)}
            onAddCategory={addCategory} onRenameCategory={renameCategory} onDeleteCategory={deleteCategory}
          />
          <Tray items={tray} style={style} pageTypes={db.pageTypes}
            onRemove={(k) => setTray((t) => t.filter((x) => x.key !== k))}
            onMove={moveTray} onClear={() => setTray([])} onMake={makeFromTray} />
        </div>
      )}
      {view === "규칙" && <Rules db={db} setDb={setDb} />}
      {view === "스타일" && <StyleView db={db} />}
    </Shell>
  );
}

function Shell({
  view, setView, onNew, bare, children,
}: {
  view: View; setView: (v: View) => void; onNew: () => void;
  bare?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">MTMB <span>디자인 스튜디오</span></div>
        {!bare && (
          <div className="tabs">
            {(["진열대", "규칙", "스타일"] as View[]).map((v) => (
              <button key={v} className={`tab ${view === v ? "on" : ""}`} onClick={() => setView(v)}>{v}</button>
            ))}
          </div>
        )}
        <div className="spacer" />
        {!bare && <button className="btn primary" onClick={onNew}>+ 새 제안서</button>}
      </div>
      {children}
    </div>
  );
}
