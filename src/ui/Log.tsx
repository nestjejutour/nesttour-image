import type { RuleScope } from "../core/types";
import { uid, type DB } from "../store/db";

/**
 * 창고 4·5 — 기록
 *
 * 쌓기만 하고 안 보여주면 쌓는 줄 모른다.
 * 여기서 지난 지시를 보고, 쓸 만한 건 규칙으로 올린다.
 */
export function Log({ db, setDb }: { db: DB; setDb: (f: (d: DB) => DB) => void }) {
  const nameOf = (id: string) => db.projects.find((p) => p.id === id)?.title ?? "(지운 제안서)";

  const promote = (text: string, projectId: string, scope: RuleScope) =>
    setDb((d) => ({
      ...d,
      rules: [...d.rules, {
        id: uid(), text, scope,
        scopeId: scope === "공통" ? undefined
          : scope === "스타일" ? d.styles[0].id
          : scope === "분류" ? (d.projects.find((p) => p.id === projectId)?.category ?? "proposal")
          : projectId,
        source: "대표지시" as const, sourceProjectId: projectId,
        enabled: true, createdAt: new Date().toISOString(),
      }],
    }));

  const byProject = new Map<string, typeof db.history>();
  for (const h of db.history) {
    const arr = byProject.get(h.projectId) ?? [];
    arr.push(h);
    byProject.set(h.projectId, arr);
  }

  const chatKeys = Object.keys(db.chats).filter((k) => (db.chats[k] ?? []).length > 0);
  const totalTurns = chatKeys.reduce((n, k) => n + db.chats[k].length, 0);

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <h1>기록</h1>
      <p className="lede">
        대표님이 내린 지시와 오간 대화가 전부 남습니다. AI 는 다음 작업 때 이걸 읽습니다.
        쓸 만한 지시는 <b>규칙으로 올려</b> 두면 그때부터 자동으로 지켜집니다.
      </p>

      <div className="status">
        <span><b>{db.history.length}</b> 지시</span>
        <span><b>{totalTurns}</b> 대화</span>
        <span><b>{db.rules.length}</b> 규칙</span>
        <span className="note">지시 → 규칙으로 올리면 다음부터 자동 적용</span>
      </div>

      {db.history.length === 0 && totalTurns === 0 && (
        <div className="empty-state">
          <p style={{ fontSize: 18, color: "var(--ink)", marginTop: 0 }}>아직 기록이 없습니다</p>
          <p style={{ fontSize: 15.5 }}>
            편집기에서 AI 와 대화하며 페이지를 고치면 여기 쌓입니다.
          </p>
        </div>
      )}

      {[...byProject.entries()].map(([pid, list]) => (
        <section key={pid}>
          <p className="sec">{nameOf(pid)} — 지시 {list.length}건</p>
          {list.slice().reverse().map((h) => (
            <div className="logitem" key={h.id}>
              <div className="grow">
                <b>{h.instruction}</b>
                <small>{h.slideIndex + 1}번째 페이지 · {h.createdAt.slice(0, 10)}</small>
              </div>
              <select defaultValue="" className="scopesel"
                onChange={(e) => {
                  if (!e.target.value) return;
                  promote(h.instruction, pid, e.target.value as RuleScope);
                  e.target.value = "";
                }}>
                <option value="">규칙으로 올리기…</option>
                <option value="공통">공통 — 어떤 문서든</option>
                <option value="스타일">스타일별 — 이 브랜드만</option>
                <option value="분류">분류별 — 이 문서 종류만</option>
                <option value="제안서">이 제안서만</option>
              </select>
            </div>
          ))}
        </section>
      ))}

      {chatKeys.length > 0 && (
        <section>
          <p className="sec">오간 대화 {chatKeys.length}곳</p>
          {chatKeys.map((k) => {
            const [pid] = k.split(":");
            const turns = db.chats[k];
            return (
              <div className="logitem" key={k} style={{ display: "block" }}>
                <small style={{ color: "var(--muted)" }}>{nameOf(pid)}</small>
                {turns.map((t, i) => (
                  <div key={i} style={{ fontSize: 15, lineHeight: 1.6, marginTop: 4 }}>
                    <b style={{ color: t.role === "user" ? "var(--ink)" : "var(--accent-글)" }}>
                      {t.role === "user" ? "대표" : "AI"}
                    </b>{" "}
                    {t.text}
                  </div>
                ))}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
