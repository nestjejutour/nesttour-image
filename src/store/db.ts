import type { HistoryEntry, PageType, Project, Rule, StylePreset } from "../core/types";
import { BUILT_IN_STYLES } from "../core/style";
import { BUILT_IN_PAGE_TYPES } from "../core/pageTypes";

/**
 * 창고 보관소
 *
 * 지금은 "내 PC(브라우저)"에 저장한다.
 * 나중에 Firebase 로 옮길 때는 이 파일 하나만 바꾸면 된다.
 * 화면 쪽 코드는 손대지 않는다.
 */

const KEY = "mtmb-studio-v1";

export interface DB {
  styles: StylePreset[];
  pageTypes: PageType[];
  rules: Rule[];
  projects: Project[];
  history: HistoryEntry[];
}

export const uid = () => Math.random().toString(36).slice(2, 10);

/** 기본 규칙 — 기획서 7장에서 대표님이 확정한 원칙 그대로 */
const DEFAULT_RULES: string[] = [
  "기본은 흑백. 코랄(accent)은 임팩트에만 쓴다: 가장 중요한 숫자 1개, 구분 장 번호, 강조 단계 1개",
  "서로 다른 CI 색(MTMB 네이비 + 핫플트립 코랄)을 섞지 않는다",
  "새까만 박스·띠를 쓰지 않는다",
  "회색 박스·카드를 남발하지 않는다. 영역은 얇은 선(0.75pt)으로만 구분한다",
  "강조는 굵은 코랄 선이나 글자색으로 한다. 배경을 채우지 않는다",
  "그림자, 사선 배경, 장식 원을 쓰지 않는다",
  "상단 점 5개·가로줄·섹션 라벨을 넣지 않는다. 하단 영문 문구도 넣지 않는다",
  "페이지 번호만 오른쪽 아래 아주 작게 넣는다",
  "정렬을 정확히 맞춘다: 로고 왼쪽 끝 = 글자 시작선, 날짜는 로고 글자 몸통 중앙, 사진 아랫선 = 로고 줄",
  "로고 PNG의 투명 여백을 계산해 실제 그림 기준으로 정렬한다",
  "표지에 CI 는 1개만 넣는다",
];

function seed(): DB {
  return {
    styles: BUILT_IN_STYLES,
    pageTypes: BUILT_IN_PAGE_TYPES,
    rules: DEFAULT_RULES.map((text) => ({
      id: uid(),
      styleId: "hotpltrip-minimal",
      text,
      source: "기본" as const,
      enabled: true,
      createdAt: new Date().toISOString(),
    })),
    projects: [],
    history: [],
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
      styles: db.styles,
      pageTypes: [
        ...db.pageTypes,
        ...(saved.pageTypes ?? []).filter((p) => !p.builtIn),
      ],
      rules: saved.rules?.length ? saved.rules : db.rules,
      projects: saved.projects ?? [],
      history: saved.history ?? [],
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
        pageTypes: db.pageTypes.filter((p) => !p.builtIn),
        rules: db.rules,
        projects: db.projects,
        history: db.history,
      }),
    );
  } catch (e) {
    console.warn("저장 실패 (브라우저 저장 공간이 찼을 수 있습니다)", e);
  }
}

/** 새 프로젝트 틀 */
export function newProject(title: string, client: string): Project {
  const t = new Date().toISOString();
  return {
    id: uid(),
    title: title || "제목 없는 제안서",
    client,
    category: "제안서",
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
