import { useRef, useState } from "react";
import type { Doc, Folder, Project } from "../core/types";
import { FOLDERS, prettySize, saveOut, takeIn } from "../core/docs";
import { uid } from "../store/db";

/**
 * 파일함 — 이 건의 폴더.
 *
 * 받은 제안요청서, 내보낸 PPT/PDF, 만들 때 참고한 자료를
 * 제안서 한 건 안에 같이 둔다. 다음에 열면 그대로 있다.
 */

interface Props {
  project: Project;
  onChange: (apply: (p: Project) => Project) => void;
  /** 회사 서버(Firebase)에 연결되어 있으면 큰 파일도 보관된다 */
  toServer: boolean;
  onClose: () => void;
}

export function Files({ project, onChange, toServer, onClose }: Props) {
  const [folder, setFolder] = useState<Folder>("원본");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const pick = useRef<HTMLInputElement>(null);
  const docs = project.docs ?? [];

  const add = async (list: FileList | File[]) => {
    const arr = Array.from(list);
    if (!arr.length) return;
    setMsg("");
    for (let i = 0; i < arr.length; i++) {
      setBusy(`${arr[i].name} 넣는 중… (${i + 1}/${arr.length})`);
      const doc = await takeIn(arr[i], folder, uid(), toServer);
      onChange((p) => ({ ...p, docs: [...(p.docs ?? []), doc], updatedAt: new Date().toISOString() }));
    }
    setBusy("");
  };

  const remove = (id: string) =>
    onChange((p) => ({ ...p, docs: (p.docs ?? []).filter((d) => d.id !== id), updatedAt: new Date().toISOString() }));

  const here = docs.filter((d) => d.folder === folder);

  return (
    <div className="drawer">
      <div className="row" style={{ marginBottom: 10 }}>
        <b style={{ fontSize: 15.5 }}>파일함</b>
        <div className="spacer" />
        <button className="btn sm" onClick={onClose}>닫기</button>
      </div>

      <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 10px" }}>
        이 건에 딸린 파일을 여기에 보관합니다. 넣을 때 글을 뽑아 두므로,
        다음에 AI 와 일할 때 다시 올리지 않아도 됩니다.
      </p>

      <div className="row" style={{ marginBottom: 10 }}>
        {FOLDERS.map((f) => (
          <button key={f} className={`btnchip ${folder === f ? "on" : ""}`} onClick={() => setFolder(f)}>
            {f} {docs.filter((d) => d.folder === f).length || ""}
          </button>
        ))}
      </div>

      <div
        className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); void add(e.dataTransfer.files); }}
        onClick={() => pick.current?.click()}
      >
        <b>+ 파일 넣기</b>
        <small>끌어다 놓거나 눌러서 고르세요 · {folder} 칸에 들어갑니다</small>
      </div>
      <input ref={pick} type="file" multiple style={{ display: "none" }}
        onChange={(e) => {
          // 목록을 먼저 복사한다. 입력칸을 비우면 목록도 같이 비어 버린다.
          const picked = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (picked.length) void add(picked);
        }} />

      {busy && <p style={{ fontSize: 13, color: "var(--muted)" }}>{busy}</p>}
      {msg && <p style={{ fontSize: 13, color: "var(--todo)" }}>{msg}</p>}

      {here.length === 0 && !busy && (
        <p className="chat-hint">
          {folder} 칸이 비어 있습니다.
          {folder === "원본"
            ? " 받은 제안요청서, 내보낸 PPT·PDF 를 여기 넣어 두세요."
            : " 만들 때 참고한 자료를 여기 넣어 두세요."}
        </p>
      )}

      <div className="filelist">
        {here.map((d) => (
          <div className="fileitem" key={d.id}>
            <div className="grow" style={{ minWidth: 0 }}>
              <b title={d.name}>{d.name}</b>
              <small>
                {prettySize(d.size)} · {new Date(d.addedAt).toLocaleDateString("ko-KR")}
                {d.text && " · 글 읽어 둠"}
                {!d.url && " · 본체 없음"}
              </small>
              {d.note && <small style={{ color: "var(--todo)" }}>{d.note}</small>}
            </div>
            {d.url && (
              <button className="btn sm" title="내려받기"
                onClick={async () => {
                  const r = await saveOut(d);
                  if (!r.ok) setMsg(r.error ?? "내려받지 못했습니다");
                }}>받기</button>
            )}
            <button className="btn sm" title="파일함에서 빼기" onClick={() => remove(d.id)}>빼기</button>
          </div>
        ))}
      </div>

      {!toServer && (
        <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 12, lineHeight: 1.6 }}>
          지금은 내 PC(브라우저)에 보관하므로 큰 파일은 담기지 않습니다.
          회사 서버에 연결하면 원본을 크기 그대로 보관합니다.
        </p>
      )}
    </div>
  );
}

/** 보관함 카드 같은 곳에서 쓰는 한 줄 요약 */
export const docsLine = (docs: Doc[] | undefined) =>
  !docs?.length ? "" : `파일 ${docs.length}개`;
