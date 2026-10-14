import { useState } from "react";
import type { Category, PageType, Project, Slide, StylePreset } from "../core/types";
import { interpret } from "../core/interpret";
import { SlideView } from "../render/html";

/**
 * 지난 자료 서랍 — 편집기 왼쪽에 붙는다.
 *
 * 편집기를 나가지 않고 지난 제안서를 뒤져서 마음에 드는 장을
 * 지금 만드는 제안서에 바로 꽂는다. 왔다 갔다 할 필요가 없다.
 */

interface Props {
  projects: Project[];
  categories: Category[];
  style: StylePreset;
  pageTypes: PageType[];
  /** 지금 작업 중인 제안서 (목록에서 뺀다) */
  currentId: string;
  /** 이 장을 지금 제안서에 넣는다 */
  onInsert: (slide: Slide, fromAssets: Record<string, string>) => void;
  onClose: () => void;
}

export function SourceDrawer(p: Props) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const list = p.projects
    .filter((x) => x.id !== p.currentId && x.slides.length > 0)
    .filter((x) => {
      if (!q.trim()) return true;
      const cat = p.categories.find((c) => c.id === x.category)?.name ?? "";
      return `${x.title} ${x.client} ${cat} ${x.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase());
    });

  const picked = p.projects.find((x) => x.id === pickedId);

  return (
    <div className="drawer">
      <div className="row" style={{ marginBottom: 10 }}>
        <b style={{ fontSize: 13 }}>지난 자료</b>
        <div className="spacer" />
        <button className="btn sm" onClick={p.onClose}>닫기</button>
      </div>

      {!picked ? (
        <>
          <input className="search" style={{ width: "100%", marginBottom: 10 }}
            placeholder="제안서 찾기" value={q} onChange={(e) => setQ(e.target.value)} />
          {list.length === 0 && (
            <p className="chat-hint">
              가져올 지난 제안서가 아직 없습니다.
              <br /><br />
              완성본이 쌓이면 여기서 낱장으로 꺼내 쓸 수 있습니다.
            </p>
          )}
          {list.map((x) => {
            const first = x.slides[0];
            const t = p.pageTypes.find((y) => y.id === first.pageTypeId);
            const ops = t ? interpret(t, first.content, { style: p.style, assets: x.assets }) : [];
            return (
              <button className="srcitem" key={x.id} onClick={() => setPickedId(x.id)}>
                <div className="shot"><SlideView ops={ops} style={p.style} zoom={0.082} /></div>
                <div className="grow" style={{ minWidth: 0 }}>
                  <b>{x.title}</b>
                  <small>{x.client || "고객사 없음"} · {x.slides.length}장</small>
                </div>
              </button>
            );
          })}
        </>
      ) : (
        <>
          <button className="btn sm" style={{ marginBottom: 10 }} onClick={() => setPickedId(null)}>
            ← 제안서 목록
          </button>
          <p style={{ fontSize: 12, margin: "0 0 4px" }}><b>{picked.title}</b></p>
          <p style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 10px" }}>
            넣고 싶은 장을 누르면 지금 보고 있는 페이지 <b>뒤에</b> 들어갑니다.
          </p>
          <div className="srcgrid">
            {picked.slides.map((s, i) => {
              const t = p.pageTypes.find((y) => y.id === s.pageTypeId);
              const ops = t ? interpret(t, s.content, { style: p.style, assets: picked.assets }) : [];
              return (
                <button className="srcpage" key={s.id}
                  onClick={() => p.onInsert(s, picked.assets)}
                  title={`${t?.name ?? ""} — 눌러서 넣기`}>
                  <SlideView ops={ops} style={p.style} zoom={0.118} />
                  <span className="no">{i + 1}</span>
                  <span className="add">+ 넣기</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
