import type { Content } from "./types";

/**
 * 내용의 한 자리에 값을 넣는다.
 * 자리 표기는 "title1" 또는 "cards.2.title" 처럼 쓴다.
 */
export function setAt(content: Content, path: string, value: unknown): Content {
  const parts = path.split(".");
  if (parts.length === 1) return { ...content, [parts[0]]: value };

  const [key, idxRaw, inner] = parts;
  const idx = Number(idxRaw);
  const arr = Array.isArray(content[key]) ? [...content[key]] : [];
  arr[idx] = { ...(arr[idx] ?? {}), [inner]: value };
  return { ...content, [key]: arr };
}

export function getAt(content: Content, path: string): unknown {
  const parts = path.split(".");
  if (parts.length === 1) return content[parts[0]];
  const [key, idxRaw, inner] = parts;
  const arr = content[key];
  return Array.isArray(arr) ? arr[Number(idxRaw)]?.[inner] : undefined;
}
