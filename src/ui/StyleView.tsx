import type { DB } from "../store/db";

/** 창고 1·2 — 스타일과 페이지 타입을 들여다보는 화면 */
export function StyleView({ db }: { db: DB }) {
  const s = db.styles[0];
  const colorNames: Record<string, string> = {
    ink: "본문 글자", muted: "흐린 글자", line: "얇은 선", lineStrong: "진한 선",
    background: "바탕", accent: "강조 (코랄)", white: "흰색", todo: "빈칸 표시",
  };
  const typeNames: Record<string, string> = {
    coverTitleBold: "표지 제목 (굵게)", coverTitleThin: "표지 제목 (얇게)",
    pageTitle: "페이지 제목", subtitle: "부제", body: "본문", caption: "작은 설명",
    keyNumber: "핵심 숫자", keyNumberBig: "큰 숫자", sectionNo: "구분 장 번호",
    keyword: "핵심 단어", rowLabel: "항목명", cardNo: "카드 번호",
    cardTitle: "카드 제목", overlay: "사진 위 글씨",
  };

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <h1>{s.name}</h1>
      <p className="lede">
        모든 페이지가 이 값을 가져다 씁니다. 여기 숫자를 바꾸면 만든 제안서 전체가 한 번에 바뀝니다.
      </p>

      <p className="sec">판 크기</p>
      <table className="spec"><tbody>
        <tr><td>비율</td><td>16:9 · {s.slide.widthIn} × {s.slide.heightIn} 인치</td></tr>
        <tr><td>글꼴</td><td>{s.font.family} (없으면 {s.font.fallback[0]})</td></tr>
        <tr><td>얇은 선 두께</td><td>{s.hairline}pt</td></tr>
      </tbody></table>

      <p className="sec">색</p>
      <table className="spec"><tbody>
        {Object.entries(s.color).map(([k, v]) => (
          <tr key={k}><td>{colorNames[k] ?? k}</td>
            <td><span className="swatch" style={{ background: v }} />{v}</td></tr>
        ))}
      </tbody></table>

      <p className="sec">글자 크기</p>
      <table className="spec"><tbody>
        {Object.entries(s.type).map(([k, v]) => (
          <tr key={k}><td>{typeNames[k] ?? k}</td>
            <td>{v.size}pt {v.bold ? "· 굵게" : ""} {v.color ? `· ${colorNames[v.color] ?? v.color}` : ""}</td></tr>
        ))}
      </tbody></table>

      <p className="sec">페이지 타입 {db.pageTypes.length}종</p>
      <table className="spec"><tbody>
        {db.pageTypes.map((t) => (
          <tr key={t.id}><td>{t.name}</td><td>{t.description}</td></tr>
        ))}
      </tbody></table>

      <p className="sec">분류 {db.categories.length}개</p>
      <table className="spec"><tbody>
        {db.categories.map((c) => (
          <tr key={c.id}><td>{c.name}</td><td>{c.kind}</td></tr>
        ))}
      </tbody></table>
    </div>
  );
}
