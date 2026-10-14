import { useState } from "react";
import type { Rule } from "../core/types";
import { uid, type DB } from "../store/db";

/** 창고 3 — 규칙. "앞으로도 이렇게"를 모아 두는 곳 */
export function Rules({ db, setDb }: { db: DB; setDb: (f: (d: DB) => DB) => void }) {
  const [draft, setDraft] = useState("");

  const toggle = (id: string) =>
    setDb((d) => ({ ...d, rules: d.rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)) }));

  const add = () => {
    if (!draft.trim()) return;
    const r: Rule = {
      id: uid(), styleId: db.styles[0].id, text: draft.trim(),
      source: "직접입력", enabled: true, createdAt: new Date().toISOString(),
    };
    setDb((d) => ({ ...d, rules: [...d.rules, r] }));
    setDraft("");
  };

  const on = db.rules.filter((r) => r.enabled).length;

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <h1>규칙</h1>
      <p className="lede">
        “앞으로도 이렇게 해라”를 모아 두는 곳입니다. 켜 둔 규칙 {on}개는 AI 가 페이지를 만들거나
        고칠 때마다 전부 읽습니다. 쓰다가 생기는 취향을 여기에 쌓으면 결과가 점점 좋아집니다.
      </p>

      <div className="row" style={{ marginBottom: 20 }}>
        <input className="grow search" placeholder="예: 숫자는 천 단위 쉼표를 꼭 넣는다"
          value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="btn primary" onClick={add}>규칙 추가</button>
      </div>

      {db.rules.map((r) => (
        <div className={`rule ${r.enabled ? "" : "off"}`} key={r.id}>
          <input type="checkbox" checked={r.enabled} onChange={() => toggle(r.id)} />
          <div className="txt">{r.text}</div>
          <span className="tag">{r.source}</span>
        </div>
      ))}
    </div>
  );
}
