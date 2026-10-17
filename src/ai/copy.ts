import type { Content, PageType, Rule, StylePreset } from "../core/types";
import { 비신뢰원칙 } from "./brain";

/**
 * 카피 작업실 — 글만 다루는 창구 (ChatGPT)
 *
 * 역할을 나눈다.
 *   Claude  : 화면을 보고 레이아웃·구성·규격
 *   ChatGPT : 글만. 카피·톤·길이
 *
 * 둘 다 같은 규칙 창고를 읽는다. 안 그러면 ChatGPT 가
 * 대표가 쌓아둔 원칙 밖의 문구를 뱉고, 그걸 다시 고치느라 일이 늘어난다.
 */

export interface CopyField {
  /** 내용에서의 자리. 예: "title1", "cards.2.desc" */
  path: string;
  label: string;
  text: string;
}

/** 페이지에서 "글"만 끄집어낸다. 사진 경로·빈 칸은 뺀다. */
export function pullCopy(pageType: PageType, content: Content): CopyField[] {
  const out: CopyField[] = [];
  const isText = (v: unknown): v is string =>
    typeof v === "string" && v.trim() !== "" &&
    !v.startsWith("data:") && !/\.(png|jpe?g|webp|svg|gif)$/i.test(v);

  for (const s of pageType.slots) {
    if (s.kind === "image") continue;
    if (s.kind === "list") {
      const arr = content[s.key];
      if (!Array.isArray(arr)) continue;
      arr.forEach((item, i) => {
        for (const is of s.itemSlots ?? []) {
          if (is.kind === "image") continue;
          const v = item?.[is.key];
          if (isText(v)) out.push({ path: `${s.key}.${i}.${is.key}`, label: `${s.label} ${i + 1} · ${is.label}`, text: v });
        }
      });
      continue;
    }
    const v = content[s.key];
    if (isText(v)) out.push({ path: s.key, label: s.label, text: v });
  }
  return out;
}

/** 다듬은 글을 페이지에 도로 넣는다 */
export function pushCopy(content: Content, fields: CopyField[]): Content {
  const next = structuredClone(content);
  for (const f of fields) {
    const parts = f.path.split(".");
    if (parts.length === 1) {
      next[parts[0]] = f.text;
    } else {
      const [key, idx, inner] = parts;
      const arr = next[key];
      if (Array.isArray(arr) && arr[Number(idx)]) arr[Number(idx)][inner] = f.text;
    }
  }
  return next;
}

export function copySystem(opts: {
  style: StylePreset;
  rules: Rule[];
  pageType: PageType;
}): string {
  const { style, rules, pageType } = opts;
  const ruleText = rules.map((r, i) => `${i + 1}. ${r.text}`).join("\n");

  return `당신은 ${style.brand}의 제안서 문구를 다듬는 카피라이터다.
레이아웃과 디자인은 다른 사람이 맡는다. 당신은 글만 본다.

[지켜야 할 원칙 — 대표가 쌓아온 것이다]
${ruleText || "(아직 없음)"}

[지금 페이지]
${pageType.name} — ${pageType.description}

[글쓰기]
- 한국어. 간결하고 단정하게. 과장·형용사 남발 금지.
- 숫자는 천 단위 쉼표를 넣는다. 없는 숫자를 지어내지 마라.
- 칸마다 들어갈 자리가 정해져 있다. 제목 칸은 제목답게 짧게, 설명 칸은 한 호흡으로.
- 원래 뜻을 바꾸지 마라. 사실을 바꾸지 마라. 표현만 다듬어라.

${비신뢰원칙}

[대답 형식]
받은 목록과 같은 path 를 그대로 쓴 JSON 만 출력하라. 설명·코드펜스 금지.
{"fields":[{"path":"...","text":"다듬은 글"}],"say":"무엇을 바꿨는지 한 문장"}
고칠 필요가 없는 칸은 빼라.`;
}
