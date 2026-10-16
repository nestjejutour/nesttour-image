import { useEffect, useMemo, useRef, useState } from "react";
import { localBackend, merge, newProject, uid, type ChatTurn, type DB } from "../store/db";
import type { Backend } from "../store/backend";
import { firebaseBackend, firebaseReady, logout, watchUser } from "../store/firebase";
import { Gate } from "./Gate";
import type { Category, Content, Doc, Draft, HistoryEntry, Project, RuleScope, Slide } from "../core/types";
import { overrideWith, overridesFrom, rulesFor, styleFor } from "../core/scope";
import { buildBrain } from "../ai/brain";
import { Editor } from "./Editor";
import { NewProject } from "./NewProject";
import { Dashboard } from "./Dashboard";
import { Browse } from "./Browse";
import { Tray, type TrayItem } from "./Tray";
import { ChatDock } from "./ChatDock";
import type { Action } from "../ai/chat";
import { interpret } from "../core/interpret";
import { docsToText } from "../core/docs";
import { Log } from "./Log";
import { Store } from "./Store";
import { useUndo, type Undo } from "./undo";
import { VERSION } from "../version";

type View = "보관함" | "기록" | "창고";

/** 어디에 저장할지는 설정값이 정한다. 화면 쪽은 몰라도 된다. */
const backend: Backend = firebaseReady ? firebaseBackend() : localBackend();

/**
 * 사진과 파일함의 원본을 파일 저장소로 올리고, 자료에는 주소만 남긴다.
 * 올릴 게 없으면 null 을 돌려준다.
 */
async function liftAssets(d: DB): Promise<DB | null> {
  if (!backend.putFile) return null;
  let any = false;

  const projects = await Promise.all(
    d.projects.map(async (p) => {
      let next = p;

      // ① 사진
      const pairs = Object.entries(p.assets);
      if (pairs.some(([, v]) => v.startsWith("data:"))) {
        const assets: Record<string, string> = {};
        for (const [k, v] of pairs) {
          if (!v.startsWith("data:")) { assets[k] = v; continue; }
          try {
            assets[k] = await backend.putFile!(`${p.id}/${k}`, v);
            any = true;
          } catch {
            assets[k] = v; // 올리기 실패하면 그대로 둔다
          }
        }
        next = { ...next, assets };
      }

      // ② 파일함에 넣어 둔 원본 — 문서 한 칸에 담기엔 너무 크다
      if (next.docs?.some((x) => x.url?.startsWith("data:"))) {
        const docs = [];
        for (const doc of next.docs) {
          if (!doc.url?.startsWith("data:")) { docs.push(doc); continue; }
          try {
            docs.push({ ...doc, url: await backend.putFile!(`${p.id}/문서/${doc.id}-${doc.name}`, doc.url) });
            any = true;
          } catch {
            docs.push(doc);
          }
        }
        next = { ...next, docs };
      }

      return next;
    }),
  );

  return any ? { ...d, projects } : null;
}

export function App() {
  const [db, setDb] = useState<DB | null>(null);
  const [user, setUser] = useState<{ uid: string; email?: string | null } | null>(null);
  const [ready, setReady] = useState(!backend.needsLogin);
  const lastSaved = useRef("");
  /** 마지막으로 저장된 때 — 버튼이 없으니 보여줘야 안심이 된다 */
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  /** 저장이 막혔을 때. 조용히 넘기면 작업한 게 사라진다. */
  const [saveErr, setSaveErr] = useState("");
  /** 사람이 한 일이 아닌 변화 — 되돌리기 단계로 세지 않는다 */
  const quiet = useRef(false);
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
      if (lifted) { quiet.current = true; setDb(lifted); return; }   // 주소로 바뀐 상태로 다시 저장된다
      try {
        await backend.save(db);
        setSavedAt(new Date());
        setSaveErr("");
      } catch (e: any) {
        setSaveErr(e?.message ?? "저장하지 못했습니다.");
      }
    }, 600);
    return () => clearTimeout(t);
  }, [db]);

  if (!ready) return <Gate loading />;
  if (backend.needsLogin && !user) return <Gate />;
  if (!db) return <Gate loading />;

  return <Studio db={db} setDb={setDb} who={user?.email ?? null} savedAt={savedAt} saveErr={saveErr} quiet={quiet} />;
}

/**
 * 본체.
 *
 * 부팅(로그인·불러오기)과 떼어 놓는다.
 * 한 함수 안에서 화면을 중간에 갈아끼우면 React 가 상태 장치 순서를 잃는다.
 */
function Studio({
  db, setDb, who, savedAt, saveErr, quiet,
}: {
  db: DB;
  setDb: React.Dispatch<React.SetStateAction<DB | null>>;
  who: string | null;
  savedAt: Date | null;
  saveErr: string;
  quiet: React.MutableRefObject<boolean>;
}) {
  const [view, setView] = useState<View>("보관함");
  const [openId, setOpenId] = useState<string | null>(null);
  const [browseId, setBrowseId] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [tray, setTray] = useState<TrayItem[]>([]);
  /** 선택 페이지 칸은 평소 접어 둔다. 화면을 넓게 쓰기 위함이다. */
  const [trayOpen, setTrayOpen] = useState(false);
  /** 아직 들어갈 제안서가 없는 사진들 (보관함에서 올린 것) */
  const loose = useRef<Record<string, string>>({});
  /** 아직 들어갈 제안서가 없는 자료들 */
  const looseDocs = useRef<Doc[]>([]);
  /** AI 가 내놓은 시안들 — 고르기 전까지 제안서는 그대로다 */
  const [drafts, setDrafts] = useState<Draft[]>([]);
  /** 마지막으로 열어 둔 제안서. 담은 장을 여기 이어 붙일 수 있다. */
  const [lastEdited, setLastEdited] = useState<string | null>(null);
  /** 지금 보고 있는 페이지. 대화 선반도 같은 페이지를 본다. */
  const [cur, setCur] = useState(0);
  /** 넓은 화면이면 대화창을 켜 둔다. 좁으면 화면을 다 덮으므로 접어 둔다. */
  const [dockOpen, setDockOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth >= 1000,
  );

  /** db 가 비어 있을 때 들어오는 갱신은 무시한다 */
  const update = (apply: (d: DB) => DB) => setDb((d) => (d ? apply(d) : d));

  /** 되돌리기 (Ctrl+Z / 맥은 ⌘+Z, 다시 하기는 Shift 를 같이) */
  const undo = useUndo(db, setDb, quiet);

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
      // 이 건의 파일함에 넣어 둔 자료도 같이 읽힌다
      docsText: docsToText(project?.docs),
    }),
    [baseStyle, project, db.rules, db.pageTypes, db.projects, db.history, openId],
  );

  /* ── 창고에 쓰기 ── */
  const putProject = (apply: (p: Project) => Project) =>
    update((d) => ({ ...d, projects: d.projects.map((x) => (x.id === openId ? apply(x) : x)) }));

  /**
   * 백지 한 장으로 바로 시작.
   *
   * 페이지를 아예 0장으로 두면 회색 빈 화면만 보여 막막하다.
   * 그래서 표지 한 장을 "빈 채로" 깔아 둔다. 채울 칸이 바로 보인다.
   */
  const startBlank = (categoryId = "proposal") => {
    const cover = db.pageTypes.find((t) => t.group === "표지") ?? db.pageTypes[0];
    addProject({
      ...newProject("새 제안서", "", categoryId),
      slides: cover ? [{ id: uid(), pageTypeId: cover.id, content: {} }] : [],
    });
  };

  const addProject = (p: Project) => {
    // 보관함에서 대화하며 올려 둔 사진이 있으면 같이 넣어 준다
    if (Object.keys(loose.current).length) {
      p = { ...p, assets: { ...loose.current, ...p.assets } };
      loose.current = {};
    }
    if (looseDocs.current.length) {
      p = { ...p, docs: [...looseDocs.current, ...(p.docs ?? [])] };
      looseDocs.current = [];
    }
    update((d) => ({ ...d, projects: [p, ...d.projects] }));
    setCreating(null); setBrowseId(null); setOpenId(p.id); setLastEdited(p.id); setCur(0);
  };

  /** 제안서 지우기. 딸린 대화 기록도 같이 지운다. */
  const deleteProject = (id: string) =>
    update((d) => {
      const chats = { ...d.chats };
      for (const k of Object.keys(chats)) if (k.startsWith(`${id}:`)) delete chats[k];
      return {
        ...d,
        projects: d.projects.filter((x) => x.id !== id),
        history: d.history.filter((h) => h.projectId !== id),
        chats,
      };
    });

  /** 완료 ↔ 진행 중 바꾸기. 완료로 바꿀 때 그 시각을 찍는다. */
  const toggleStatus = (id: string) =>
    update((d) => ({
      ...d,
      projects: d.projects.map((x) =>
        x.id === id
          ? x.status === "완료"
            ? { ...x, status: "진행 중" as const, completedAt: undefined }
            : { ...x, status: "완료" as const, completedAt: new Date().toISOString() }
          : x,
      ),
    }));

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
  /**
   * 대화가 쌓이는 자리.
   * 제안서를 안 열고 보관함에서 말을 걸 때도 쌓일 곳이 있어야 한다.
   * (없으면 올린 글이 그대로 버려져 화면에 아무것도 안 나온다)
   */
  const chatKey = (slideId: string | null) =>
    slideId ? `${openId ?? "없음"}:${slideId}` : "보관함:전체";
  const turnsOf = (slideId: string | null): ChatTurn[] => db.chats[chatKey(slideId)] ?? [];
  const onTurns = (slideId: string | null, apply: (t: ChatTurn[]) => ChatTurn[]) =>
    update((d) => {
      const k = chatKey(slideId);
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
  const takePage = (s: Slide, from: Project) => {
    setTray((t) => [...t, {
      key: uid(), slide: s, fromTitle: from.title, fromAssets: from.assets,
    }]);
    setTrayOpen(true);   // 어디로 들어갔는지 보여야 안심이 된다
  };

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

  /** 담은 장을 작업하던 제안서 뒤에 이어 붙인다 */
  const appendTray = () => {
    if (!tray.length || !lastEdited) return;
    const assets: Record<string, string> = {};
    for (const it of tray) Object.assign(assets, it.fromAssets);
    update((d) => ({
      ...d,
      projects: d.projects.map((p) =>
        p.id === lastEdited
          ? {
              ...p,
              slides: [...p.slides, ...tray.map((it) => ({ ...it.slide, id: uid() }))],
              assets: { ...assets, ...p.assets },
              updatedAt: new Date().toISOString(),
            }
          : p,
      ),
    }));
    setTray([]);
    setBrowseId(null);
    setOpenId(lastEdited);   // 바로 열어서 결과가 보이게
  };

  /** 지난 제안서를 복제해 새로 시작 */
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

  /* ── 지금 보고 있는 페이지 (대화 선반이 함께 본다) ── */
  const activeSlide = project?.slides[cur] ?? null;
  const activePageType = activeSlide
    ? db.pageTypes.find((t) => t.id === activeSlide.pageTypeId) ?? null
    : null;
  const activeStyle = styleFor(baseStyle, project?.styleOverride, activeSlide?.styleOverride);
  const activeOps = useMemo(
    () =>
      activePageType && activeSlide && project
        ? interpret(activePageType, activeSlide.content, {
            style: activeStyle, assets: project.assets, pageNumber: cur + 1,
            adjust: activeSlide.adjust, extras: activeSlide.extras,
          })
        : [],
    [activePageType, activeSlide, project, activeStyle, cur],
  );
  const activeRules = rulesFor(db.rules, {
    styleId: baseStyle.id,
    categoryId: project?.category ?? "proposal",
    projectId: openId,
  });

  /**
   * AI 가 돌려준 할 일 목록을 실제로 반영한다.
   * 새로 만든 제안서의 번호를 돌려준다 — 대화창이 그것을 그림으로 보여 준다.
   */
  const applyActions = (as: Action[]): string[] => {
    const known = new Set(db.pageTypes.map((t) => t.id));

    // 보관함에서 "제안서 만들어줘" — 안을 여러 개 내놓으면 전부 만든다
    const made = as.filter((a) => a.do === "새제안서") as Extract<Action, { do: "새제안서" }>[];
    if (made.length) {
      const fresh: Project[] = [];
      for (const m of made) {
        const slides = (m.slides ?? [])
          .filter((x) => known.has(x.pageTypeId))
          .map((x) => ({ id: uid(), pageTypeId: x.pageTypeId, content: x.content ?? {} }));
        if (!slides.length) continue;
        fresh.push({
          ...newProject(m.title || "새 제안서", m.client ?? "", m.category || "proposal"),
          slides,
          // 보관함에서 올려 둔 사진·자료를 같이 넣어 준다
          assets: { ...loose.current },
          docs: [...looseDocs.current],
        });
      }
      if (fresh.length) {
        loose.current = {}; looseDocs.current = [];
        update((d) => ({ ...d, projects: [...fresh, ...d.projects] }));
        setCreating(null); setBrowseId(null);
        // 한 건이면 바로 연다. 여럿이면 보여 주기만 하고 대표가 고르게 둔다.
        if (fresh.length === 1) { setOpenId(fresh[0].id); setLastEdited(fresh[0].id); setCur(0); }
        return fresh.map((x) => x.id);
      }
    }

    // 디자인 시안 — 넣지 않고 화면에 띄운다. 고르면 그때 들어간다.
    const 안 = as.find((a) => a.do === "시안") as Extract<Action, { do: "시안" }> | undefined;
    if (안?.options?.length && openId) {
      const now = project?.slides[cur];
      setDrafts(
        안.options.slice(0, 4).map((o) => ({
          id: uid(),
          name: o.name || "시안",
          why: o.why,
          pageTypeId:
            o.pageTypeId && known.has(o.pageTypeId) ? o.pageTypeId : (now?.pageTypeId ?? ""),
          content: o.content ?? {},
          styleOverride: (() => {
            const ov = overridesFrom(o.style);
            if (ov) delete ov.slide;   // 판 크기는 한 벌이 같아야 한다
            return ov;
          })(),
        })).filter((d) => d.pageTypeId),
      );
      return [];
    }

    if (!openId) return [];
    putProject((p) => {
      const slides = [...p.slides];
      for (const a of as) {
        switch (a.do) {
          case "내용수정":
            if (slides[cur]) slides[cur] = { ...slides[cur], content: a.content };
            break;
          case "다른장수정":
            if (slides[a.at]) slides[a.at] = { ...slides[a.at], content: a.content };
            break;
          case "타입바꾸기":
            if (slides[cur] && db.pageTypes.some((t) => t.id === a.pageTypeId))
              slides[cur] = { ...slides[cur], pageTypeId: a.pageTypeId, content: a.content };
            break;
          case "페이지추가": {
            if (!db.pageTypes.some((t) => t.id === a.pageTypeId)) break;
            const at = Math.max(0, Math.min(slides.length, a.at ?? slides.length));
            slides.splice(at, 0, { id: uid(), pageTypeId: a.pageTypeId, content: a.content ?? {} });
            break;
          }
          case "페이지삭제":
            if (slides.length > 1 && slides[a.at]) slides.splice(a.at, 1);
            break;
          case "페이지이동": {
            if (slides[a.from] && a.to >= 0 && a.to < slides.length) {
              const [m] = slides.splice(a.from, 1);
              slides.splice(a.to, 0, m);
            }
            break;
          }
        }
      }
      return { ...p, slides, updatedAt: new Date().toISOString() };
    });
    return [];
  };

  /**
   * 대화창에 올린 사진을 자산으로 넣어 둔다.
   * 연 제안서가 없으면 잠시 들고 있다가, 새로 만들어지는 제안서에 같이 넣는다.
   */
  const putAsset = (key: string, dataUrl: string) => {
    if (openId) { putProject((x) => ({ ...x, assets: { ...x.assets, [key]: dataUrl } })); return; }
    loose.current = { ...loose.current, [key]: dataUrl };
  };

  /** 대화창에 올린 자료를 이 건의 파일함에 넣어 둔다 */
  const putDoc = (d: Doc) => {
    if (!openId) { looseDocs.current = [...looseDocs.current, d]; return; }
    putProject((x) => ({ ...x, docs: [...(x.docs ?? []), d], updatedAt: new Date().toISOString() }));
  };

  /** 시안을 고른다 — 이때 처음으로 페이지가 바뀐다 */
  const pickDraft = (d: Draft) => {
    putProject((p) => ({
      ...p,
      slides: p.slides.map((s2, i) =>
        i === cur
          ? { ...s2, pageTypeId: d.pageTypeId, content: d.content, styleOverride: d.styleOverride,
              adjust: undefined }   // 틀이 바뀌면 끌어 옮긴 자리는 뜻을 잃는다
          : s2,
      ),
      updatedAt: new Date().toISOString(),
    }));
    setDrafts([]);
  };

  const setSlideContent = (next: Content) =>
    putProject((p) => ({
      ...p,
      slides: p.slides.map((s2, i) => (i === cur ? { ...s2, content: next } : s2)),
      updatedAt: new Date().toISOString(),
    }));

  const dock = (
    <ChatDock
      brain={brain.system}
      style={activeStyle}
      pageTypes={db.pageTypes}
      rules={activeRules}
      categories={db.categories}
      allProjects={db.projects}
      project={project}
      slide={activeSlide}
      pageType={activePageType}
      slideIndex={cur}
      ops={activeOps}
      turns={turnsOf(activeSlide?.id ?? null)}
      onTurns={(apply) => onTurns(activeSlide?.id ?? null, apply)}
      onActions={applyActions}
      onOpenProject={(id) => { setBrowseId(null); setCreating(null); setOpenId(id); setLastEdited(id); setCur(0); }}
      onStyleChange={changeStyle}
      onSaveRule={saveRule}
      onNote={(instruction) =>
        activeSlide && addHistory({ slideIndex: cur, instruction, before: activeSlide.content, after: activeSlide.content })
      }
      onContent={setSlideContent}
      onAsset={putAsset}
      onDoc={putDoc}
      toServer={!!backend.putFile}
      open={dockOpen}
      onToggle={() => setDockOpen(!dockOpen)}
    />
  );

  /** 이어 붙일 대상 */
  const appendTarget = (() => {
    const p = db.projects.find((x) => x.id === lastEdited);
    return p ? { id: p.id, title: p.title } : null;
  })();

  /* ── 화면 고르기 ── */

  if (creating !== null) {
    return (
      <Shell view={view} setView={setView} onNew={() => setCreating("proposal")} bare who={who} savedAt={savedAt} saveErr={saveErr} dock={dock} dockOpen={dockOpen} onDock={() => setDockOpen(!dockOpen)} undo={undo}>
        <NewProject
          style={baseStyle}
          rules={rulesFor(db.rules, { styleId: baseStyle.id, categoryId: creating, projectId: null })}
          pageTypes={db.pageTypes}
          categories={db.categories}
          defaultCategory={creating}
          toServer={!!backend.putFile}
          pastProjects={db.projects}
          onCancel={() => setCreating(null)}
          onDone={(p) => addProject(p)}
        />
      </Shell>
    );
  }

  if (project) {
    return (
      <Shell view={view} setView={setView} onNew={() => setCreating("proposal")} bare who={who} savedAt={savedAt} saveErr={saveErr} dock={dock} dockOpen={dockOpen} onDock={() => setDockOpen(!dockOpen)} undo={undo}>
        <Editor
          project={project} style={styleOf(project)} pageTypes={db.pageTypes}
          categories={db.categories}
          allProjects={db.projects}
          cur={Math.min(cur, Math.max(0, project.slides.length - 1))}
          onCur={setCur}
          onChange={putProject} onBack={() => setOpenId(null)}
          aiSystem={brain.system} onSaveRule={saveRule} onHistory={addHistory}
          onStyleChange={changeStyle}
          turnsOf={turnsOf} onTurns={onTurns}
          toServer={!!backend.putFile}
          drafts={drafts}
          onPickDraft={pickDraft}
          onCloseDrafts={() => setDrafts([])}
          baseStyle={baseStyle}
          onSlideSize={(w, h) =>
            putProject((p) => ({
              ...p,
              styleOverride: overrideWith(
                overrideWith(p.styleOverride, "slide.widthIn", w),
                "slide.heightIn", h,
              ),
            }))
          }
        />
      </Shell>
    );
  }

  if (browsing) {
    return (
      <Shell view={view} setView={setView} onNew={() => setCreating("proposal")} bare who={who} savedAt={savedAt} saveErr={saveErr} dock={dock} dockOpen={dockOpen} onDock={() => setDockOpen(!dockOpen)} undo={undo}>
        <div className="withtray">
          <Browse
            project={browsing} style={styleOf(browsing)} pageTypes={db.pageTypes}
            onClose={() => setBrowseId(null)}
            onUseAsBase={useAsBase}
            onTakePage={(s) => takePage(s, browsing)}
            takenCount={tray.length}
            onOpenTray={() => setTrayOpen(true)}
            onOpen={(id) => { setBrowseId(null); setOpenId(id); setLastEdited(id); setCur(0); }}
            categoryName={db.categories.find((c) => c.id === browsing.category)?.name ?? "미분류"}
            allProjects={db.projects}
            categories={db.categories}
            onPick={setBrowseId}
          />
          <Tray items={tray} style={style} pageTypes={db.pageTypes}
            onRemove={(k) => setTray((t) => t.filter((x) => x.key !== k))}
            onMove={moveTray} onClear={() => setTray([])} onMake={makeFromTray}
            appendTo={appendTarget} onAppend={appendTray}
            open={trayOpen} onToggle={() => setTrayOpen(!trayOpen)} />
        </div>
      </Shell>
    );
  }

  return (
    <Shell view={view} setView={setView} onNew={() => setCreating("proposal")} who={who} savedAt={savedAt} saveErr={saveErr} dock={dock} dockOpen={dockOpen} onDock={() => setDockOpen(!dockOpen)} undo={undo}>
      {view === "보관함" && (
        <div className="withtray">
          <Dashboard
            projects={db.projects} categories={db.categories}
            style={style} pageTypes={db.pageTypes} ruleCount={db.rules.filter((r) => r.enabled).length}
            onBrowse={setBrowseId} onOpen={(id) => { setOpenId(id); setLastEdited(id); setCur(0); }} onNew={(cat) => setCreating(cat)}
            onBlank={startBlank}
            onOpenTray={() => setTrayOpen(true)} trayCount={tray.length}
            onDelete={deleteProject} onToggleStatus={toggleStatus}
            onAddCategory={addCategory} onRenameCategory={renameCategory} onDeleteCategory={deleteCategory}
          />
          <Tray items={tray} style={style} pageTypes={db.pageTypes}
            onRemove={(k) => setTray((t) => t.filter((x) => x.key !== k))}
            onMove={moveTray} onClear={() => setTray([])} onMake={makeFromTray}
            appendTo={appendTarget} onAppend={appendTray}
            open={trayOpen} onToggle={() => setTrayOpen(!trayOpen)} />
        </div>
      )}
      {view === "기록" && <Log db={db} setDb={update} />}
      {view === "창고" && <Store db={db} setDb={update} />}
    </Shell>
  );
}

function Shell({
  view, setView, onNew, bare, who, savedAt, saveErr, dock, dockOpen, onDock, undo, children,
}: {
  view: View; setView: (v: View) => void; onNew: () => void;
  bare?: boolean; who?: string | null; savedAt?: Date | null; saveErr?: string;
  dock?: React.ReactNode;
  dockOpen?: boolean; onDock?: () => void; undo?: Undo; children: React.ReactNode;
}) {
  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          MTMB <span>디자인 스튜디오</span>
          <small className="ver" title="지금 열려 있는 판. 버튼이 안 보이면 새로고침해 주세요">판 {VERSION}</small>
        </div>
        {undo && (
          /* 한 번 누를 때마다 한 단계씩. 왼쪽은 뒤로, 오른쪽은 앞으로. */
          <div className="undoset" title="작업 단계 이동 — 왼쪽은 되돌리기, 오른쪽은 다시 하기">
            <button className="undobtn" disabled={!undo.canUndo} onClick={undo.undo}
              aria-label="한 단계 되돌리기"
              title="한 단계 되돌리기 (Ctrl+Z, 맥은 ⌘+Z)">{"<"}</button>
            <button className="undobtn" disabled={!undo.canRedo} onClick={undo.redo}
              aria-label="한 단계 다시 하기"
              title="한 단계 다시 하기 (Ctrl+Shift+Z)">{">"}</button>
          </div>
        )}
        {!bare && (
          <div className="tabs">
            {(["보관함", "기록", "창고"] as View[]).map((v) => (
              <button key={v} className={`tab ${view === v ? "on" : ""}`} onClick={() => setView(v)}>{v}</button>
            ))}
          </div>
        )}
        <div className="spacer" />
        {/* 저장 버튼이 없다. 알아서 저장되니, 저장됐다는 걸 보여줘야 한다. */}
        <small className={`savedtag ${saveErr ? "bad" : ""}`}
          title={saveErr || "따로 저장하실 필요가 없습니다"}>
          {saveErr
            ? "저장 안 됨"
            : savedAt
              ? `저장됨 ${String(savedAt.getHours()).padStart(2, "0")}:${String(savedAt.getMinutes()).padStart(2, "0")}`
              : "자동 저장"}
        </small>
        {onDock && (
          <button className={`btn sm ${dockOpen ? "accent" : ""}`} onClick={onDock}>
            {dockOpen ? "대화 닫기" : "AI 와 대화"}
          </button>
        )}
        {who && <small className="who" title={who}>{who}</small>}
        {who && <button className="btn sm" onClick={() => void logout()}>로그아웃</button>}
        {!bare && <button className="btn primary" onClick={onNew}>+ 새 제안서</button>}
      </div>
      {saveErr && (
        <div className="savebar">
          <b>저장되지 않았습니다</b> {saveErr}
        </div>
      )}
      <div className="workspace">
        <div className="workmain">{children}</div>
        {dock}
      </div>
    </div>
  );
}
