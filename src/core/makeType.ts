/**
 * 페이지 타입 만들기
 *
 * 대표님이 직접 새 페이지 모양을 늘릴 수 있게 하는 조합기.
 * 뼈대와 칸 수만 고르면 좌표를 계산해서 페이지 타입 하나를 찍어 낸다.
 * 좌표는 기준판 10 × 5.625 인치(16:9) 기준이고, 본문은 x 0.6 ~ 9.4 를 쓴다.
 *
 * 만든 뒤에는 미리보기 화면에서 끌어 옮기고 크기를 바꿀 수 있다.
 */

import type { Element, PageType, Slot } from "./types";

export type Shape =
  | "제목과 글"
  | "제목과 사진"
  | "카드 열"
  | "숫자"
  | "표"
  | "목록"
  | "전면 사진";

export const SHAPES: { id: Shape; name: string; note: string; cols?: [number, number] }[] = [
  { id: "제목과 글", name: "제목 + 글", note: "제목 아래에 글만. 가장 단순합니다." },
  { id: "제목과 사진", name: "사진 + 글", note: "왼쪽 사진, 오른쪽 설명." },
  { id: "카드 열", name: "카드 열", note: "사진 + 제목 + 설명을 가로로 늘어놓습니다.", cols: [2, 5] },
  { id: "숫자", name: "숫자 강조", note: "큰 숫자와 이름을 가로로.", cols: [2, 4] },
  { id: "표", name: "표", note: "항목별로 줄을 세워 정리합니다.", cols: [2, 4] },
  { id: "목록", name: "글머리 목록", note: "항목마다 굵은 한 줄 + 설명." },
  { id: "전면 사진", name: "전면 사진", note: "사진을 가득 깔고 그 위에 흰 글씨." },
];

export interface MakeOpts {
  id: string;
  name: string;
  group: string;
  description: string;
  shape: Shape;
  /** 카드·숫자·표의 칸 수 */
  cols: number;
  createdAt: string;
}

const headSlots: Slot[] = [
  { key: "title", label: "페이지 제목", kind: "text", required: true },
  { key: "subtitle", label: "한 줄 설명", kind: "text" },
];

const headEls: Element[] = [
  { type: "text", bind: "title", x: 0.6, y: 0.42, w: 8.8, h: 0.55, token: "pageTitle", valign: "middle", required: true },
  { type: "text", bind: "subtitle", x: 0.6, y: 0.98, w: 8.8, h: 0.3, token: "subtitle", valign: "middle" },
];

export function makePageType(o: MakeOpts): PageType {
  const base = {
    id: o.id,
    name: o.name,
    description: o.description || SHAPES.find((s) => s.id === o.shape)?.note || "",
    group: o.group,
    builtIn: false,
    createdAt: o.createdAt,
  };
  const n = Math.max(2, Math.min(5, Math.round(o.cols)));

  switch (o.shape) {
    case "제목과 글":
      return {
        ...base,
        slots: [...headSlots, { key: "body", label: "본문", kind: "textarea", required: true }],
        elements: [
          ...headEls,
          { type: "line", x: 0.6, y: 1.5, w: 8.8, h: 0, color: "lineStrong" },
          { type: "text", bind: "body", x: 0.6, y: 1.72, w: 8.8, h: 3.1, token: "body", valign: "top", required: true },
        ],
        sample: { title: "제목을 적습니다", subtitle: "한 줄 설명", body: "여기에 본문을 적습니다." },
      };

    case "제목과 사진":
      return {
        ...base,
        slots: [
          ...headSlots,
          { key: "photo", label: "사진", kind: "image", required: true },
          { key: "heading", label: "소제목", kind: "text" },
          { key: "body", label: "설명", kind: "textarea", required: true },
        ],
        elements: [
          ...headEls,
          { type: "image", bind: "photo", x: 0.6, y: 1.5, w: 4.3, h: 3.3, fit: "cover" },
          { type: "line", x: 5.25, y: 1.5, w: 4.15, h: 0, color: "accent", weight: 1.5 },
          { type: "text", bind: "heading", x: 5.25, y: 1.64, w: 4.15, h: 0.4, token: "keyword", valign: "middle" },
          { type: "text", bind: "body", x: 5.25, y: 2.12, w: 4.15, h: 2.6, token: "body", valign: "top", required: true },
        ],
        sample: { title: "제목을 적습니다", subtitle: "한 줄 설명", heading: "소제목", body: "설명을 적습니다." },
      };

    case "카드 열": {
      const gap = 0.13;
      const w = (8.8 - gap * (n - 1)) / n;
      const photoH = n <= 2 ? 2.3 : n === 3 ? 1.95 : 1.85;
      const titleY = photoH + 0.25;
      return {
        ...base,
        slots: [
          ...headSlots,
          {
            key: "cards", label: "카드", kind: "list", max: n, required: true,
            itemSlots: [
              { key: "title", label: "카드 제목", kind: "text", required: true },
              { key: "desc", label: "설명", kind: "textarea" },
              { key: "photo", label: "사진", kind: "image" },
              { key: "accent", label: "코랄 선으로 강조", kind: "text", hint: "강조하려면 y 입력" },
            ],
          },
        ],
        elements: [
          ...headEls,
          {
            type: "repeat", over: "cards", origin: { x: 0.6, y: 1.5 }, step: { x: w + gap }, max: n,
            elements: [
              { type: "line", x: 0, y: 0, w, h: 0, color: "lineStrong", hideIf: "accent" },
              { type: "line", x: 0, y: 0, w, h: 0, color: "accent", weight: 1.5, showIf: "accent" },
              { type: "image", bind: "photo", x: 0.08, y: 0.1, w: w - 0.16, h: photoH, fit: "cover" },
              { type: "text", bind: "title", x: 0.12, y: titleY, w: w - 0.24, h: 0.34, token: "cardTitle", valign: "middle", required: true },
              { type: "text", bind: "desc", x: 0.12, y: titleY + 0.38, w: w - 0.24, h: 1.0, size: 10.5, color: "muted", valign: "top" },
            ],
          },
        ],
        sample: {
          title: "제목을 적습니다", subtitle: "한 줄 설명",
          cards: Array.from({ length: n }, (_, i) => ({ title: `항목 ${i + 1}`, desc: "설명" })),
        },
      };
    }

    case "숫자": {
      const w = (8.8 - 0.13 * (n - 1)) / n;
      return {
        ...base,
        slots: [
          ...headSlots,
          {
            key: "items", label: "숫자", kind: "list", max: n, required: true,
            itemSlots: [
              { key: "value", label: "숫자", kind: "text", required: true },
              { key: "unit", label: "단위", kind: "text" },
              { key: "label", label: "이름", kind: "text", required: true },
              { key: "desc", label: "설명", kind: "textarea" },
            ],
          },
          { key: "note", label: "아래 한 줄 문장", kind: "text" },
        ],
        elements: [
          ...headEls,
          {
            type: "repeat", over: "items", origin: { x: 0.6, y: 1.75 }, step: { x: w + 0.13 }, max: n,
            elements: [
              { type: "line", x: 0, y: 0, w, h: 0, color: "lineStrong" },
              { type: "text", bind: "value", x: 0, y: 0.22, w: w - 0.6, h: 0.7, token: "keyNumber", valign: "middle", required: true },
              { type: "text", bind: "unit", x: w - 0.6, y: 0.5, w: 0.6, h: 0.4, token: "caption", valign: "middle" },
              { type: "text", bind: "label", x: 0, y: 1.0, w, h: 0.32, token: "cardTitle", valign: "middle", required: true },
              { type: "text", bind: "desc", x: 0, y: 1.38, w, h: 1.0, size: 10, color: "muted", valign: "top" },
            ],
          },
          { type: "text", bind: "note", x: 0.6, y: 4.6, w: 8.8, h: 0.42, size: 12.5, bold: true, align: "center", valign: "middle" },
        ],
        sample: {
          title: "제목을 적습니다", subtitle: "한 줄 설명",
          items: Array.from({ length: n }, (_, i) => ({ value: `${(i + 1) * 10}`, unit: "건", label: `이름 ${i + 1}` })),
        },
      };
    }

    case "표": {
      const cols = Math.max(2, Math.min(4, n));
      const w = 8.8 / cols;
      const keys = ["label", "v1", "v2", "v3"].slice(0, cols);
      const rowEls: Element[] = keys.map((k, i) => ({
        type: "text", bind: k, x: i * w, y: 0.05, w: w - 0.15, h: 0.34,
        token: i === 0 ? "rowLabel" : "body", valign: "middle", required: i === 0,
      }));
      rowEls.push({ type: "line", x: 0, y: 0.45, w: 8.8, h: 0, color: "line" });
      return {
        ...base,
        slots: [
          ...headSlots,
          ...keys.map((k, i) => ({ key: `col${i + 1}`, label: `${i + 1}번째 칸 이름`, kind: "text" as const })),
          {
            key: "rows", label: "줄", kind: "list", max: 6, required: true,
            itemSlots: keys.map((k, i) => ({
              key: k, label: i === 0 ? "항목" : `${i + 1}번째 칸`, kind: "text" as const, required: i === 0,
            })),
          },
        ],
        elements: [
          ...headEls,
          ...keys.map((_, i) => ({
            type: "text" as const, bind: `col${i + 1}`, x: 0.6 + i * w, y: 1.5, w: w - 0.15, h: 0.3,
            token: "caption", valign: "middle" as const,
          })),
          { type: "line", x: 0.6, y: 1.84, w: 8.8, h: 0, color: "ink", weight: 1.2 },
          { type: "repeat", over: "rows", origin: { x: 0.6, y: 1.94 }, step: { y: 0.5 }, max: 6, elements: rowEls },
        ],
        sample: {
          title: "제목을 적습니다", subtitle: "한 줄 설명",
          ...Object.fromEntries(keys.map((_, i) => [`col${i + 1}`, i === 0 ? "항목" : `칸 ${i + 1}`])),
          rows: [
            Object.fromEntries(keys.map((k, i) => [k, i === 0 ? "첫째 줄" : "내용"])),
            Object.fromEntries(keys.map((k, i) => [k, i === 0 ? "둘째 줄" : "내용"])),
          ],
        },
      };
    }

    case "목록":
      return {
        ...base,
        slots: [
          ...headSlots,
          {
            key: "items", label: "항목", kind: "list", max: 6, required: true,
            itemSlots: [
              { key: "label", label: "항목", kind: "text", required: true },
              { key: "desc", label: "설명", kind: "textarea" },
            ],
          },
        ],
        elements: [
          ...headEls,
          {
            type: "repeat", over: "items", origin: { x: 0.6, y: 1.55 }, step: { y: 0.56 }, max: 6,
            elements: [
              { type: "line", x: 0, y: 0.17, w: 0.14, h: 0, color: "accent", weight: 1.5 },
              { type: "text", bind: "label", x: 0.3, y: 0, w: 8.4, h: 0.3, size: 13, bold: true, valign: "middle", required: true },
              { type: "text", bind: "desc", x: 0.3, y: 0.28, w: 8.4, h: 0.26, token: "caption", valign: "middle" },
            ],
          },
        ],
        sample: {
          title: "제목을 적습니다", subtitle: "한 줄 설명",
          items: [{ label: "항목 1", desc: "설명" }, { label: "항목 2", desc: "설명" }],
        },
      };

    case "전면 사진":
      return {
        ...base,
        showPageNo: false,
        slots: [
          { key: "photo", label: "배경 사진", kind: "image", required: true },
          { key: "headline", label: "큰 글씨", kind: "textarea", required: true },
          { key: "note", label: "아래 한 줄", kind: "text" },
        ],
        elements: [
          { type: "image", bind: "photo", x: 0, y: 0, w: 10, h: 5.625, fit: "cover" },
          { type: "scrim", x: 0, y: 0, w: 10, h: 5.625, color: "ink", alpha: 0.45 },
          { type: "line", x: 0.9, y: 2.3, w: 0.7, h: 0, color: "accent", weight: 2.5 },
          { type: "text", bind: "headline", x: 0.9, y: 2.55, w: 8.2, h: 1.5, token: "overlay", valign: "top", required: true },
          { type: "text", bind: "note", x: 0.9, y: 4.2, w: 8.2, h: 0.32, size: 11, color: "white", valign: "middle" },
        ],
        sample: { headline: "하고 싶은 말을\n한두 줄로 적습니다", note: "덧붙이는 한 줄" },
      };
  }
}
