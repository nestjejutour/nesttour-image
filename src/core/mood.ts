import type { PageType, Project } from "./types";

/**
 * 분위기 꼬리표를 "자동으로" 붙인다.
 *
 * 대표님이 태그를 일일이 달 리가 없다.
 * 그래서 완성본의 생김새(어떤 페이지를 몇 장 썼는지, 사진이 얼마나 들었는지)를
 * 보고 프로그램이 알아서 붙인다. AI 를 부르지 않으므로 즉시, 공짜로 된다.
 */

export type Mood =
  | "사진 중심"
  | "숫자 중심"
  | "표로 정리형"
  | "글자 중심"
  | "장 구분 뚜렷"
  | "짧은 제안"
  | "본격 제안";

const NUMBERY = new Set(["impact-numbers", "summary"]);
const TABLEY = new Set(["cards-3", "cards-4", "cards-5", "process", "grid-2x2", "screens"]);
const PHOTOY = new Set(["cover-photo", "impact-photo", "cards-5", "screens", "logo-wall"]);

export function moodsOf(p: Project, pageTypes: PageType[]): Mood[] {
  const n = p.slides.length;
  if (!n) return [];

  const typeOf = (id: string) => pageTypes.find((t) => t.id === id);
  const out: Mood[] = [];

  let numbery = 0;
  let tabley = 0;
  let dividers = 0;
  let withPhoto = 0;

  for (const s of p.slides) {
    if (NUMBERY.has(s.pageTypeId)) numbery++;
    if (TABLEY.has(s.pageTypeId)) tabley++;
    if (s.pageTypeId === "divider") dividers++;

    // 사진이 실제로 들어간 페이지인지 센다 (타입만 보지 않는다)
    const t = typeOf(s.pageTypeId);
    const hasPhoto =
      !!t &&
      t.slots.some((slot) => {
        if (slot.kind === "image") return !!s.content[slot.key];
        if (slot.kind === "list" && slot.itemSlots?.some((x) => x.kind === "image")) {
          const arr = s.content[slot.key];
          return Array.isArray(arr) && arr.some((it: any) => slot.itemSlots!.some((x) => it?.[x.key]));
        }
        return false;
      });
    if (hasPhoto) withPhoto++;
  }

  if (withPhoto / n >= 0.35) out.push("사진 중심");
  if (numbery >= 2) out.push("숫자 중심");
  if (tabley >= 2) out.push("표로 정리형");
  if (PHOTOY.size && withPhoto / n < 0.15) out.push("글자 중심");
  if (dividers >= 2) out.push("장 구분 뚜렷");
  if (n <= 8) out.push("짧은 제안");
  else if (n >= 15) out.push("본격 제안");

  return out;
}

/** 고객사 이름으로 고객 유형을 짐작한다 */
export function clientKind(client: string): "공공기관" | "기업" | "미분류" {
  if (!client.trim()) return "미분류";
  return /공사|공단|재단|진흥원|시청|도청|군청|구청|협회|위원회|[시도군구]$/.test(client)
    ? "공공기관"
    : "기업";
}
