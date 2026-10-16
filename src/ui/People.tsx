import { useState } from "react";
import type { Person } from "../core/types";
import type { DB } from "../store/db";

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
  const [새대표암호, set새대표암호] = useState(db.대표암호);
  const [새직원암호, set새직원암호] = useState(db.직원암호);

  const 암호저장 = () => {
    const a = 새대표암호.trim(), b = 새직원암호.trim();
    if (!a || !b || a === b) return;   // 둘이 같으면 자리를 가를 수 없다
    setDb((d) => ({ ...d, 대표암호: a, 직원암호: b }));
  };

  const 자리바꾸기 = (id: string, role: "대표" | "직원") =>
    setDb((d) => ({ ...d, people: d.people.map((x) => (x.id === id ? { ...x, role } : x)) }));

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
        누가 만들고 누가 고쳤는지 남깁니다. 들어올 때 <b>이름을 직접 적고</b> 암호를 넣습니다.
        <b>어느 암호를 넣었느냐로 자리가 갈립니다</b> — 대표 암호면 대표, 직원 암호면 직원입니다.
        처음 보는 이름은 그 자리에서 아래 목록에 올라옵니다.
      </p>
      <p className="saynote" style={{ marginBottom: 16 }}>
        주의: 이건 이름표이지 자물쇠가 아닙니다. 암호 두 개는 이 브라우저 안에 그대로 적혀 있어
        마음먹으면 들여다볼 수 있고, 직원이 대표 암호를 알게 되면 대표로 들어옵니다.
        밖으로 새면 안 되는 자료라면 회사 서버 로그인을 써야 합니다.
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
              {x.lastIn && ` · 마지막 ${때(x.lastIn)}`}
            </small>
            {대표 && x.id !== 나?.id && (
              <div className="row">
                <button className="btn sm"
                  onClick={() => 자리바꾸기(x.id, x.role === "대표" ? "직원" : "대표")}>
                  {x.role === "대표" ? "직원으로" : "대표로"}
                </button>
                <button className="btn sm" onClick={() => 빼기(x.id)}>빼기</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {대표 ? (
        <>
          <h1 style={{ marginTop: 26 }}>암호</h1>
          <p className="lede">두 개뿐입니다. 바꾸시면 다음에 들어오는 분부터 새 암호를 씁니다.</p>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <label className="pinfield">
              <small>대표 암호</small>
              <input className="pinmini" value={새대표암호}
                onChange={(e) => set새대표암호(e.target.value)} />
            </label>
            <label className="pinfield">
              <small>직원 암호</small>
              <input className="pinmini" value={새직원암호}
                onChange={(e) => set새직원암호(e.target.value)} />
            </label>
            <button className="btn primary" style={{ alignSelf: "flex-end" }}
              disabled={!새대표암호.trim() || !새직원암호.trim() || 새대표암호.trim() === 새직원암호.trim()
                        || (새대표암호 === db.대표암호 && 새직원암호 === db.직원암호)}
              onClick={암호저장}>
              암호 바꾸기
            </button>
          </div>
          {새대표암호.trim() === 새직원암호.trim() && (
            <p className="saynote" style={{ marginTop: 9 }}>
              주의: 두 암호가 같으면 대표와 직원을 가를 수 없습니다.
            </p>
          )}

          <h1 style={{ marginTop: 26 }}>직원에게 보일 분류</h1>
          <p className="lede">
            고르지 않으시면 전부 보입니다. 하나라도 고르시면 그것만 보입니다.
            대표님은 무엇을 고르시든 늘 전부 보십니다.
          </p>
          <div className="picks">
            {db.categories.filter((c) => !c.parentId && !c.hidden).map((c) => {
              const 켜짐 = db.직원분류.includes(c.id);
              return (
                <label key={c.id} className={`pick ${켜짐 ? "on" : ""}`}>
                  <input type="checkbox" checked={켜짐}
                    onChange={(e) => setDb((d) => ({
                      ...d,
                      직원분류: e.target.checked
                        ? [...d.직원분류, c.id]
                        : d.직원분류.filter((x) => x !== c.id),
                    }))} />
                  <span>{c.name.trim() || "(이름 없음)"}</span>
                </label>
              );
            })}
          </div>
          {db.직원분류.length === 0 && (
            <p className="saynote" style={{ marginTop: 9 }}>
              지금은 직원도 분류를 전부 봅니다.
            </p>
          )}

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
          암호를 바꾸거나 자리를 옮기는 일은 대표님만 하십니다.
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
