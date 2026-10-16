/**
 * 사무용 문서에서 글만 뽑아낸다.
 *
 *   워드(.docx) · 파워포인트(.pptx) · 엑셀(.xlsx) · 한글(.hwpx, .hwp)
 *
 * 속을 들여다보면 둘 중 하나다.
 *   ① 압축 묶음(zip) 안에 XML 이 들어 있는 것  — docx, pptx, xlsx, hwpx
 *   ② 옛 방식의 한 덩어리 파일(OLE2)          — hwp
 *
 * 무거운 부품은 실제로 그런 파일을 열 때만 불러온다.
 */

export interface Extracted {
  text: string;
  /** 못 읽었을 때 사람에게 할 말 */
  note?: string;
}

/** 파일 앞머리를 보고 종류를 가린다. 확장자는 틀릴 수 있다. */
export function sniff(buf: ArrayBuffer): "zip" | "ole2" | "기타" {
  const b = new Uint8Array(buf.slice(0, 8));
  if (b[0] === 0x50 && b[1] === 0x4b) return "zip";                       // PK
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return "ole2";
  return "기타";
}

/* ─────────────────────────── 공통 ─────────────────────────── */

const unesc = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
   .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
   .replace(/&amp;/g, "&");

/** 한 조각에서 특정 태그의 글자만 이어 붙인다 */
function runs(frag: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g");
  let out = "";
  for (const m of frag.matchAll(re)) out += unesc(m[1]);
  return out;
}

/** 문단 단위로 끊어 읽는다 */
function paragraphs(xml: string, para: string, run: string): string[] {
  return xml
    .split(new RegExp(`</${para}>`))
    .map((p) => runs(p, run).trim())
    .filter(Boolean);
}

const dec = new TextDecoder("utf-8");

/* ─────────────────────── 압축 묶음(zip) ─────────────────────── */

async function openZip(buf: ArrayBuffer): Promise<Record<string, Uint8Array>> {
  const { unzipSync } = await import("fflate");
  return unzipSync(new Uint8Array(buf));
}

/** 묶음 안을 보고 무슨 문서인지 가린다 */
function zipKind(files: Record<string, Uint8Array>): "docx" | "pptx" | "xlsx" | "hwpx" | null {
  const has = (p: string) => Object.keys(files).some((k) => k.startsWith(p));
  if (files["word/document.xml"]) return "docx";
  if (has("ppt/slides/slide")) return "pptx";
  if (files["xl/workbook.xml"]) return "xlsx";
  if (has("Contents/section") || files["mimetype"]) return "hwpx";
  return null;
}

/** 번호가 붙은 파일들을 1,2,10 순서로 (1,10,2 가 되지 않게) */
const byNumber = (names: string[]) =>
  names.sort((a, b) => (+(a.match(/(\d+)\D*$/)?.[1] ?? 0)) - (+(b.match(/(\d+)\D*$/)?.[1] ?? 0)));

function fromDocx(f: Record<string, Uint8Array>): string {
  const xml = dec.decode(f["word/document.xml"]);
  return paragraphs(xml.replace(/<w:tab\/>/g, "\t"), "w:p", "w:t").join("\n");
}

function fromPptx(f: Record<string, Uint8Array>): string {
  const slides = byNumber(Object.keys(f).filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k)));
  const notes = (n: number) => {
    const k = `ppt/notesSlides/notesSlide${n}.xml`;
    if (!f[k]) return "";
    const t = paragraphs(dec.decode(f[k]), "a:p", "a:t").join(" ").trim();
    return t ? `\n  (발표자 노트) ${t}` : "";
  };
  return slides
    .map((k, i) => {
      const lines = paragraphs(dec.decode(f[k]), "a:p", "a:t");
      return `[${i + 1}장] ${lines.join("\n")}${notes(i + 1)}`;
    })
    .join("\n\n");
}

function fromXlsx(f: Record<string, Uint8Array>): string {
  // 공용 문자열 표 — 셀이 번호로만 가리키는 경우가 많다
  const shared: string[] = [];
  if (f["xl/sharedStrings.xml"]) {
    const xml = dec.decode(f["xl/sharedStrings.xml"]);
    for (const m of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(runs(m[1], "t"));
  }
  const sheets = byNumber(Object.keys(f).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)));
  return sheets
    .map((k, i) => {
      const xml = dec.decode(f[k]);
      const rows: string[] = [];
      for (const r of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
        const cells: string[] = [];
        for (const c of r[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
          const v = runs(c[2], "v");
          const inline = runs(c[2], "t");
          cells.push(/t="s"/.test(c[1]) ? (shared[+v] ?? "") : (inline || v));
        }
        const line = cells.join("\t").trim();
        if (line) rows.push(line);
      }
      return rows.length ? `[${i + 1}번째 시트]\n${rows.join("\n")}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function fromHwpx(f: Record<string, Uint8Array>): string {
  const secs = byNumber(Object.keys(f).filter((k) => /^Contents\/section\d+\.xml$/i.test(k)));
  return secs
    .map((k) => paragraphs(dec.decode(f[k]), "hp:p", "hp:t").join("\n"))
    .filter(Boolean)
    .join("\n");
}

/* ───────────────────── 옛 한글 파일(.hwp) ───────────────────── */

/** 글자 묶음 기록의 번호 */
const PARA_TEXT = 67;
/** 글자 사이에 끼어 있는 조종 문자 — 8글자 자리를 차지한다 */
const WIDE_CONTROL = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);

async function fromHwp(buf: ArrayBuffer): Promise<Extracted> {
  const [CFB, fflate] = await Promise.all([import("cfb"), import("fflate")]);
  const bag = CFB.read(new Uint8Array(buf), { type: "array" });

  const head = bag.FileIndex.find((e: any) => e.name === "FileHeader");
  if (!head?.content) return { text: "", note: "한글 파일의 머리말을 찾지 못했습니다." };

  const hv = new DataView(Uint8Array.from(head.content as any).buffer);
  const props = hv.getUint32(36, true);
  const compressed = (props & 0x01) !== 0;
  if ((props & 0x02) !== 0) {
    return { text: "", note: "암호가 걸린 한글 파일입니다. 암호를 풀고 다시 올려 주십시오." };
  }
  if ((props & 0x04) !== 0) {
    return { text: "", note: "배포용(읽기 전용)으로 만든 한글 파일이라 글을 꺼낼 수 없습니다. 원본이나 PDF 로 올려 주십시오." };
  }

  // 본문은 Section0, Section1 … 으로 나뉘어 있다
  const secs = bag.FileIndex
    .map((e: any, i: number) => ({ e, path: bag.FullPaths[i] as string }))
    .filter((x) => /BodyText[\/\\]Section\d+$/i.test(x.path))
    .sort((a, b) => (+(a.path.match(/(\d+)$/)?.[1] ?? 0)) - (+(b.path.match(/(\d+)$/)?.[1] ?? 0)));

  if (!secs.length) return { text: "", note: "한글 파일에서 본문을 찾지 못했습니다." };

  const out: string[] = [];
  for (const { e } of secs) {
    let data = Uint8Array.from(e.content as any);
    if (compressed) {
      try { data = fflate.inflateSync(data); } catch { continue; }
    }
    out.push(readRecords(data));
  }
  const text = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return text ? { text } : { text: "", note: "한글 파일에 글자가 없습니다." };
}

/** 기록을 하나씩 훑어 글자 묶음만 꺼낸다 */
function readRecords(data: Uint8Array): string {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const out: string[] = [];
  let p = 0;
  while (p + 4 <= data.length) {
    const header = dv.getUint32(p, true);
    p += 4;
    const tag = header & 0x3ff;
    let size = (header >> 20) & 0xfff;
    if (size === 0xfff) {
      if (p + 4 > data.length) break;
      size = dv.getUint32(p, true);
      p += 4;
    }
    if (p + size > data.length) break;
    if (tag === PARA_TEXT) out.push(readParaText(dv, p, size));
    p += size;
  }
  return out.filter((s) => s.trim()).join("\n");
}

/** 한 문단의 글자. 두 바이트가 한 글자이고, 32 미만은 조종 문자다. */
function readParaText(dv: DataView, at: number, size: number): string {
  let s = "";
  const n = Math.floor(size / 2);
  for (let i = 0; i < n; i++) {
    const c = dv.getUint16(at + i * 2, true);
    if (c === 13 || c === 10) { s += "\n"; continue; }
    if (c === 9) { s += "\t"; i += 7; continue; }       // 탭은 자리를 8글자 차지한다
    if (c < 32) { if (WIDE_CONTROL.has(c)) i += 7; continue; }
    s += String.fromCharCode(c);
  }
  return s;
}

/* ─────────────────────────── 입구 ─────────────────────────── */

/** 사무용 문서에서 글을 꺼낸다. 못 꺼내면 왜인지 말해 준다. */
export async function readOffice(buf: ArrayBuffer, name: string): Promise<Extracted> {
  const kind = sniff(buf);

  if (kind === "ole2") {
    if (/\.hwp$/i.test(name)) return fromHwp(buf);
    return {
      text: "",
      note: "옛 방식(97~2003)으로 저장된 파일입니다. 지금 쓰는 형식(.docx · .pptx · .xlsx)이나 PDF 로 저장해 올려 주십시오.",
    };
  }

  if (kind !== "zip") {
    return { text: "", note: "읽을 수 없는 형식입니다." };
  }

  let files: Record<string, Uint8Array>;
  try { files = await openZip(buf); }
  catch { return { text: "", note: "파일이 깨져 있어 열지 못했습니다." }; }

  const what = zipKind(files);
  const text =
    what === "docx" ? fromDocx(files)
    : what === "pptx" ? fromPptx(files)
    : what === "xlsx" ? fromXlsx(files)
    : what === "hwpx" ? fromHwpx(files)
    : "";

  if (!what) return { text: "", note: "읽을 수 없는 형식입니다." };
  if (!text.trim()) {
    return { text: "", note: "글자가 없는 문서입니다 (사진만 들어 있을 수 있습니다)." };
  }
  return { text };
}
