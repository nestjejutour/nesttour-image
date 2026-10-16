import { useState } from "react";
import type { DeckDraft, PageType, Project, StylePreset } from "../core/types";
import { interpret } from "../core/interpret";
import { styleFor } from "../core/scope";
import { SlideView } from "../render/html";

/**
 * 전체 시안 고르기
 *
 * "제안서 전체를 두 가지로 보여줘" 하면 AI 가 한 벌씩 통째로 내놓는다.
 * 안마다 전체 장을 한 줄로 늘어놓아 훑어보고, 고른 한 벌만 제안서에 들어간다.
 * 고르기 전에는 바뀌지 않는다 — 보관함에 새 제안서가 생기지도 않는다.
 */

interface Props {
  deckDrafts: DeckDraft[];
  project: Project;
  baseStyle: StylePreset;
  pageTypes: PageType[];
  onPick: (d: DeckDraft) => void;
  onClose: () => void;
  /** 다 마음에 안 들 때 */
  onAgain: () => void;
}

/** 한 벌을 그리기 위해 필요한 것만 추린 모양 */
type 장 = { pageTypeId: string; content: any; styleOverride?: any };

export function DeckDrafts({
  deckDrafts, project, baseStyle, pageTypes, onPick, onClose, onAgain,
}: Props) {
  /** 크게 볼 장 하나 */
  const [big, setBig] = useState<{ ops: any[]; style: StylePreset; label: string } | null>(null);

  const 지금규격 = styleFor(baseStyle, project.styleOverride);

  const draw = (s: 장, deckStyle: StylePreset) => {
    const t = pageTypes.find((x) => x.id === s.pageTypeId);
    const style = s.styleOverride ? styleFor(deckStyle, s.styleOverride) : deckStyle;
    return { ops: t ? interpret(t, s.content, { style, assets: project.assets }) : [], style };
  };

  /** 한 벌을 가로 한 줄로 */
  const 줄 = (name: string, why: string, slides: 장[], deckStyle: StylePreset, pick?: () => void) => (
    <div className={`deckrow ${pick ? "" : "now"}`} key={name}>
      <div className="deckinfo">
        <b>{name}</b>
        <small>{why}</small>
        <small className="cnt">{slides.length}장</small>
        {pick
          ? <button className="btn sm accent" onClick={pick}>이 안으로</button>
          : <small className="tag">지금 제안서</small>}
      </div>
      <div className="deckstrip">
        {slides.map((s, i) => {
          const g = draw(s, deckStyle);
          return (
            <button className="deckpage" key={i} title={`${i + 1}장 — 누르면 크게 보입니다`}
              onClick={() => setBig({ ...g, label: `${name} · ${i + 1}장` })}>
              <SlideView ops={g.ops} style={g.style} zoom={0.2} />
              <small>{i + 1}</small>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="drafts">
      <div className="drafts-head">
        <b>전체 시안 {deckDrafts.length}개</b>
        <small>한 벌씩 훑어보시고 고르시면 이 제안서가 그대로 바뀝니다. 고르기 전에는 바뀌지 않습니다.</small>
        <div className="spacer" />
        <button className="btn sm" onClick={onAgain}>다 별로예요</button>
        <button className="btn sm" onClick={onClose}>닫기</button>
      </div>

      <div className="deckrows">
        {줄("지금 이대로", `${project.title}`, project.slides, 지금규격)}
        {deckDrafts.map((d) => {
          const deckStyle = styleFor(baseStyle, project.styleOverride, d.styleOverride);
          const slides: 장[] = d.slides?.length ? d.slides : project.slides;
          return 줄(d.name, d.why || "", slides, deckStyle, () => onPick(d));
        })}
      </div>

      {big && (
        <div className="deckbig" onClick={() => setBig(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <SlideView ops={big.ops} style={big.style} zoom={0.78} />
            <div className="row" style={{ justifyContent: "center", marginTop: 10 }}>
              <span style={{ color: "#fff", fontSize: 14.5 }}>{big.label}</span>
              <button className="btn sm" onClick={() => setBig(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
