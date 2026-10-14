import type { Category, HistoryEntry, PageType, Project, Rule, StylePreset } from "../core/types";
import { BUILT_IN_STYLES } from "../core/style";
import { BUILT_IN_PAGE_TYPES } from "../core/pageTypes";
import { SEED_PROJECTS } from "./seed";

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
      projects: saved.projects ?? db.projects,
      history: saved.history ?? [],
      chats: saved.chats ?? {},
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
      }),
    );
  } catch (e) {
    console.warn("저장 실패 (브라우저 저장 공간이 찼을 수 있습니다)", e);
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
