import { useState } from "react";
import type { Person } from "../core/types";
import { uid, type DB } from "../store/db";

/**
 * 사람과 손댄 기록
 *
 * 누가 만들고 누가 고쳤는지 남긴다.
 * 밝혀 둘 것 — 네 글자 암호는 이 브라우저 안에 그대로 적혀 있다.
 * 이름표이지 자물쇠가 아니다. 정말 잠가야 하면 회사 서버 로그인을 써야 한다.
 */
export function People({
  db, setDb, 나,
}: { db: DB; setDb: (f: (d: DB) => DB) => void; 나: Person | null }) {
  const 대표 = 나?.role === "대표";
  const [이름, set이름] = useState("");
  const [암호, set암호] = useState("");
  const [고치는이, set고치는이] = useState<string | null>(null);
  const [새암호, set새암호] = useState("");

  const 넣기 = () => {
    const n = 이름.trim();
    if (!n || 암호.length !== 4) return;
    if (db.people.some((x) => x.name === n)) return;
    setDb((d) => ({
      ...d,
      people: [...d.people, {
        id: uid(), name: n, pin: 암호, role: "직원",
        createdAt: new Date().toISOString(),
      }],
    }));
    set이름(""); set암호("");
  };

  const 암호바꾸기 = (id: string) => {
    if (새암호.length !== 4) return;
    setDb((d) => ({ ...d, people: d.people.map((x) => (x.id === id ? { ...x, pin: 새암호 } : x)) }));
    set고치는이(null); set새암호("");
  };

  const 빼기 = (id: string) =>
    setDb((d) => ({ ...d, people: d.people.filter((x) => x.id !== id) }));

  const 때 = (iso: string) => {
    const d = new Date(iso);
    const 오늘 = new Date().toDateString() === d.toDateString();
    const 시각 = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return 오늘 ? `오늘 ${시각}` : `${d.getMonth() + 1}.${d.getDate()} ${시각}`;
  };

  const 기록 = [...db.trail].reverse().slice(0, 300);

  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <h1>사람</h1>
      <p className="lede">
        누가 만들고 누가 고쳤는지 남깁니다. 아이디는 <b>이름</b>, 암호는 <b>네 글자</b>입니다.
      </p>
      <p className="saynote" style={{ marginBottom: 16 }}>
        주의: 이건 이름표이지 자물쇠가 아닙니다. 암호는 이 브라우저 안에 그대로 적혀 있어
        마음먹으면 들여다볼 수 있습니다. 밖으로 새면 안 되는 자료라면 회사 서버 로그인을 써야 합니다.
      </p>

      <div className="peoplelist">
        {db.people.map((x) => (
          <div className="filerow" key={x.id}>
            <b>
              {x.name}
              {x.role === "대표" && <em className="tag대표">대표</em>}
            </b>
            <small>
              만든 제안서 {db.projects.filter((p) => p.madeBy === x.id).length}건 ·
              손댄 기록 {db.trail.filter((t) => t.who === x.id).length}번
            </small>
            {대표 && (
              고치는이 === x.id ? (
                <div className="row">
                  <input className="pinmini" maxLength={4} autoFocus placeholder="새 암호 4글자"
                    value={새암호} onChange={(e) => set새암호(e.target.value.slice(0, 4))}
                    onKeyDown={(e) => { if (e.key === "Enter") 암호바꾸기(x.id); }} />
                  <button className="btn sm primary" disabled={새암호.length !== 4}
                    onClick={() => 암호바꾸기(x.id)}>바꾸기</button>
                  <button className="btn sm" onClick={() => { set고치는이(null); set새암호(""); }}>닫기</button>
                </div>
              ) : (
                <div className="row">
                  <button className="btn sm" onClick={() => { set고치는이(x.id); set새암호(""); }}>
                    암호 바꾸기
                  </button>
                  {x.role !== "대표" && (
                    <button className="btn sm" onClick={() => 빼기(x.id)}>빼기</button>
                  )}
                </div>
              )
            )}
          </div>
        ))}
      </div>

      {대표 ? (
        <>
          <div className="row" style={{ marginTop: 14, flexWrap: "wrap" }}>
            <input placeholder="이름 (아이디로 씁니다)" value={이름}
              onChange={(e) => set이름(e.target.value)} style={{ width: 200 }} />
            <input className="pinmini" maxLength={4} placeholder="암호 4글자" value={암호}
              onChange={(e) => set암호(e.target.value.slice(0, 4))}
              onKeyDown={(e) => { if (e.key === "Enter") 넣기(); }} />
            <button className="btn primary" disabled={!이름.trim() || 암호.length !== 4} onClick={넣기}>
              사람 넣기
            </button>
          </div>

          <label className="onlymine">
            <input type="checkbox" checked={!!db.onlyMine}
              onChange={(e) => setDb((d) => ({ ...d, onlyMine: e.target.checked }))} />
            <span>
              <b>직원은 자기가 만든 것만 보게 합니다</b>
              <small>
                꺼 두시는 편을 권합니다. 지난 제안서를 베껴 쓰는 게 이 공장의 핵심이라,
                서로 못 보게 막으면 쓸모가 반으로 줍니다. 대표님은 켜든 끄든 전부 보십니다.
              </small>
            </span>
          </label>
        </>
      ) : (
        <p className="lede" style={{ marginTop: 14 }}>
          사람을 더하거나 암호를 바꾸는 일은 대표님만 하십니다.
        </p>
      )}

      <h1 style={{ marginTop: 30 }}>손댄 기록</h1>
      <p className="lede">
        최근 것부터 {기록.length}줄입니다. 같은 사람이 같은 건을 이어서 손대면 한 줄로 묶습니다.
      </p>
      {기록.length === 0 ? (
        <p className="lede">아직 없습니다.</p>
      ) : (
        <div className="trail">
          {기록.map((t) => (
            <div className="trailrow" key={t.id}>
              <small className="when">{때(t.at)}</small>
              <b>{t.whoName}</b>
              <span className="what">{t.what}</span>
              <span className="which">{t.projectTitle}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
