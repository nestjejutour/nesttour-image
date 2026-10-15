import { useRef, useState } from "react";
import type { Category, PageType, Project, Rule, StylePreset } from "../core/types";
import { buildBrain, draftRequest } from "../ai/brain";
import { ask } from "../ai/client";
import { newProject, uid } from "../store/db";
import { intakeToText, prettySize, readFile, type IntakeFile } from "../core/intake";
import { takeIn } from "../core/docs";
import type { Doc } from "../core/types";

interface Props {
  style: StylePreset;
  rules: Rule[];
  pageTypes: PageType[];
  categories: Category[];
  pastProjects: Project[];
  defaultCategory: string;
  /** 회사 서버에 연결되어 있으면 큰 원본 파일도 보관된다 */
  toServer: boolean;
  onDone: (p: Project) => void;
  onCancel: () => void;
}

type Draft = { slides: { pageTypeId: string; content: Record<string, unknown> }[] };

export function NewProject(p: Props) {
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [category, setCategory] = useState(p.defaultCategory);
  const [note, setNote] = useState("");
  const [hint, setHint] = useState("");
  const [files, setFiles] = useState<IntakeFile[]>([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pick = useRef<HTMLInputElement>(null);
  /** 올린 파일 본체. 제안서를 만들 때 이 건의 파일함(제작 자료)으로 같이 넣는다. */
  const raw = useRef<Record<string, File>>({});

  const brain = buildBrain({ style: p.style, rules: p.rules, pageTypes: p.pageTypes, pastProjects: p.pastProjects });

  const take = async (list: FileList | File[]) => {
    const arr = [...list];
    if (!arr.length) return;
    const stubs: IntakeFile[] = arr.map((f) => ({
      id: uid(), name: f.name, size: f.size, mime: f.type,
      kind: "글", busy: true,
    }));
    setFiles((s) => [...s, ...stubs]);
    arr.forEach((f, i) => { raw.current[stubs[i].id] = f; });
    for (let i = 0; i < arr.length; i++) {
      const done = await readFile(arr[i], stubs[i].id);
      setFiles((s) => s.map((x) => (x.id === done.id ? done : x)));
    }
  };

  /** 올린 파일을 이 건의 파일함(제작 자료)에 넣을 모양으로 바꾼다 */
  const keepFiles = async (): Promise<Doc[]> => {
    const out: Doc[] = [];
    for (const f of files) {
      const file = raw.current[f.id];
      if (!file) continue;
      out.push(await takeIn(file, "제작 자료", f.id, p.toServer));
    }
    return out;
  };

  const startEmpty = async () =>
    p.onDone({ ...newProject(title, client, category), docs: await keepFiles() });

  const startWithAi = async () => {
    const material = [note.trim(), intakeToText(files)].filter(Boolean).join("\n\n");
    const pics = files.filter((f) => f.dataUrl);

    if (!material && !pics.length) {
      setErr("자료를 넣거나 내용을 한두 줄 적어 주세요. 파일을 끌어다 놓으셔도 됩니다.");
      return;
    }
    setBusy(true); setErr("");

    // 올린 사진은 AI 가 직접 보게 넘긴다
    const images = await Promise.all(
      pics.slice(0, 4).map((f) => fetch(f.dataUrl!).then((r) => r.blob())),
    );

    const r = await ask<Draft>({
      system: brain.system,
      messages: [{ role: "user", content: draftRequest(material || "(올린 사진을 보고 판단하라)", hint) }],
      images,
    });
    setBusy(false);

    if (!r.ok || !r.data?.slides?.length) {
      setErr(r.error ?? "초안을 만들지 못했습니다. 다시 시도해 주세요.");
      return;
    }

    const known = new Set(p.pageTypes.map((t) => t.id));
    const slides = r.data.slides
      .filter((s) => known.has(s.pageTypeId))
      .map((s) => ({ id: uid(), pageTypeId: s.pageTypeId, content: s.content ?? {} }));

    if (!slides.length) {
      setErr("AI 가 쓸 수 없는 페이지 타입을 골랐습니다. 다시 시도해 주세요.");
      return;
    }

    // 올린 사진은 프로젝트 자산으로 같이 넣어 둔다 (페이지에 끼워 쓸 수 있게)
    const assets: Record<string, string> = {};
    pics.forEach((f, i) => { assets[`올린사진-${i + 1}`] = f.dataUrl!; });

    // 올린 파일은 이 건의 파일함에 그대로 남긴다. 다음에 또 쓸 수 있다.
    p.onDone({ ...newProject(title, client, category), slides, assets, docs: await keepFiles() });
  };

  const readable = files.filter((f) => f.text || f.dataUrl).length;

  return (
    <div className="page" style={{ maxWidth: 740 }}>
      <h1>새 제안서</h1>
      <p className="lede">
        자료를 넣으면 AI 가 페이지 구성을 짭니다. 이때 켜둔 규칙 {brain.used.rules}개,
        지난 제안서 {brain.used.examples}건, 지난 지시 {brain.used.instructions}건을 전부 읽고 만듭니다.
      </p>

      {/* 백지로 시작하는 길을 맨 위에 둔다. 아래에 묻어 두면 못 찾는다. */}
      <div className="startrow">
        <div className="grow">
          <b>자료 없이 직접 작성하시겠습니까?</b>
          <small>빈 표지 한 장으로 시작합니다. 제안서 이름만 입력하셔도 됩니다.</small>
        </div>
        <button className="btn" onClick={startEmpty} disabled={busy}>신규 작성</button>
      </div>

      <div className="row" style={{ gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
        <div className="field grow" style={{ minWidth: 200 }}>
          <label>제안서 이름</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 인천시티투어 제안서" />
        </div>
        <div className="field grow" style={{ minWidth: 160 }}>
          <label>고객사 <span className="hint">— 몰라도 됩니다</span></label>
          <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="예: 인천관광공사" />
        </div>
        <div className="field" style={{ minWidth: 140 }}>
          <label>분류</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 6, padding: "7px 9px" }}>
            {p.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* ── 자료 넣는 공간 ── */}
      <div className="field">
        <label>자료 넣기 <span className="hint">— 끌어다 놓거나 눌러서 고르세요. 여러 개 괜찮습니다</span></label>
        <div
          className={`dropzone ${over ? "over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
          onClick={() => pick.current?.click()}
        >
          <b>여기에 파일을 끌어다 놓으세요</b>
          <small>PDF · 사진 · 텍스트 — 눌러서 고르셔도 됩니다</small>
          <small className="cant">한글 · 워드 · 파워포인트 · 엑셀 · PDF 를 그대로 읽습니다</small>
          <input ref={pick} type="file" multiple style={{ display: "none" }}
            onChange={(e) => { take(e.target.files ?? []); e.target.value = ""; }} />
        </div>

        {files.map((f) => (
          <div className={`filerow ${f.kind === "못읽음" ? "bad" : ""}`} key={f.id}>
            {f.dataUrl && <img src={f.dataUrl} alt="" />}
            <div className="grow" style={{ minWidth: 0 }}>
              <b>{f.name}</b>
              <small>
                {prettySize(f.size)}
                {f.busy ? " · 읽는 중…"
                  : f.text ? ` · 글 ${f.text.length.toLocaleString()}자 읽음`
                  : f.dataUrl ? " · 사진 — AI 가 직접 봅니다"
                  : ` · ${f.note ?? "못 읽음"}`}
              </small>
            </div>
            <button className="btn sm" onClick={() => setFiles((s) => s.filter((x) => x.id !== f.id))}>×</button>
          </div>
        ))}
      </div>

      <div className="field">
        <label>넣을 내용 <span className="hint">— 간단해도 됩니다. 자세한 건 위 파일이 들고 있으면 됩니다</span></label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} style={{ minHeight: 110 }}
          placeholder={"예) 인천관광공사 입찰 건. 작년 회사소개서 톤으로, 12장 안쪽.\n예) 공사는 상품 정보만 제공하고 추가 비용 0원."} />
      </div>

      <div className="field">
        <label>따로 요청할 것 <span className="hint">— 없으면 비워 두세요</span></label>
        <input value={hint} onChange={(e) => setHint(e.target.value)}
          placeholder="예: 10장 안으로, 숫자 임팩트 장을 꼭 넣어 주세요" />
      </div>

      {err && <div className="warn"><b>{err}</b></div>}

      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn primary" onClick={startWithAi} disabled={busy}>
          {busy ? "AI 가 초안을 짜는 중…" : "AI 초안 만들기"}
        </button>
        <div className="spacer" />
        {readable > 0 && <small style={{ color: "var(--muted)" }}>자료 {readable}개 읽음</small>}
        <button className="btn" onClick={p.onCancel} disabled={busy}>취소</button>
      </div>
    </div>
  );
}
