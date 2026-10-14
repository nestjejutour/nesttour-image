import { useEffect, useMemo, useState } from "react";
import { load, newProject, save, uid, type ChatTurn, type DB } from "../store/db";
import type { Category, Content, HistoryEntry, Project, RuleScope, Slide } from "../core/types";
import { overrideWith, rulesFor, styleFor } from "../core/scope";
import { buildBrain } from "../ai/brain";
import { Editor } from "./Editor";
import { NewProject } from "./NewProject";
import { Dashboard } from "./Dashboard";
import { Browse } from "./Browse";
import { Tray, type TrayItem } from "./Tray";
import { Rules } from "./Rules";
import { Log } from "./Log";
import { StyleView } from "./StyleView";

type View = "보관함" | "규칙" | "스타일" | "기록";

export function App() {
  const [db, setDb] = useState<DB>(() => load());
  const [view, setView] = useState<View>("보관함");
  const [openId, setOpenId] = useState<string | null>(null);
  const [browseId, setBrowseId] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [tray, setTray] = useState<TrayItem[]>([]);

  useEffect(() => { save(db); }, [db]);

  const baseStyle = db.styles[0];
  /** 이 제안서에 실제로 적용되는 규격 (기본 + 이 건만 바꾼 값) */
  const styleOf = (p: Project | null) => styleFor(baseStyle, p?.styleOverride);
  const style = baseStyle;
  const project = db.projects.find((p) => p.id === openId) ?? null;
  const browsing = db.projects.find((p) => p.id === browseId) ?? null;

  /* ── 공장에 쌓인 걸 전부 녹여 AI 지시문을 만든다 ── */
  const brain = useMemo(
    () => buildBrain({
      style: styleOf(project),
      // 지금 이 건에 해당하는 규칙만 넘긴다. 200개가 쌓여도 읽는 건 일부다.
      rules: rulesFor(db.rules, {
        styleId: baseStyle.id,
        categoryId: project?.category ?? "proposal",
        projectId: openId,
      }),
      pageTypes: db.pageTypes,
      pastProjects: db.projects.filter((p) => p.id !== openId),
      history: db.history,
      currentProjectId: openId,
    }),
    [baseStyle, project, db.rules, db.pageTypes, db.projects, db.history, openId],
  );

  /* ── 창고에 쓰기 ── */
  const putProject = (apply: (p: Project) => Project) =>
    setDb((d) => ({ ...d, projects: d.projects.map((x) => (x.id === openId ? apply(x) : x)) }));

  const addProject = (p: Project) => {
    setDb((d) => ({ ...d, projects: [p, ...d.projects] }));
    setCreating(null); setBrowseId(null); setOpenId(p.id);
  };

  const saveRule = (text: string, scope: RuleScope = "스타일") => {
    const scopeId =
      scope === "공통" ? undefined
      : scope === "스타일" ? baseStyle.id
      : scope === "분류" ? (project?.category ?? "proposal")
      : (openId ?? undefined);
    setDb((d) => ({
      ...d,
      rules: [...d.rules, {
        id: uid(), text, scope, scopeId, source: "대표지시" as const,
        sourceProjectId: openId ?? undefined, enabled: true,
        createdAt: new Date().toISOString(),
      }],
    }));
  };

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
  const changeStyle = (path: string, value: number | string, scope: "제안서" | "스타일" = "제안서") => {
    // ① 이 제안서만 — 다른 건에 번지지 않는다
    if (scope === "제안서") {
      putProject((p) => ({ ...p, styleOverride: overrideWith(p.styleOverride, path, value) }));
      return;
    }
    // ② 이 브랜드 규격 전체
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
  };

  /* ── 대화 창고 ── */
  const chatKey = (slideId: string) => `${openId}:${slideId}`;
  const turnsOf = (slideId: string): ChatTurn[] => db.chats[chatKey(slideId)] ?? [];
  const onTurns = (slideId: string, apply: (t: ChatTurn[]) => ChatTurn[]) =>
    setDb((d) => {
      const k = `${openId}:${slideId}`;
      return { ...d, chats: { ...d.chats, [k]: apply(d.chats[k] ?? []) } };
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
          project={project} style={styleOf(project)} pageTypes={db.pageTypes}
          categories={db.categories}
          onChange={putProject} onBack={() => setOpenId(null)}
          aiSystem={brain.system} onSaveRule={saveRule} onHistory={addHistory}
          onStyleChange={changeStyle}
          turnsOf={turnsOf} onTurns={onTurns}
        />
      </Shell>
    );
  }

  if (browsing) {
    return (
      <Shell view={view} setView={setView} onNew={() => setCreating("proposal")} bare>
        <div className="withtray">
          <Browse
            project={browsing} style={styleOf(browsing)} pageTypes={db.pageTypes}
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
      {view === "보관함" && (
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
      {view === "기록" && <Log db={db} setDb={setDb} />}
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
            {(["보관함", "규칙", "스타일", "기록"] as View[]).map((v) => (
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
