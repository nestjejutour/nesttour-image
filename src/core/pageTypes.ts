import type { PageType } from "./types";

/**
 * 창고 2 — 페이지 타입
 *
 * 전부 "데이터"다. 코드가 아니다.
 * 좌표는 대표님이 승인한 인천시티투어 v10.pptx 에서 그대로 뽑았다.
 *
 * 새 타입이 필요하면 이 모양의 객체를 하나 더 넣으면 끝이다.
 * (나중에는 화면에서 추가할 수 있게 한다. 코드 수정 없음)
 */

const now = "2026-10-14";

export const BUILT_IN_PAGE_TYPES: PageType[] = [
  // ──────────────────────────────────────────── 표지
  {
    id: "cover-photo",
    name: "표지 (사진 분할)",
    description: "왼쪽 글자 + 오른쪽 사진. 사진 아랫선이 로고 줄에 맞는다.",
    group: "표지",
    showPageNo: false,
    builtIn: true,
    createdAt: now,
    slots: [
      { key: "recipient", label: "받는 곳", kind: "text", required: true, hint: "예: 인천관광공사 귀중" },
      { key: "title1", label: "제목 첫째 줄", kind: "text", required: true },
      { key: "title2", label: "제목 둘째 줄", kind: "text" },
      { key: "subtitle", label: "부제", kind: "text" },
      { key: "date", label: "날짜", kind: "text", hint: "예: 2026. 10" },
      { key: "photo", label: "주제 사진", kind: "image" },
      { key: "logo", label: "로고", kind: "image" },
    ],
    elements: [
      { type: "text", bind: "recipient", x: 0.75, y: 0.9, w: 4.0, h: 0.3, token: "body", bold: true, valign: "middle", required: true },
      { type: "line", x: 0.75, y: 2.05, w: 0.5, h: 0, color: "accent", weight: 2 },
      { type: "text", bind: "title1", x: 0.75, y: 2.2, w: 4.7, h: 0.75, token: "coverTitleBold", valign: "middle", required: true },
      { type: "text", bind: "title2", x: 0.75, y: 2.9, w: 4.7, h: 0.65, token: "coverTitleThin", valign: "middle" },
      { type: "text", bind: "subtitle", x: 0.75, y: 3.75, w: 4.7, h: 0.35, size: 12.5, color: "muted", valign: "middle" },
      { type: "image", bind: "logo", x: 0.75, y: 4.274, w: 1.1, h: 0.426, fit: "contain" },
      { type: "line", x: 2.05, y: 4.426, w: 0, h: 0.24, color: "lineStrong" },
      { type: "text", bind: "date", x: 2.23, y: 4.396, w: 2.0, h: 0.3, token: "subtitle", valign: "middle" },
      { type: "image", bind: "photo", x: 5.3, y: 1.4, w: 3.95, h: 3.3, fit: "cover" },
    ],
    sample: {
      recipient: "인천관광공사 귀중",
      title1: "인천시티투어",
      title2: "온라인 판로 확대 제안",
      subtitle: "핫플트립 판매처 입점 · 위탁판매",
      date: "2026. 10",
    },
  },

  // ──────────────────────────────────────────── 구분 장
  {
    id: "divider",
    name: "구분 장",
    description: "큰 코랄 번호와 굵은 제목만.",
    group: "표지",
    showPageNo: false,
    builtIn: true,
    createdAt: now,
    slots: [
      { key: "number", label: "번호", kind: "text", required: true, hint: "예: 01" },
      { key: "title", label: "제목", kind: "text", required: true },
    ],
    elements: [
      { type: "text", bind: "number", x: 0.75, y: 1.95, w: 1.5, h: 0.6, size: 30, bold: true, color: "accent", valign: "middle", required: true },
      { type: "text", bind: "title", x: 0.75, y: 2.55, w: 8.0, h: 0.7, size: 32, bold: true, valign: "middle", required: true },
    ],
    sample: { number: "01", title: "핫플트립 소개" },
  },

  // ──────────────────────────────────────────── 숫자 임팩트
  {
    id: "impact-numbers",
    name: "숫자 임팩트",
    description: "큰 숫자 3개, 얇은 세로선으로 구분, 아래 한 줄 문장.",
    group: "본문",
    builtIn: true,
    createdAt: now,
    slots: [
      { key: "eyebrow", label: "위쪽 작은 글자", kind: "text" },
      {
        key: "items", label: "숫자", kind: "list", max: 3, required: true,
        itemSlots: [
          { key: "value", label: "숫자", kind: "text", required: true },
          { key: "label", label: "이름", kind: "text", required: true },
          { key: "caption", label: "설명", kind: "text" },
          { key: "accent", label: "코랄로 강조", kind: "text", hint: "강조하려면 y 입력" },
        ],
      },
      { key: "note", label: "아래 한 줄 문장", kind: "text" },
    ],
    elements: [
      { type: "text", bind: "eyebrow", x: 0.6, y: 0.75, w: 8.8, h: 0.3, token: "subtitle", align: "center", valign: "middle" },
      {
        type: "repeat", over: "items", origin: { x: 0.95, y: 1.75 }, step: { x: 2.9 }, max: 3,
        elements: [
          { type: "line", x: -0.3, y: 0.1, w: 0, h: 1.2, color: "#E5E5E5", showIf: "$notFirst" },
          { type: "text", bind: "value", x: 0, y: 0, w: 2.3, h: 0.8, token: "keyNumberBig", align: "center", valign: "middle", required: true, hideIf: "accent" },
          { type: "text", bind: "value", x: 0, y: 0, w: 2.3, h: 0.8, token: "keyNumberBig", color: "accent", align: "center", valign: "middle", showIf: "accent" },
          { type: "text", bind: "label", x: 0, y: 0.85, w: 2.3, h: 0.28, size: 10, bold: true, align: "center", valign: "middle", required: true },
          { type: "text", bind: "caption", x: 0, y: 1.12, w: 2.3, h: 0.25, size: 8.5, color: "muted", align: "center", valign: "middle" },
        ],
      },
      { type: "text", bind: "note", x: 0.6, y: 4.25, w: 8.8, h: 0.5, size: 20, bold: true, align: "center", valign: "middle" },
    ],
    sample: {
      eyebrow: "핫플트립",
      items: [
        { value: "2021", label: "2021년 3월 설립", caption: "원데이 버스투어 전문" },
        { value: "9,000+", label: "네이버 누적 리뷰", caption: "평점 4.81 / 5", accent: "y" },
        { value: "14", label: "판매 채널", caption: "연 2만 명 이상 이용" },
      ],
      note: "원데이 버스투어 전문 플랫폼입니다",
    },
  },

  // ──────────────────────────────────────────── 요약
  {
    id: "summary",
    name: "요약",
    description: "위에 핵심 단어 3~4개, 굵은 선 아래 항목표.",
    group: "본문",
    builtIn: true,
    createdAt: now,
    slots: [
      { key: "title", label: "페이지 제목", kind: "text", required: true },
      { key: "subtitle", label: "한 줄 설명", kind: "text" },
      {
        key: "items", label: "핵심 단어", kind: "list", max: 4,
        itemSlots: [
          { key: "value", label: "단어", kind: "text", required: true },
          { key: "label", label: "설명", kind: "text" },
          { key: "accent", label: "코랄로 강조", kind: "text", hint: "강조하려면 y 입력" },
        ],
      },
      {
        key: "rows", label: "항목표", kind: "list", required: true,
        itemSlots: [
          { key: "label", label: "항목명", kind: "text", required: true },
          { key: "value", label: "내용", kind: "textarea", required: true },
        ],
      },
    ],
    elements: [
      { type: "text", bind: "title", x: 0.75, y: 0.55, w: 6.0, h: 0.5, token: "pageTitle", valign: "middle", required: true },
      { type: "text", bind: "subtitle", x: 0.75, y: 1.05, w: 8.5, h: 0.3, size: 11, color: "muted", valign: "middle" },
      {
        type: "repeat", over: "items", origin: { x: 0.75, y: 1.6 }, step: { x: 2.125 }, max: 4,
        elements: [
          { type: "line", x: -0.15, y: 0.07, w: 0, h: 0.75, color: "line", showIf: "$notFirst" },
          { type: "text", bind: "value", x: 0, y: 0, w: 1.825, h: 0.5, token: "keyNumber", valign: "middle", required: true, hideIf: "accent" },
          { type: "text", bind: "value", x: 0, y: 0, w: 1.825, h: 0.5, token: "keyNumber", color: "accent", valign: "middle", showIf: "accent" },
          { type: "text", bind: "label", x: 0, y: 0.52, w: 1.825, h: 0.28, size: 10, color: "muted", valign: "middle" },
        ],
      },
      { type: "line", x: 0.75, y: 2.7, w: 8.5, h: 0, color: "ink", weight: 1.5 },
      {
        type: "repeat", over: "rows", origin: { x: 0.75, y: 2.8 }, step: { y: 0.44 },
        elements: [
          { type: "text", bind: "label", x: 0, y: 0, w: 1.5, h: 0.4, token: "rowLabel", valign: "middle", required: true },
          { type: "text", bind: "value", x: 1.6, y: 0, w: 6.9, h: 0.4, size: 11, color: "#444444", valign: "middle", required: true },
          { type: "line", x: 0, y: 0.42, w: 8.5, h: 0, color: "#E8E8E8" },
        ],
      },
    ],
    sample: {
      title: "제안 요약",
      subtitle: "인천시티투어 상품을 핫플트립 판매채널에 등록해 온라인 판매처를 추가하는 제안입니다.",
      items: [
        { value: "위탁판매", label: "판매대행 방식" },
        { value: "0원", label: "공사 추가 비용", accent: "y" },
        { value: "정가", label: "공시 요금 그대로 판매" },
        { value: "전담", label: "예약 · 응대 · 정산 핫플트립" },
      ],
      rows: [
        { label: "제안 내용", value: "인천시티투어 상품을 핫플트립 자사몰 및 제휴 판매채널(14개)에 등록해 온라인 판매" },
        { label: "공사 역할", value: "상품 정보(노선 · 운행일정 · 요금 · 이용조건) 제공" },
        { label: "핫플트립 역할", value: "상세페이지 제작, 예약 접수, 고객 응대 · 취소 · 환불, 월별 정산 및 실적 보고" },
        { label: "기대 효과", value: "전국 20~30대 개별 여행객 대상 신규 판매 채널 확보" },
        { label: "진행 방식", value: "1년 계약 → 상세페이지 오픈 → 분기별 실적 보고 및 개선 협의" },
      ],
    },
  },

  // ──────────────────────────────────────────── 카드 열
  {
    id: "cards-5",
    name: "카드 열 (사진)",
    description: "위쪽 얇은 선 + 사진 + 제목 + 설명. 강조 카드는 코랄 선.",
    group: "본문",
    builtIn: true,
    createdAt: now,
    slots: [
      { key: "title", label: "페이지 제목", kind: "text", required: true },
      { key: "subtitle", label: "한 줄 설명", kind: "text" },
      {
        key: "cards", label: "카드", kind: "list", max: 5, required: true,
        itemSlots: [
          { key: "title", label: "카드 제목", kind: "text", required: true },
          { key: "desc", label: "설명", kind: "textarea" },
          { key: "photo", label: "사진", kind: "image" },
          { key: "accent", label: "코랄 선으로 강조", kind: "text", hint: "강조하려면 y 입력" },
        ],
      },
      { key: "note", label: "아래 한 줄 문장", kind: "text" },
    ],
    elements: [
      { type: "text", bind: "title", x: 0.6, y: 0.42, w: 8.8, h: 0.55, token: "pageTitle", valign: "middle", required: true },
      { type: "text", bind: "subtitle", x: 0.6, y: 0.98, w: 8.8, h: 0.3, token: "subtitle", valign: "middle" },
      {
        type: "repeat", over: "cards", origin: { x: 0.6, y: 1.5 }, step: { x: 1.8 }, max: 5,
        elements: [
          { type: "line", x: 0, y: 0, w: 1.6, h: 0, color: "lineStrong", hideIf: "accent" },
          { type: "line", x: 0, y: 0, w: 1.6, h: 0, color: "accent", weight: 1.5, showIf: "accent" },
          { type: "image", bind: "photo", x: 0.1, y: 0.102, w: 1.4, h: 1.836, fit: "cover" },
          { type: "text", bind: "title", x: 0.15, y: 2.1, w: 1.35, h: 0.32, token: "cardTitle", valign: "middle", required: true },
          { type: "text", bind: "desc", x: 0.15, y: 2.45, w: 1.35, h: 0.8, size: 10, color: "muted", valign: "top" },
        ],
      },
      { type: "text", bind: "note", x: 0.6, y: 4.5, w: 8.8, h: 0.46, size: 12.5, bold: true, align: "center", valign: "middle" },
    ],
    sample: {
      title: "고객 타깃별 여행 상품",
      subtitle: "뚜벅이·반려동물·아동동반·프라이빗·시니어 등 다양한 여행 상황을 상품화합니다.",
      cards: [
        { title: "국내핫플 버스", desc: "20~40대 /\n주요 관광 거점" },
        { title: "시티투어 버스", desc: "주요 명소 /\n편리한 도시 관광", accent: "y" },
        { title: "해외핫플 버스", desc: "해외 인기 관광지 /\n트렌디한 여행" },
        { title: "핫플택시", desc: "프라이빗 여행" },
        { title: "청춘버스", desc: "시니어 / 단체 /\n모임 전용 여행" },
      ],
    },
  },

  // ──────────────────────────────────────────── 단계 흐름
  {
    id: "process",
    name: "단계 흐름",
    description: "번호 + 제목 + 설명을 가로로.",
    group: "본문",
    builtIn: true,
    createdAt: now,
    slots: [
      { key: "title", label: "페이지 제목", kind: "text", required: true },
      { key: "subtitle", label: "한 줄 설명", kind: "text" },
      {
        key: "steps", label: "단계", kind: "list", max: 3, required: true,
        itemSlots: [
          { key: "title", label: "단계 제목", kind: "text", required: true },
          { key: "desc", label: "설명", kind: "text" },
        ],
      },
    ],
    elements: [
      { type: "text", bind: "title", x: 0.6, y: 0.42, w: 8.8, h: 0.55, token: "pageTitle", valign: "middle", required: true },
      { type: "text", bind: "subtitle", x: 0.6, y: 0.98, w: 8.8, h: 0.3, token: "subtitle", valign: "middle" },
      {
        type: "repeat", over: "steps", origin: { x: 0.6, y: 1.5 }, step: { x: 3.0 }, max: 3,
        elements: [
          { type: "line", x: 0, y: 0, w: 2.8, h: 0, color: "lineStrong" },
          { type: "text", bind: "$index2", x: 0.22, y: 0, w: 0.6, h: 0.95, size: 22, bold: true, valign: "middle" },
          { type: "text", bind: "title", x: 0.85, y: 0.12, w: 1.8, h: 0.35, token: "cardTitle", valign: "middle", required: true },
          { type: "text", bind: "desc", x: 0.85, y: 0.48, w: 1.8, h: 0.3, size: 10, color: "muted", valign: "middle" },
        ],
      },
    ],
    sample: {
      title: "판매·제휴 채널",
      subtitle: "자사몰과 여행 플랫폼, 폐쇄몰을 통해 다채널 유통 구조를 구축해 왔습니다.",
      steps: [
        { title: "자사몰", desc: "핫플트립 직접 판매" },
        { title: "여행 플랫폼", desc: "OTA · 액티비티 플랫폼" },
        { title: "폐쇄몰 · 제휴", desc: "복지몰 · 기업 제휴" },
      ],
    },
  },

  // ──────────────────────────────────────────── 사진 임팩트
  {
    id: "impact-photo",
    name: "사진 임팩트",
    description: "사진 전면 + 어두운 막 + 흰 글씨 한 줄.",
    group: "본문",
    showPageNo: false,
    builtIn: true,
    createdAt: now,
    slots: [
      { key: "photo", label: "배경 사진", kind: "image", required: true },
      { key: "eyebrow", label: "위쪽 작은 글자", kind: "text" },
      { key: "headline", label: "큰 문장", kind: "text", required: true },
      { key: "quote", label: "아래 인용", kind: "text" },
    ],
    elements: [
      { type: "image", bind: "photo", x: 0, y: 0, w: 10, h: 5.625, fit: "cover", placeholder: false },
      { type: "scrim", x: 0, y: 0, w: 10, h: 5.625, color: "#000000", alpha: 0.45 },
      { type: "text", bind: "eyebrow", x: 0.6, y: 0.7, w: 8.8, h: 0.35, size: 13, color: "white", align: "center", valign: "middle" },
      { type: "text", bind: "headline", x: 0.6, y: 3.6, w: 8.8, h: 0.7, size: 30, bold: true, color: "white", align: "center", valign: "middle", required: true },
      { type: "text", bind: "quote", x: 0.6, y: 4.35, w: 8.8, h: 0.3, size: 10, color: "#F3EEEE", align: "center", valign: "middle" },
    ],
    sample: {
      eyebrow: "핫플트립 고객은",
      headline: "운전 걱정 없이, 하루를 온전히 즐깁니다",
      quote: "“운전 걱정 X 주차 걱정 X 오롯이 여행만…”  — 실제 고객 후기",
    },
  },

  // ──────────────────────────────────────────── 마무리
  {
    id: "closing",
    name: "마무리",
    description: "마무리 문장, 감사합니다, 연락처, 로고.",
    group: "마무리",
    showPageNo: false,
    builtIn: true,
    createdAt: now,
    slots: [
      { key: "message", label: "마무리 문장", kind: "text", required: true },
      { key: "thanks", label: "인사말", kind: "text" },
      { key: "contact", label: "연락처", kind: "text" },
      { key: "logo", label: "로고", kind: "image" },
    ],
    elements: [
      { type: "line", x: 0.75, y: 1.75, w: 0.5, h: 0, color: "accent", weight: 2 },
      { type: "text", bind: "message", x: 0.75, y: 2.0, w: 8.5, h: 0.8, size: 24, bold: true, valign: "middle", required: true },
      { type: "text", bind: "thanks", x: 0.75, y: 2.95, w: 8.5, h: 0.5, size: 16, color: "muted", valign: "middle" },
      { type: "image", bind: "logo", x: 0.75, y: 4.274, w: 1.1, h: 0.426, fit: "contain" },
      { type: "text", bind: "contact", x: 2.23, y: 4.396, w: 5.0, h: 0.3, token: "caption", valign: "middle" },
    ],
    sample: {
      message: "인천시티투어의 온라인 판로를 함께 넓히겠습니다.",
      thanks: "감사합니다.",
      contact: "핫플트립 · 02-374-0333 · hotpltrip.com",
    },
  },
];
