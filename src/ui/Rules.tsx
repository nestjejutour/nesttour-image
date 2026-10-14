import { useState } from "react";
import type { Rule, RuleScope } from "../core/types";
import { uid, type DB } from "../store/db";
import { scopeLabel } from "../core/scope";
import { ask } from "../ai/client";
import { COMMON_LIMIT, tidySystem, type Proposal, type TidyReply } from "../ai/tidy";

/**
 * 창고 3 — 규칙
 *
 * 범위별로 나눠 보여준다. 한 통에 쌓으면 1년 뒤 서로 싸운다.
 */
const SCOPES: { v: RuleScope; name: string; help: string }[] = [
  { v: "공통",   name: "공통",       help: "어떤 문서든 지킨다" },
  { v: "스타일", name: "스타일별",   help: "이 브랜드 규격에만" },
  { v: "분류",   name: "분류별",     help: "이 문서 종류에만" },
  { v: "제안서", name: "이 제안서만", help: "1회성. 다른 데 안 번진다" },
];

export function Rules({ db, setDb }: { db: DB; setDb: (f: (d: DB) => DB) => void }) {
  const [draft, setDraft] = useState("");
  const [scope, setScope] = useState<RuleScope>("공통");
  const [scopeId, setScopeId] = useState("");
  const [tidying, setTidying] = useState(false);
  const [tidy, setTidy] = useState<TidyReply | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [tidyErr, setTidyErr] = useState("");

  const commonCount = db.rules.filter((r) => r.scope === "공통" && r.enabled).length;

  const runTidy = async () => {
    setTidying(true); setTidyErr(""); setTidy(null); setPicked(new Set());
    const r = await ask<TidyReply>({
      system: tidySystem({ rules: db.rules, styles: db.styles, categories: db.categories, projects: db.projects }),
      messages: [{ role: "user", content: "쌓인 규칙을 훑고 정리할 것을 찾아줘." }],
    });
    setTidying(false);
    if (!r.ok || !r.data) { setTidyErr(r.error ?? "정리 목록을 받지 못했습니다."); return; }
    setTidy(r.data);
    // 기본으로 전부 체크해 둔다. 빼실 것만 풀면 된다.
    setPicked(new Set((r.data.proposals ?? []).map((_, i) => i).filter((i) => (r.data!.proposals[i] as any).kind !== "충돌")));
  };

  const applyTidy = () => {
    const ps = (tidy?.proposals ?? []).filter((_, i) => picked.has(i));
    setDb((d) => {
      let rules = [...d.rules];
      for (const pr of ps) {
        if (pr.kind === "범위이동") {
          rules = rules.map((r) => {
            if (r.id !== pr.ruleId) return r;
            const srcCat = d.projects.find((x) => x.id === r.sourceProjectId)?.category;
            const sid = pr.to === "공통" ? undefined
              : pr.to === "스타일" ? d.styles[0].id
              : pr.to === "분류" ? (srcCat ?? d.categories[0].id)
              : (r.sourceProjectId ?? d.projects[0]?.id);
            return { ...r, scope: pr.to, scopeId: sid };
          });
        } else if (pr.kind === "중복") {
          rules = rules.filter((r) => !pr.removeIds.includes(r.id));
        } else if (pr.kind === "다듬기") {
          rules = rules.map((r) => (r.id === pr.ruleId ? { ...r, text: pr.text } : r));
        }
      }
      return { ...d, rules };
    });
    setTidy(null); setPicked(new Set());
  };

  const textOf = (id: string) => db.rules.find((r) => r.id === id)?.text ?? "(없는 규칙)";

  const look = {
    styleName: (id: string) => db.styles.find((s) => s.id === id)?.name ?? id,
    categoryName: (id: string) => db.categories.find((c) => c.id === id)?.name ?? id,
    projectName: (id: string) => db.projects.find((p) => p.id === id)?.title ?? id,
  };

  const toggle = (id: string) =>
    setDb((d) => ({ ...d, rules: d.rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)) }));

  const setScopeOf = (id: string, s: RuleScope, sid?: string) =>
    setDb((d) => ({ ...d, rules: d.rules.map((r) => (r.id === id ? { ...r, scope: s, scopeId: sid } : r)) }));

  const remove = (id: string) =>
    setDb((d) => ({ ...d, rules: d.rules.filter((r) => r.id !== id) }));

  const add = () => {
    if (!draft.trim()) return;
    const r: Rule = {
      id: uid(), text: draft.trim(), scope,
      scopeId: scope === "공통" ? undefined : scopeId || defaultIdFor(scope),
      source: "직접입력", enabled: true, createdAt: new Date().toISOString(),
    };
    setDb((d) => ({ ...d, rules: [...d.rules, r] }));
    setDraft("");
  };

  function defaultIdFor(s: RuleScope) {
    if (s === "스타일") return db.styles[0]?.id;
    if (s === "분류") return db.categories[0]?.id;
    return db.projects[0]?.id;
  }

  const options = scope === "스타일" ? db.styles.map((x) => ({ id: x.id, name: x.name }))
    : scope === "분류" ? db.categories.map((x) => ({ id: x.id, name: x.name }))
    : scope === "제안서" ? db.projects.map((x) => ({ id: x.id, name: x.title }))
    : [];

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <h1>규칙</h1>
      <p className="lede">
        “앞으로도 이렇게 해라”를 모아 두는 곳입니다. <b>범위</b>가 중요합니다 —
        1회성 지시가 전체로 번지면 다음 제안서가 망가집니다.
        AI 는 제안서를 만들 때 <b>그 건에 해당하는 규칙만</b> 읽습니다.
      </p>

      {commonCount > COMMON_LIMIT && (
        <div className="warn">
          <b>공통 규칙이 {commonCount}개입니다</b>
          공통은 적을수록 셉니다. 브랜드나 문서 종류에만 해당하는 것은 아래로 내리는 게 좋습니다.
        </div>
      )}

      <div className="row" style={{ marginBottom: 16 }}>
        <button className="btn" onClick={runTidy} disabled={tidying || db.rules.length < 3}>
          {tidying ? "규칙을 훑는 중…" : "AI 로 정리하기"}
        </button>
        <small style={{ color: "var(--muted)" }}>
          중복·충돌·범위가 틀린 규칙을 찾아 목록으로 보여줍니다
        </small>
      </div>

      {tidyErr && <div className="warn"><b>{tidyErr}</b></div>}

      {tidy && (
        <div className="tidybox">
          <b>{tidy.say}</b>
          {(tidy.proposals ?? []).length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 12.5 }}>고칠 것이 없습니다.</p>
          ) : (
            <>
              {tidy.proposals.map((pr, i) => (
                <label className={`tidyitem ${pr.kind === "충돌" ? "clash" : ""}`} key={i}>
                  {pr.kind !== "충돌" && (
                    <input type="checkbox" checked={picked.has(i)}
                      onChange={(e) => setPicked((s2) => {
                        const n = new Set(s2);
                        e.target.checked ? n.add(i) : n.delete(i);
                        return n;
                      })} />
                  )}
                  <div className="grow">
                    <span className="kind">{pr.kind}</span>
                    <p>{describe(pr, textOf)}</p>
                    <small>{pr.why}{pr.kind === "충돌" ? ` → ${pr.suggestion}` : ""}</small>
                  </div>
                </label>
              ))}
              <div className="row" style={{ marginTop: 11 }}>
                <button className="btn primary" onClick={applyTidy} disabled={picked.size === 0}>
                  체크한 {picked.size}개 적용
                </button>
                <button className="btn" onClick={() => setTidy(null)}>닫기</button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="addrule">
        <input className="search grow" placeholder="예: 숫자는 천 단위 쉼표를 꼭 넣는다"
          value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()} />
        <select value={scope} onChange={(e) => { setScope(e.target.value as RuleScope); setScopeId(""); }}>
          {SCOPES.map((s) => <option key={s.v} value={s.v}>{s.name}</option>)}
        </select>
        {options.length > 0 && (
          <select value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
            <option value="">— 고르세요 —</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        <button className="btn primary" onClick={add}>추가</button>
      </div>

      {SCOPES.map((sc) => {
        const list = db.rules.filter((r) => r.scope === sc.v);
        if (!list.length) return null;
        return (
          <section key={sc.v}>
            <p className="sec">
              {sc.name} <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                — {sc.help} · {list.filter((r) => r.enabled).length}/{list.length} 켜짐
              </span>
            </p>
            {list.map((r) => (
              <div className={`rule ${r.enabled ? "" : "off"}`} key={r.id}>
                <input type="checkbox" checked={r.enabled} onChange={() => toggle(r.id)} />
                <div className="txt">
                  {r.text}
                  {r.scope !== "공통" && <small className="scopeid"> {scopeLabel(r, look)}</small>}
                </div>
                <select className="scopesel" value={r.scope}
                  onChange={(e) => setScopeOf(r.id, e.target.value as RuleScope, r.scopeId ?? defaultIdFor(e.target.value as RuleScope))}>
                  {SCOPES.map((s) => <option key={s.v} value={s.v}>{s.name}</option>)}
                </select>
                <span className="tag">{r.source}</span>
                {r.source !== "기본" && <button className="btn sm" onClick={() => remove(r.id)}>×</button>}
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}

/** 제안 하나를 사람이 읽는 말로 */
function describe(p: Proposal, textOf: (id: string) => string): string {
  switch (p.kind) {
    case "범위이동": return `“${textOf(p.ruleId)}” → ${p.to}`;
    case "중복":     return `“${textOf(p.keepId)}” 만 남기고 ${p.removeIds.length}개 지우기`;
    case "충돌":     return p.ruleIds.map((id) => `“${textOf(id)}”`).join("  ↔  ");
    case "다듬기":   return `“${textOf(p.ruleId)}” → “${p.text}”`;
  }
}
