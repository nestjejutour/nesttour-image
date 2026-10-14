import { useState } from "react";
import type { StylePreset } from "../core/types";
import { uid, type DB } from "../store/db";

/**
 * 창고 1 — 스타일
 *
 * 브랜드가 늘면 목록이어야 한다.
 * 목록에서 하나를 고르면 그 규격을 들여다본다.
 */
export function StyleView({ db, setDb }: { db: DB; setDb: (f: (d: DB) => DB) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBrand, setNewBrand] = useState("");

  const usedBy = (id: string) => db.projects.filter((p) => p.styleId === id).length;
  const rulesOf = (id: string) => db.rules.filter((r) => r.scope === "스타일" && r.scopeId === id).length;

  const duplicate = () => {
    if (!newName.trim()) return;
    const base = db.styles[0];
    const s: StylePreset = {
      ...structuredClone(base),
      id: uid(),
      name: newName.trim(),
      brand: newBrand.trim() || newName.trim(),
      version: 1,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    setDb((d) => ({ ...d, styles: [...d.styles, s] }));
    setNewName(""); setNewBrand(""); setAdding(false);
  };

  const open = db.styles.find((s) => s.id === openId);
  if (open) return <Detail s={open} onBack={() => setOpenId(null)} db={db} />;

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <h1>스타일</h1>
      <p className="lede">
        브랜드별 디자인 규격입니다. 제안서는 하나를 골라 씁니다.
        규격을 바꾸면 그 스타일을 쓰는 제안서 전체가 한 번에 바뀝니다.
      </p>

      <div className="cards">
        {db.styles.map((s) => (
          <button className="card" key={s.id} onClick={() => setOpenId(s.id)}>
            <div className="thumb" style={{ background: s.color.background, position: "relative" }}>
              <div style={{ textAlign: "left", width: "100%", padding: "0 18px" }}>
                <div style={{ width: 34, height: 3, background: s.color.accent, marginBottom: 11 }} />
                <div style={{ fontSize: 19, fontWeight: 700, color: s.color.ink, lineHeight: 1.25 }}>
                  {s.brand}
                </div>
                <div style={{ fontSize: 15, color: s.color.ink }}>제안서 표지</div>
                <div style={{ fontSize: 10, color: s.color.muted, marginTop: 7 }}>
                  {s.font.family} · {s.slide.widthIn}×{s.slide.heightIn}in
                </div>
              </div>
            </div>
            <div className="meta">
              <b>{s.name}</b>
              <small>{s.brand} · 규칙 {rulesOf(s.id)}개 · 쓰는 제안서 {usedBy(s.id)}건</small>
              <div className="chips">
                {["ink", "muted", "line", "accent"].map((k) => (
                  <span className="swatch" key={k} style={{ background: s.color[k] }} />
                ))}
              </div>
              <span className="cta">규격 보기 →</span>
            </div>
          </button>
        ))}

        {adding ? (
          <div className="card" style={{ padding: 14 }}>
            <div className="field">
              <label>스타일 이름</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="예: 엔이에스티투어 기업형" />
            </div>
            <div className="field">
              <label>브랜드</label>
              <input value={newBrand} onChange={(e) => setNewBrand(e.target.value)}
                placeholder="예: 엔이에스티투어" />
            </div>
            <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "0 0 10px" }}>
              지금 스타일을 복제해서 만듭니다. 색·크기는 만든 뒤에 고치면 됩니다.
            </p>
            <div className="row">
              <button className="btn primary" onClick={duplicate} disabled={!newName.trim()}>만들기</button>
              <button className="btn" onClick={() => setAdding(false)}>취소</button>
            </div>
          </div>
        ) : (
          <button className="card" style={{ alignItems: "center", justifyContent: "center", minHeight: 210,
            border: "1px dashed var(--line)", color: "var(--muted)" }}
            onClick={() => setAdding(true)}>
            + 스타일 추가
          </button>
        )}
      </div>

      <p className="sec">페이지 타입 {db.pageTypes.length}종</p>
      <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 0 }}>
        모든 스타일이 같은 페이지 타입을 함께 씁니다. 색·글꼴만 스타일을 따릅니다.
      </p>
      <table className="spec"><tbody>
        {db.pageTypes.map((t) => (
          <tr key={t.id}><td>{t.name}</td><td>{t.description}</td></tr>
        ))}
      </tbody></table>
    </div>
  );
}

const COLOR_NAMES: Record<string, string> = {
  ink: "본문 글자", muted: "흐린 글자", line: "얇은 선", lineStrong: "진한 선",
  background: "바탕", accent: "강조 (코랄)", white: "흰색", todo: "빈칸 표시",
};
const TYPE_NAMES: Record<string, string> = {
  coverTitleBold: "표지 제목 (굵게)", coverTitleThin: "표지 제목 (얇게)",
  pageTitle: "페이지 제목", subtitle: "부제", body: "본문", caption: "작은 설명",
  keyNumber: "핵심 숫자", keyNumberBig: "큰 숫자", sectionNo: "구분 장 번호",
  keyword: "핵심 단어", rowLabel: "항목명", cardNo: "카드 번호",
  cardTitle: "카드 제목", overlay: "사진 위 글씨",
};

function Detail({ s, onBack, db }: { s: StylePreset; onBack: () => void; db: DB }) {
  const myRules = db.rules.filter((r) => r.scope === "스타일" && r.scopeId === s.id);

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <button className="btn sm" style={{ marginBottom: 14 }} onClick={onBack}>← 스타일 목록</button>
      <h1>{s.name}</h1>
      <p className="lede">
        {s.brand} · 이 스타일을 쓰는 제안서 {db.projects.filter((p) => p.styleId === s.id).length}건.
        여기 숫자를 바꾸면 그 제안서들이 한 번에 바뀝니다.
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
          <tr key={k}><td>{COLOR_NAMES[k] ?? k}</td>
            <td><span className="swatch" style={{ background: v }} />{v}</td></tr>
        ))}
      </tbody></table>

      <p className="sec">글자 크기</p>
      <table className="spec"><tbody>
        {Object.entries(s.type).map(([k, v]) => (
          <tr key={k}><td>{TYPE_NAMES[k] ?? k}</td>
            <td>{v.size}pt {v.bold ? "· 굵게" : ""} {v.color ? `· ${COLOR_NAMES[v.color] ?? v.color}` : ""}</td></tr>
        ))}
      </tbody></table>

      <p className="sec">이 스타일에만 걸린 규칙 {myRules.length}개</p>
      {myRules.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--muted)" }}>아직 없습니다.</p>
      ) : (
        <table className="spec"><tbody>
          {myRules.map((r) => (
            <tr key={r.id}><td style={{ width: "auto" }}>{r.enabled ? "켜짐" : "꺼짐"}</td><td>{r.text}</td></tr>
          ))}
        </tbody></table>
      )}
    </div>
  );
}
