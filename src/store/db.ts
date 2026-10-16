import type { Category, HistoryEntry, LibItem, PageType, Person, Project, Rule, StylePreset, Trail } from "../core/types";
import { BUILT_IN_STYLES } from "../core/style";
import { BUILT_IN_PAGE_TYPES } from "../core/pageTypes";
import { SEED_PROJECTS } from "./seed";
import type { Backend } from "./backend";

/**
 * 창고 보관소
 *
 * 지금은 "내 PC(브라우저)"에 저장한다.
 * 나중에 Firebase 로 옮길 때는 이 파일 하나만 바꾸면 된다.
 * 화면 쪽 코드는 손대지 않는다.
 */

const KEY = "mtmb-studio-v1";

/** 한 페이지에서 오간 대화 */
export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
  /** 이 답에서 새로 만들어진 제안서 번호들 — 대화창에 그림으로 보여 준다 */
  made?: string[];
}

export interface DB {
  categories: Category[];
  styles: StylePreset[];
  pageTypes: PageType[];
  rules: Rule[];
  projects: Project[];
  history: HistoryEntry[];
  /** "프로젝트id:페이지id" → 그 페이지에서 오간 대화 */
  chats: Record<string, ChatTurn[]>;
  /** 분류에 쌓아 둔 자료 (미리보기 그림은 따로 IndexedDB 에 있다) */
  library: LibItem[];
  /** 들어온 적 있는 사람들 (처음 들어올 때 이름이 적힌다) */
  people: Person[];
  /** 대표 암호 · 직원 암호. 어느 쪽을 넣었느냐로 자리가 갈린다 */
  대표암호: string;
  직원암호: string;
  /**
   * 직원에게 보일 큰 분류들.
   *
   * 비어 있으면 전부 보인다. 대표가 골라 두면 그것만 보인다.
   * 대표는 무엇을 골라 두든 늘 전부 본다.
   */
  직원분류: string[];
  /** 누가 언제 무엇을 손댔는가 */
  trail: Trail[];
  /** 직원에게 자기가 만든 것만 보일 것인가 (대표가 켠다) */
  onlyMine?: boolean;
}

export const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * 처음 깔리는 규칙 (기획서 7장에서 대표님이 확정한 원칙)
 *
 * 범위를 나눠 둔다.
 *  - 공통   : 어떤 문서든 지킨다
 *  - 스타일 : 핫플트립 미니멀에만 해당. 다른 브랜드는 다를 수 있다
 */
const DEFAULT_RULES: { text: string; scope: "공통" | "스타일" }[] = [
  { scope: "스타일", text: "기본은 흑백. 코랄(accent)은 임팩트에만 쓴다: 가장 중요한 숫자 1개, 구분 장 번호, 강조 단계 1개" },
  { scope: "스타일", text: "서로 다른 CI 색(MTMB 네이비 + 핫플트립 코랄)을 섞지 않는다" },
  { scope: "공통",   text: "새까만 박스·띠를 쓰지 않는다" },
  { scope: "공통",   text: "회색 박스·카드를 남발하지 않는다. 영역은 얇은 선(0.75pt)으로만 구분한다" },
  { scope: "스타일", text: "강조는 굵은 코랄 선이나 글자색으로 한다. 배경을 채우지 않는다" },
  { scope: "공통",   text: "그림자, 사선 배경, 장식 원을 쓰지 않는다" },
  { scope: "공통",   text: "상단 점 5개·가로줄·섹션 라벨을 넣지 않는다. 하단 영문 문구도 넣지 않는다" },
  { scope: "공통",   text: "페이지 번호만 오른쪽 아래 아주 작게 넣는다" },
  { scope: "공통",   text: "정렬을 정확히 맞춘다: 로고 왼쪽 끝 = 글자 시작선, 날짜는 로고 글자 몸통 중앙, 사진 아랫선 = 로고 줄" },
  { scope: "스타일", text: "로고 PNG의 투명 여백을 계산해 실제 그림 기준으로 정렬한다" },
  { scope: "스타일", text: "표지에 CI 는 1개만 넣는다" },
];

/** 처음 깔리는 분류. 여기서부터 대표님이 + 로 늘려간다. */
const DEFAULT_CATEGORIES: Category[] = [
  { id: "proposal",  name: "제안서",       kind: "우리 결과물", order: 1, builtIn: true },
  { id: "company",   name: "회사소개서",   kind: "우리 결과물", order: 2, builtIn: true },
  { id: "bid",       name: "입찰기획서",   kind: "우리 결과물", order: 3, builtIn: true },
  { id: "plan",      name: "기획서",       kind: "우리 결과물", order: 4, builtIn: true },
  { id: "detail",    name: "상세페이지",   kind: "우리 결과물", order: 5, builtIn: true },
  { id: "reference", name: "참고 보관함",  kind: "참고 자료",   order: 6, builtIn: true },
  { id: "etc",       name: "기타",         kind: "우리 결과물", order: 7, builtIn: true },
];

function seed(): DB {
  return {
    categories: DEFAULT_CATEGORIES,
    styles: BUILT_IN_STYLES,
    pageTypes: BUILT_IN_PAGE_TYPES,
    rules: DEFAULT_RULES.map((r) => ({
      id: uid(),
      text: r.text,
      scope: r.scope,
      scopeId: r.scope === "스타일" ? "hotpltrip-minimal" : undefined,
      source: "기본" as const,
      enabled: true,
      createdAt: new Date().toISOString(),
    })),
    projects: SEED_PROJECTS,
    history: [],
    chats: {},
    library: [],
    // 이름을 미리 깔아 두지 않는다. 처음 들어오는 사람이 제 이름을 적는다.
    people: [],
    대표암호: "2230",
    직원암호: "2012",
    직원분류: [],
    trail: [],
    onlyMine: false,
  };
}

export function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed();
    const saved = JSON.parse(raw) as Partial<DB>;
    const db = seed();
    // 기본 스타일·페이지 타입은 항상 최신 코드 쪽을 쓰고,
    // 대표님이 만든 것(규칙·프로젝트·기록)은 저장된 것을 쓴다.
    return {
      // 기본 분류는 유지하되, 대표님이 더한 것과 이름을 바꾼 것은 저장된 쪽을 쓴다
      categories: mergeCategories(db.categories, saved.categories ?? []),
      // 대표님이 바꾼 규격이 있으면 그걸 쓴다 (AI 대화에서 바꿀 수 있다)
      styles: saved.styles?.length ? saved.styles : db.styles,
      pageTypes: [
        ...db.pageTypes,
        ...(saved.pageTypes ?? []).filter((p) => !p.builtIn),
      ],
      rules: saved.rules?.length ? saved.rules : db.rules,
      // 빈 목록이면 씨앗(인천시티투어)을 되살린다. 진열대가 비면 아무것도 못 한다.
    projects: saved.projects?.length ? saved.projects : db.projects,
      history: saved.history ?? [],
      chats: saved.chats ?? {},
      library: saved.library ?? [],
      people: saved.people ?? [],
      대표암호: saved.대표암호 || db.대표암호,
      직원암호: saved.직원암호 || db.직원암호,
      직원분류: saved.직원분류 ?? [],
      trail: saved.trail ?? [],
      onlyMine: saved.onlyMine ?? false,
    };
  } catch {
    return seed();
  }
}

export function save(db: DB): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        categories: db.categories,
        styles: db.styles,
        pageTypes: db.pageTypes.filter((p) => !p.builtIn),
        rules: db.rules,
        projects: db.projects,
        history: db.history,
        chats: db.chats,
        library: db.library,
        people: db.people,
        대표암호: db.대표암호,
        직원암호: db.직원암호,
        직원분류: db.직원분류,
        trail: db.trail.slice(-600),   // 너무 쌓이면 저장 칸을 잡아먹는다
        onlyMine: db.onlyMine,
      }),
    );
  } catch (e) {
    // 조용히 넘어가면 안 된다. 새로고침하는 순간 작업한 게 사라진다.
    throw new Error(
      "브라우저 저장 공간이 꽉 찼습니다. 사진이 많은 제안서를 지우거나, " +
      "회사 서버(Firebase)로 옮기면 해결됩니다.",
    );
  }
}

/** 기본 분류 + 대표님이 손댄 분류를 합친다 */
function mergeCategories(base: Category[], saved: Category[]): Category[] {
  if (!saved.length) return base;
  const byId = new Map(saved.map((c) => [c.id, c]));
  const merged = base.map((b) => byId.get(b.id) ?? b);
  const extra = saved.filter((c) => !base.some((b) => b.id === c.id));
  return [...merged, ...extra].sort((a, b) => a.order - b.order);
}

/** 새 프로젝트 틀 */
export function newProject(title: string, client: string, category = "proposal"): Project {
  const t = new Date().toISOString();
  return {
    id: uid(),
    title: title || "제목 없는 제안서",
    client,
    category,
    status: "진행 중",
    tags: [],
    summary: "",
    styleId: "hotpltrip-minimal",
    styleVersion: 1,
    slides: [],
    assets: {},
    notes: "",
    createdAt: t,
    updatedAt: t,
  };
}


/** 브라우저 저장. 설정이 없을 때 쓰는 임시 저장소다. */
export function localBackend(): Backend {
  return {
    name: "이 브라우저",
    async load() {
      try {
        const raw = localStorage.getItem(KEY);
        return raw ? (JSON.parse(raw) as Partial<DB>) : {};
      } catch {
        return {};
      }
    },
    async save(db) {
      save(db);   // 실패하면 던진다. 위에서 받아 화면에 띄운다.
    },
  };
}

/** 저장된 것과 기본값을 합친다 (어느 저장소에서 왔든 똑같이) */
export function merge(saved: Partial<DB>): DB {
  const db = seed();
  return {
    categories: mergeCategories(db.categories, saved.categories ?? []),
    styles: saved.styles?.length ? saved.styles : db.styles,
    pageTypes: [...db.pageTypes, ...(saved.pageTypes ?? []).filter((p) => !p.builtIn)],
    rules: saved.rules?.length ? saved.rules : db.rules,
    // 빈 목록이면 씨앗(인천시티투어)을 되살린다. 진열대가 비면 아무것도 못 한다.
    projects: saved.projects?.length ? saved.projects : db.projects,
    history: saved.history ?? [],
    chats: saved.chats ?? {},
    library: saved.library ?? [],
    people: saved.people ?? [],
    대표암호: saved.대표암호 || db.대표암호,
    직원암호: saved.직원암호 || db.직원암호,
    직원분류: saved.직원분류 ?? [],
    trail: saved.trail ?? [],
    onlyMine: saved.onlyMine ?? false,
  };
}
