import type { Project } from "../core/types";

/**
 * 첫 사례 — 인천시티투어 제안서 (승인본 v10 에서 이관)
 *
 * 기획서 12장 1단계의 "인천시티투어 제안서를 첫 데이터로 이관" 항목이다.
 * 진열대가 비어 있으면 대시보드가 말이 안 되므로, 이 한 건을 씨앗으로 둔다.
 * 대표님이 회사소개서 등을 올리면 같은 자리에 나란히 꽂힌다.
 */
export const SEED_PROJECTS: Project[] = [
  {
    id: "seed-incheon-citytour",
    title: "인천시티투어 제안서",
    client: "인천관광공사",
    category: "proposal",
    status: "완료",
    tags: ["시티투어", "위탁판매", "온라인 판로"],
    summary: "인천시티투어 상품을 핫플트립 판매채널에 등록해 온라인 판매처를 추가하는 제안",
    styleId: "hotpltrip-minimal",
    styleVersion: 1,
    assets: {},
    notes: "대표 확정본 v10. 좌표·색·글자 크기의 기준이 되는 제안서다.",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-14T00:00:00.000Z",
    completedAt: "2026-10-14T00:00:00.000Z",
    slides: [
      {
        id: "s1",
        pageTypeId: "cover-photo",
        content: {
          recipient: "인천관광공사 귀중",
          title1: "인천시티투어",
          title2: "온라인 판로 확대 제안",
          subtitle: "핫플트립 판매처 입점 · 위탁판매",
          date: "2026. 10",
          photo: "seed/cover-bus.jpg",
        },
      },
      {
        id: "s2",
        pageTypeId: "summary",
        content: {
          title: "제안 요약",
          subtitle:
            "인천시티투어 상품을 핫플트립 판매채널에 등록해 온라인 판매처를 추가하는 제안입니다.",
          items: [
            { value: "위탁판매", label: "판매대행 방식" },
            { value: "0원", label: "공사 추가 비용", accent: "y" },
            { value: "정가", label: "공시 요금 그대로 판매" },
            { value: "전담", label: "예약 · 응대 · 정산 핫플트립" },
          ],
          rows: [
            {
              label: "제안 내용",
              value: "인천시티투어 상품을 핫플트립 자사몰 및 제휴 판매채널(14개)에 등록해 온라인 판매",
            },
            { label: "공사 역할", value: "상품 정보(노선 · 운행일정 · 요금 · 이용조건) 제공" },
            {
              label: "핫플트립 역할",
              value: "상세페이지 제작, 예약 접수, 고객 응대 · 취소 · 환불, 월별 정산 및 실적 보고",
            },
            { label: "기대 효과", value: "전국 20~30대 개별 여행객 대상 신규 판매 채널 확보" },
            {
              label: "진행 방식",
              value: "1년 계약 → 상세페이지 오픈 → 분기별 실적 보고 및 개선 협의",
            },
          ],
        },
      },
      { id: "s3", pageTypeId: "divider", content: { number: "01", title: "핫플트립 소개" } },
      {
        id: "s4",
        pageTypeId: "impact-numbers",
        content: {
          eyebrow: "핫플트립",
          items: [
            { value: "2021", label: "2021년 3월 설립", caption: "원데이 버스투어 전문" },
            { value: "9,000+", label: "네이버 누적 리뷰", caption: "평점 4.81 / 5", accent: "y" },
            { value: "14", label: "판매 채널", caption: "연 2만 명 이상 이용" },
          ],
          note: "원데이 버스투어 전문 플랫폼입니다",
        },
      },
      {
        id: "s5",
        pageTypeId: "cards-5",
        content: {
          title: "고객 타깃별 여행 상품",
          subtitle: "뚜벅이·반려동물·아동동반·프라이빗·시니어 등 다양한 여행 상황을 상품화합니다.",
          cards: [
            { title: "국내핫플 버스", desc: "20~40대 /\n주요 관광 거점", photo: "seed/card-1.jpg" },
            { title: "시티투어 버스", desc: "주요 명소 /\n편리한 도시 관광", photo: "seed/card-2.jpg", accent: "y" },
            { title: "해외핫플 버스", desc: "해외 인기 관광지 /\n트렌디한 여행", photo: "seed/card-3.jpg" },
            { title: "핫플택시", desc: "프라이빗 여행", photo: "seed/card-4.jpg" },
            { title: "청춘버스", desc: "시니어 / 단체 /\n모임 전용 여행", photo: "seed/card-5.jpg" },
          ],
          note: "인천시티투어 노선 역시 같은 방식으로 상세페이지 · 콘텐츠를 제작해 판매합니다",
        },
      },
      {
        id: "s6",
        pageTypeId: "impact-photo",
        content: {
          photo: "seed/wide-1.jpg",
          eyebrow: "핫플트립 고객은",
          headline: "운전 걱정 없이, 하루를 온전히 즐깁니다",
          quote: "“운전 걱정 X 주차 걱정 X 오롯이 여행만 다니게끔…”  — 실제 고객 후기",
        },
      },
      { id: "s7", pageTypeId: "divider", content: { number: "02", title: "판매 구조" } },
      {
        id: "s8",
        pageTypeId: "process",
        content: {
          title: "판매·제휴 채널",
          subtitle: "자사몰과 여행 플랫폼, 폐쇄몰을 통해 다채널 유통 구조를 구축해 왔습니다.",
          steps: [
            { title: "자사몰", desc: "핫플트립 직접 판매" },
            { title: "여행 플랫폼", desc: "OTA · 액티비티 플랫폼" },
            { title: "폐쇄몰 · 제휴", desc: "복지몰 · 기업 제휴" },
          ],
        },
      },
      {
        id: "s9",
        pageTypeId: "closing",
        content: {
          message: "인천시티투어의 온라인 판로를 함께 넓히겠습니다.",
          thanks: "감사합니다.",
          contact: "핫플트립 · 02-374-0333",
        },
      },
    ],
  },
];
