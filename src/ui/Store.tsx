import { useState } from "react";
import type { Person } from "../core/types";
import { People } from "./People";
import { Backup } from "./Backup";
import type { DB } from "../store/db";
import { StyleView } from "./StyleView";
import { Rules } from "./Rules";
import { PageTypes } from "./PageTypes";

/**
 * 설정
 *
 * 대부분은 AI 가 읽는 저장소다 — 평소에 들여다볼 일이 없다.
 * 그러나 백업만은 다르다. 자료를 지키는 유일한 길이므로
 * "안 보셔도 된다" 고 적어 두면 안 된다. 그래서 안내문에서 그 말을 뺐다.
 */
export function Store({ db, setDb, 나 }: { db: DB; setDb: (f: (d: DB) => DB) => void; 나: Person | null }) {
  const [tab, setTab] = useState<"스타일" | "페이지 모양" | "규칙" | "사람" | "백업">("스타일");

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <div className="substrip">
        <span className="note">AI 가 읽는 저장소입니다. <b>백업은 여기서 하십시오.</b></span>
        <div className="spacer" />
        {(["스타일", "페이지 모양", "규칙", "사람", "백업"] as const).map((t) => (
          <button key={t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>
            {t}
            {t !== "백업" && <small>{t === "스타일" ? db.styles.length : t === "페이지 모양" ? db.pageTypes.length : t === "규칙" ? db.rules.length : db.people.length}</small>}
          </button>
        ))}
      </div>
      {tab === "스타일" && <StyleView db={db} setDb={setDb} />}
      {tab === "페이지 모양" && <PageTypes db={db} setDb={setDb} />}
      {tab === "규칙" && <Rules db={db} setDb={setDb} />}
      {tab === "사람" && <People db={db} setDb={setDb} 나={나} />}
      {tab === "백업" && <Backup db={db} setDb={setDb} />}
    </div>
  );
}
