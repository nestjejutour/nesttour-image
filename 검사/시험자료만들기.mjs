import { zipSync, strToU8, deflateSync } from "fflate";
import CFB from "cfb";
import { writeFileSync } from "fs";
const OUT = process.argv[2] || "/tmp/claude-0/-home-user-nesttour-image/503da243-c6eb-561b-b5d2-32ad2b29269f/scratchpad";
const enc = (s) => strToU8(s);

/* ── 워드 ── */
const docx = zipSync({
  "[Content_Types].xml": enc('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
  "word/document.xml": enc(`<?xml version="1.0"?><w:document xmlns:w="x"><w:body>
<w:p><w:r><w:t>인천시티투어 온라인 판로 확대 용역</w:t></w:r></w:p>
<w:p><w:r><w:t>제안요청서</w:t></w:r></w:p>
<w:p><w:r><w:t>사업기간: </w:t></w:r><w:r><w:t>2026년 3월 ~ 12월</w:t></w:r></w:p>
<w:p><w:r><w:t>사업예산: 1억 2천만원(부가세 포함)</w:t></w:r></w:p>
</w:body></w:document>`),
});
writeFileSync(`${OUT}/제안요청서.docx`, docx);

/* ── 파워포인트 ── */
const slide = (t) => enc(`<?xml version="1.0"?><p:sld xmlns:p="x" xmlns:a="y"><p:cSld><p:spTree>
<p:sp><p:txBody>${t.map(x=>`<a:p><a:r><a:t>${x}</a:t></a:r></a:p>`).join("")}</p:txBody></p:sp>
</p:spTree></p:cSld></p:sld>`);
const pptx = zipSync({
  "[Content_Types].xml": enc('<?xml version="1.0"?><Types/>'),
  "ppt/slides/slide1.xml": slide(["인천시티투어 제안", "핫플트립"]),
  "ppt/slides/slide2.xml": slide(["현황 진단", "현장 창구 판매에 몰려 있음"]),
  "ppt/slides/slide10.xml": slide(["마무리", "함께 넓히겠습니다"]),
  "ppt/notesSlides/notesSlide1.xml": enc('<?xml version="1.0"?><x xmlns:a="y"><a:p><a:r><a:t>표지는 10초 안에 넘긴다</a:t></a:r></a:p></x>'),
});
writeFileSync(`${OUT}/회사소개.pptx`, pptx);

/* ── 엑셀 ── */
const xlsx = zipSync({
  "xl/workbook.xml": enc('<?xml version="1.0"?><workbook/>'),
  "xl/sharedStrings.xml": enc('<?xml version="1.0"?><sst><si><t>항목</t></si><si><t>금액</t></si><si><t>운영 대행</t></si></sst>'),
  "xl/worksheets/sheet1.xml": enc(`<?xml version="1.0"?><worksheet><sheetData>
<row><c t="s"><v>0</v></c><c t="s"><v>1</v></c></row>
<row><c t="s"><v>2</v></c><c><v>30000000</v></c></row>
</sheetData></worksheet>`),
});
writeFileSync(`${OUT}/견적.xlsx`, xlsx);

/* ── 한글 (새 형식 .hwpx) ── */
const hwpx = zipSync({
  "mimetype": enc("application/hwp+zip"),
  "Contents/section0.xml": enc(`<?xml version="1.0"?><hs:sec xmlns:hp="x" xmlns:hs="y">
<hp:p><hp:run><hp:t>인천관광공사 제안요청서</hp:t></hp:run></hp:p>
<hp:p><hp:run><hp:t>1. 사업명: 인천시티투어 온라인 판로 확대</hp:t></hp:run></hp:p>
<hp:p><hp:run><hp:t>2. 제안서 제출기한: 2026. 2. 28.</hp:t></hp:run></hp:p>
</hs:sec>`),
});
writeFileSync(`${OUT}/제안요청서.hwpx`, hwpx);

/* ── 한글 (옛 형식 .hwp) ── */
function paraRecord(text) {
  const body = new Uint8Array(text.length * 2);
  const dv = new DataView(body.buffer);
  for (let i = 0; i < text.length; i++) dv.setUint16(i * 2, text.charCodeAt(i), true);
  const head = new Uint8Array(4);
  // tag 67, level 0, size
  new DataView(head.buffer).setUint32(0, (67 & 0x3ff) | (0 << 10) | ((body.length & 0xfff) << 20), true);
  return [head, body];
}
const parts = ["인천관광공사 제안요청서", "사업예산 금 일억이천만원", "제출기한 2026. 2. 28."]
  .flatMap((t) => paraRecord(t));
const section = new Uint8Array(parts.reduce((n, a) => n + a.length, 0));
{ let o = 0; for (const a of parts) { section.set(a, o); o += a.length; } }

const fileHeader = new Uint8Array(256);
fileHeader.set(enc("HWP Document File"), 0);
new DataView(fileHeader.buffer).setUint32(36, 1, true);   // 1 = 압축됨

const cfb = CFB.utils.cfb_new();
CFB.utils.cfb_add(cfb, "/FileHeader", fileHeader);
CFB.utils.cfb_add(cfb, "/BodyText/Section0", deflateSync(section));
writeFileSync(`${OUT}/제안요청서.hwp`, CFB.write(cfb, { type: "buffer" }));

console.log("만든 파일: docx, pptx, xlsx, hwpx, hwp");
