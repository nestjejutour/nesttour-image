import { useState } from "react";
import type { Person } from "../core/types";
import { People } from "./People";
import { Backup } from "./Backup";
import type { DB } from "../store/db";
import { StyleView } from "./StyleView";
import { Rules } from "./Rules";
import { PageTypes } from "./PageTypes";

/**
 * 창고
 *
 * 대표님이 들여다볼 화면이 아니다. AI 가 읽는 저장소다.
 * 그래서 위쪽 메뉴에서 빼고 여기 한 곳에 묶어 둔다.
 */
export function Store({ db, setDb, 나 }: { db: DB; setDb: (f: (d: DB) => DB) => void; 나: Person | null }) {
  const [tab, setTab] = useState<"스타일" | "페이지 모양" | "규칙" | "사람" | "보관">("스타일");

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <div className="substrip">
        <span className="note">AI 가 읽는 저장소입니다. 평소에 들여다보지 않으셔도 됩니다.</span>
        <div className="spacer" />
        {(["스타일", "페이지 모양", "규칙", "사람", "보관"] as const).map((t) => (
          <button key={t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>
            {t}
            {t !== "보관" && <small>{t === "스타일" ? db.styles.length : t === "페이지 모양" ? db.pageTypes.length : t === "규칙" ? db.rules.length : db.people.length}</small>}
          </button>
        ))}
      </div>
      {tab === "스타일" && <StyleView db={db} setDb={setDb} />}
      {tab === "페이지 모양" && <PageTypes db={db} setDb={setDb} />}
      {tab === "규칙" && <Rules db={db} setDb={setDb} />}
      {tab === "사람" && <People db={db} setDb={setDb} 나={나} />}
      {tab === "보관" && <Backup db={db} setDb={setDb} />}
    </div>
  );
}
