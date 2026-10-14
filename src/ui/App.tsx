import { useEffect, useMemo, useRef, useState } from "react";
import { localBackend, merge, newProject, uid, type ChatTurn, type DB } from "../store/db";
import type { Backend } from "../store/backend";
import { firebaseBackend, firebaseReady, logout, watchUser } from "../store/firebase";
import { Gate } from "./Gate";
import type { Category, Content, HistoryEntry, Project, RuleScope, Slide } from "../core/types";
import { overrideWith, rulesFor, styleFor } from "../core/scope";
import { buildBrain } from "../ai/brain";
import { Editor } from "./Editor";
import { NewProject } from "./NewProject";
import { Dashboard } from "./Dashboard";
import { Browse } from "./Browse";
import { Tray, type TrayItem } from "./Tray";
import { Log } from "./Log";
import { Store } from "./Store";

type View = "보관함" | "기록" | "창고";

/** 어디에 저장할지는 설정값이 정한다. 화면 쪽은 몰라도 된다. */
const backend: Backend = firebaseReady ? firebaseBackend() : localBackend();

/**
 * 사진을 파일 저장소로 올리고, 자료에는 주소만 남긴다.
 * 올릴 게 없으면 null 을 돌려준다.
 */
async function liftAssets(d: DB): Promise<DB | null> {
  if (!backend.putFile) return null;
  let any = false;

  const projects = await Promise.all(
    d.projects.map(async (p) => {
      const pairs = Object.entries(p.assets);
      if (!pairs.some(([, v]) => v.startsWith("data:"))) return p;
      const next: Record<string, string> = {};
      for (const [k, v] of pairs) {
        if (!v.startsWith("data:")) { next[k] = v; continue; }
        try {
          next[k] = await backend.putFile!(`${p.id}/${k}`, v);
          any = true;
        } catch {
          next[k] = v; // 올리기 실패하면 그대로 둔다
        }
      }
      return { ...p, assets: next };
    }),
  );

  return any ? { ...d, projects } : null;
}

export function App() {
  const [db, setDb] = useState<DB | null>(null);
  const [user, setUser] = useState<{ uid: string; email?: string | null } | null>(null);
  const [ready, setReady] = useState(!backend.needsLogin);
  const lastSaved = useRef("");
  // 로그인 지켜보기 (회사 서버일 때만)
  useEffect(() => {
    if (!backend.needsLogin) return;
    return watchUser((u) => {
      setUser(u ? { uid: u.uid, email: u.email } : null);
      setReady(true);
    });
  }, []);

  // 자료 불러오기
  useEffect(() => {
    if (backend.needsLogin && !user) { setDb(null); return; }
    let alive = true;
    backend.load().then((saved) => {
      if (!alive) return;
      const merged = merge(saved);
      lastSaved.current = JSON.stringify(merged);
      setDb(merged);
    }).catch(() => { if (alive) setDb(merge({})); });
    return () => { alive = false; };
  }, [user]);

  // 자료 저장 (바뀐 게 있을 때만)
  useEffect(() => {
    if (!db) return;
    const json = JSON.stringify(db);
    if (json === lastSaved.current) return;
    lastSaved.current = json;
    const t = setTimeout(async () => {
      // 사진은 따로 올린다. Firestore 는 문서 하나가 1MB 한도라 사진을 못 담는다.
      const lifted = await liftAssets(db);
      if (lifted) { setDb(lifted); return; }   // 주소로 바뀐 상태로 다시 저장된다
      await backend.save(db).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [db]);

  if (!ready) return <Gate loading />;
  if (backend.needsLogin && !user) return <Gate />;
  if (!db) return <Gate loading />;

  return <Studio db={db} setDb={setDb} who={user?.email ?? null} />;
}

/**
 * 본체.
 *
 * 부팅(로그인·불러오기)과 떼어 놓는다.
 * 한 함수 안에서 화면을 중간에 갈아끼우면 React 가 상태 장치 순서를 잃는다.
 */
function Studio({
  db, setDb, who,
}: {
  db: DB;
  setDb: React.Dispatch<React.SetStateAction<DB | null>>;
  who: string | null;
}) {
  const [view, setView] = useState<View>("보관함");
  const [openId, setOpenId] = useState<string | null>(null);
  const [browseId, setBrowseId] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [tray, setTray] = useState<TrayItem[]>([]);

  /** db 가 비어 있을 때 들어오는 갱신은 무시한다 */
  const update = (apply: (d: DB) => DB) => setDb((d) => (d ? apply(d) : d));

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
    update((d) => ({ ...d, projects: d.projects.map((x) => (x.id === openId ? apply(x) : x)) }));

  const addProject = (p: Project) => {
    update((d) => ({ ...d, projects: [p, ...d.projects] }));
    setCreating(null); setBrowseId(null); setOpenId(p.id);
  };

  const saveRule = (text: string, scope: RuleScope = "스타일") => {
    const scopeId =
      scope === "공통" ? undefined
      : scope === "스타일" ? baseStyle.id
      : scope === "분류" ? (project?.category ?? "proposal")
      : (openId ?? undefined);
    update((d) => ({
      ...d,
      rules: [...d.rules, {
        id: uid(), text, scope, scopeId, source: "대표지시" as const,
        sourceProjectId: openId ?? undefined, enabled: true,
        createdAt: new Date().toISOString(),
      }],
    }));
  };

  const addHistory = (e: { slideIndex: number; instruction: string; before: Content; after: Content }) =>
    update((d) => ({
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
    update((d) => {
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
    update((d) => {
      const k = `${openId}:${slideId}`;
      return { ...d, chats: { ...d.chats, [k]: apply(d.chats[k] ?? []) } };
    });

  /* ── 분류(메뉴) 늘리고 고치기 ── */
  const addCategory = (name: string, kind: Category["kind"]) =>
    update((d) => ({
      ...d,
      categories: [...d.categories, {
        id: uid(), name, kind,
        order: Math.max(0, ...d.categories.map((c) => c.order)) + 1,
      }],
    }));

  const renameCategory = (id: string, name: string) =>
    update((d) => ({
      ...d,
      categories: d.categories.map((c) => (c.id === id && name.trim() ? { ...c, name: name.trim() } : c)),
    }));

  const deleteCategory = (id: string) =>
    update((d) => ({ ...d, categories: d.categories.filter((c) => c.id !== id) }));

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
      <Shell view={view} setView={setView} onNew={() => setCreating("proposal")} bare who={who}>
        <NewProject
          style={baseStyle}
          rules={rulesFor(db.rules, { styleId: baseStyle.id, categoryId: creating, projectId: null })}
          pageTypes={db.pageTypes}
          categories={db.categories}
          defaultCategory={creating}
          pastProjects={db.projects}
          onCancel={() => setCreating(null)}
          onDone={(p) => addProject(p)}
        />
      </Shell>
    );
  }

  if (project) {
    return (
      <Shell view={view} setView={setView} onNew={() => setCreating("proposal")} bare who={who}>
        <Editor
          project={project} style={styleOf(project)} pageTypes={db.pageTypes}
          categories={db.categories}
          activeRules={rulesFor(db.rules, {
            styleId: baseStyle.id,
            categoryId: project.category,
            projectId: openId,
          })}
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
      <Shell view={view} setView={setView} onNew={() => setCreating("proposal")} bare who={who}>
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
    <Shell view={view} setView={setView} onNew={() => setCreating("proposal")} who={who}>
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
      {view === "기록" && <Log db={db} setDb={update} />}
      {view === "창고" && <Store db={db} setDb={update} />}
    </Shell>
  );
}

function Shell({
  view, setView, onNew, bare, who, children,
}: {
  view: View; setView: (v: View) => void; onNew: () => void;
  bare?: boolean; who?: string | null; children: React.ReactNode;
}) {
  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">MTMB <span>디자인 스튜디오</span></div>
        {!bare && (
          <div className="tabs">
            {(["보관함", "기록", "창고"] as View[]).map((v) => (
              <button key={v} className={`tab ${view === v ? "on" : ""}`} onClick={() => setView(v)}>{v}</button>
            ))}
          </div>
        )}
        <div className="spacer" />
        {who && <small className="who" title={who}>{who}</small>}
        {who && <button className="btn sm" onClick={() => void logout()}>로그아웃</button>}
        {!bare && <button className="btn primary" onClick={onNew}>+ 새 제안서</button>}
      </div>
      {children}
    </div>
  );
}
