import { useState } from "react";
import type { PageType, Project, Rule, StylePreset } from "../core/types";
import { buildBrain, draftRequest } from "../ai/brain";
import { askAi } from "../ai/client";
import { newProject, uid } from "../store/db";

interface Props {
  style: StylePreset;
  rules: Rule[];
  pageTypes: PageType[];
  pastProjects: Project[];
  onDone: (p: Project) => void;
  onCancel: () => void;
}

type Draft = { slides: { pageTypeId: string; content: Record<string, unknown> }[] };

export function NewProject({ style, rules, pageTypes, pastProjects, onDone, onCancel }: Props) {
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [source, setSource] = useState("");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const brain = buildBrain({ style, rules, pageTypes, pastProjects });

  const startEmpty = () => onDone(newProject(title, client));

  const startWithAi = async () => {
    if (!source.trim()) {
      setErr("넣을 내용을 적어 주세요. 기존 제안서 글, 메모, 사업 설명 무엇이든 괜찮습니다.");
      return;
    }
    setBusy(true);
    setErr("");

    const r = await askAi<Draft>(brain.system, draftRequest(source, hint));
    setBusy(false);

    if (!r.ok || !r.data?.slides?.length) {
      setErr(r.error ?? "초안을 만들지 못했습니다. 다시 시도해 주세요.");
      return;
    }

    const known = new Set(pageTypes.map((t) => t.id));
    const slides = r.data.slides
      .filter((s) => known.has(s.pageTypeId))
      .map((s) => ({ id: uid(), pageTypeId: s.pageTypeId, content: s.content ?? {} }));

    if (!slides.length) {
      setErr("AI 가 쓸 수 없는 페이지 타입을 골랐습니다. 다시 시도해 주세요.");
      return;
    }
    onDone({ ...newProject(title, client), slides });
  };

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <h1>새 제안서</h1>
      <p className="lede">
        내용을 넣으면 AI 가 페이지 구성을 짭니다. 이때 켜둔 규칙 {brain.used.rules}개와
        지난 제안서 {brain.used.examples}건을 전부 읽고 만듭니다.
      </p>

      <div className="field">
        <label>제안서 이름</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 인천시티투어 제안서" />
      </div>
      <div className="field">
        <label>고객사 <span className="hint">— 몰라도 괜찮습니다</span></label>
        <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="예: 인천관광공사" />
      </div>
      <div className="field">
        <label>넣을 내용 <span className="hint">— 기존 제안서 글, 메모, 사업 설명 무엇이든</span></label>
        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          style={{ minHeight: 190 }}
          placeholder={"예)\n인천시티투어 상품을 핫플트립 판매채널에 등록해 온라인 판매처를 추가하는 제안.\n공사는 상품 정보만 제공하고 추가 비용 0원.\n핫플트립은 2021년 설립, 네이버 리뷰 9,000건 이상, 판매채널 14개."}
        />
      </div>
      <div className="field">
        <label>따로 요청할 것 <span className="hint">— 없으면 비워 두세요</span></label>
        <input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="예: 10장 안으로, 숫자 임팩트 장을 꼭 넣어 주세요" />
      </div>

      {err && <div className="warn"><b>{err}</b></div>}

      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn primary" onClick={startWithAi} disabled={busy}>
          {busy ? "AI 가 초안을 짜는 중…" : "AI 초안 만들기"}
        </button>
        <button className="btn" onClick={startEmpty} disabled={busy}>빈 제안서로 시작</button>
        <div className="spacer" />
        <button className="btn" onClick={onCancel} disabled={busy}>취소</button>
      </div>
    </div>
  );
}
