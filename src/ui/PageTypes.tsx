import { useMemo, useState } from "react";
import type { DB } from "../store/db";
import { uid } from "../store/db";
import { interpret } from "../core/interpret";
import { SlideView } from "../render/html";
import { SHAPES, makePageType, type Shape } from "../core/makeType";

/**
 * 페이지 타입 창고
 *
 * 쓸 수 있는 페이지 모양을 전부 늘어놓는다.
 * 모자라면 아래 "+ 페이지 모양 추가" 로 직접 늘린다. 코드를 고칠 필요가 없다.
 */
export function PageTypes({ db, setDb }: { db: DB; setDb: (f: (d: DB) => DB) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [group, setGroup] = useState("본문");
  const [shape, setShape] = useState<Shape>("카드 열");
  const [cols, setCols] = useState(3);
  const [desc, setDesc] = useState("");
  const [asking, setAsking] = useState<string | null>(null);

  const style = db.styles[0];
  const groups = useMemo(() => {
    const m = new Map<string, typeof db.pageTypes>();
    for (const t of db.pageTypes) m.set(t.group, [...(m.get(t.group) ?? []), t]);
    return [...m.entries()];
  }, [db.pageTypes]);

  const shapeInfo = SHAPES.find((s) => s.id === shape)!;

  const add = () => {
    const t = makePageType({
      id: `my-${uid()}`,
      name: name.trim() || "새 페이지 모양",
      group: group.trim() || "본문",
      description: desc.trim(),
      shape, cols,
      createdAt: new Date().toISOString().slice(0, 10),
    });
    setDb((d) => ({ ...d, pageTypes: [...d.pageTypes, t] }));
    setAdding(false); setName(""); setDesc("");
  };

  const remove = (id: string) => {
    setDb((d) => ({ ...d, pageTypes: d.pageTypes.filter((t) => t.id !== id) }));
    setAsking(null);
  };

  /** 쓰고 있는 제안서가 있으면 지우지 못하게 막는다 */
  const usedBy = (id: string) =>
    db.projects.filter((p) => p.slides.some((s) => s.pageTypeId === id)).length;

  return (
    <div className="page" style={{ maxWidth: 1180 }}>
      <h1>페이지 모양 {db.pageTypes.length}종</h1>
      <p className="lede">
        제안서를 만들 때 고를 수 있는 페이지 모양입니다. AI 도 여기 있는 것 중에서만 고릅니다.
        쓰고 싶은 모양이 없으면 아래에서 직접 늘리시면 됩니다.
      </p>

      {!adding ? (
        <button className="btn primary" style={{ marginBottom: 18 }} onClick={() => setAdding(true)}>
          + 페이지 모양 추가
        </button>
      ) : (
        <div className="card" style={{ padding: 16, marginBottom: 18, display: "block" }}>
          <div className="row" style={{ gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <div className="field grow" style={{ minWidth: 200 }}>
              <label>이름</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 운영 조건 표" />
            </div>
            <div className="field" style={{ minWidth: 130 }}>
              <label>묶음</label>
              <select value={group} onChange={(e) => setGroup(e.target.value)}
                style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 6, padding: "7px 9px" }}>
                {["표지", "본문", "마무리"].map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <div className="field" style={{ marginBottom: 10 }}>
            <label>기본형</label>
            <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {SHAPES.map((s) => (
                <button key={s.id} className={`btnchip ${shape === s.id ? "on" : ""}`}
                  onClick={() => setShape(s.id)}>{s.name}</button>
              ))}
            </div>
            <small className="hint">{shapeInfo.note}</small>
          </div>

          {shapeInfo.cols && (
            <div className="field" style={{ marginBottom: 10, maxWidth: 220 }}>
              <label>칸 수 — {cols}칸</label>
              <input type="range" min={shapeInfo.cols[0]} max={shapeInfo.cols[1]} value={cols}
                onChange={(e) => setCols(Number(e.target.value))} />
            </div>
          )}

          <div className="field" style={{ marginBottom: 12 }}>
            <label>설명 <span className="hint">— AI 가 언제 이 모양을 쓸지 판단하는 데 씁니다</span></label>
            <input value={desc} onChange={(e) => setDesc(e.target.value)}
              placeholder="예: 계약 조건을 항목별로 또박또박 적을 때" />
          </div>

          <div className="row">
            <button className="btn primary" onClick={add}>만들기</button>
            <button className="btn" onClick={() => setAdding(false)}>취소</button>
            <div className="spacer" />
            <small style={{ color: "var(--muted)" }}>
              만든 뒤에는 제안서 화면에서 끌어 옮기고 크기를 바꿀 수 있습니다.
            </small>
          </div>
        </div>
      )}

      {groups.map(([g, list]) => (
        <div key={g}>
          <p className="sec">{g} {list.length}종</p>
          <div className="ptgrid">
            {list.map((t) => {
              const ops = interpret(t, t.sample, { style });
              const used = usedBy(t.id);
              return (
                <div className="card ptcard" key={t.id}>
                  <div className="thumb"><SlideView ops={ops} style={style} zoom={0.24} /></div>
                  <div className="meta">
                    <b>{t.name}</b>
                    <small>{t.description}</small>
                    <div className="whenrow">
                      <small>{t.builtIn ? "기본" : "직접 만든 모양"}{used ? ` · ${used}건에서 사용 중` : ""}</small>
                      <div className="spacer" />
                      {!t.builtIn && (
                        asking === t.id ? (
                          <span className="row" style={{ gap: 4 }}>
                            <button className="btn sm accent" disabled={used > 0}
                              title={used ? "쓰고 있는 제안서가 있어 지울 수 없습니다" : ""}
                              onClick={() => remove(t.id)}>삭제</button>
                            <button className="btn sm" onClick={() => setAsking(null)}>취소</button>
                          </span>
                        ) : (
                          <button className="btn sm" onClick={() => setAsking(t.id)}>삭제</button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
