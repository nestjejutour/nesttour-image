import { useState } from "react";
import { useFit } from "./fitzoom";
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
 *
 * 띠에 늘어놓은 것만으로는 판단이 안 된다.
 * 장을 누르면 크게 뜨고, 큰 화면에서 좌우로 넘겨 본 뒤 거기서 바로 고른다.
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
  /** 크게 볼 자리 — 어느 안의 몇 번째 장인가 */
  const [big, setBig] = useState<{ 안: number; 장: number } | null>(null);

  const draw = (s: 장, deckStyle: StylePreset) => {
    const t = pageTypes.find((x) => x.id === s.pageTypeId);
    const style = s.styleOverride ? styleFor(deckStyle, s.styleOverride) : deckStyle;
    return { ops: t ? interpret(t, s.content, { style, assets: project.assets }) : [], style };
  };

  /** 지금 것을 0번으로 두고 한 줄로 세운다 */
  const 안들 = [
    { 번호: 0, 이름: "원안", why: project.title, draft: null as DeckDraft | null,
      slides: project.slides as 장[], 규격: styleFor(baseStyle, project.styleOverride) },
    ...deckDrafts.map((d, i) => ({
      번호: i + 1, 이름: `${i + 1}안`, why: d.why || d.name, draft: d,
      slides: (d.slides?.length ? d.slides : project.slides) as 장[],
      규격: styleFor(baseStyle, project.styleOverride, d.styleOverride),
    })),
  ];

  const 큰안 = big ? 안들[big.안] : null;
  const 큰장 = 큰안 ? draw(큰안.slides[big!.장], 큰안.규격) : null;
  const [bigRef, bigZoom] = useFit(
    !!big, (큰장?.style ?? baseStyle).slide.widthIn, (큰장?.style ?? baseStyle).slide.heightIn, 120, 108);

  /** 같은 안 안에서 장을 넘긴다 */
  const 넘기기 = (d: number) =>
    setBig((b) => {
      if (!b) return b;
      const n = 안들[b.안].slides.length;
      return { ...b, 장: Math.max(0, Math.min(n - 1, b.장 + d)) };
    });

  /** 같은 장 번호를 유지한 채 다른 안으로 건너뛴다 — 견주어 보는 데 이게 제일 쓸모 있다 */
  const 안바꾸기 = (i: number) =>
    setBig((b) => (b ? { 안: i, 장: Math.min(b.장, 안들[i].slides.length - 1) } : b));

  return (
    <div className="drafts">
      <div className="drafts-head">
        <b>전체 시안 {deckDrafts.length}개</b>
        <small>장을 누르면 크게 보입니다. 고르시면 이 제안서가 그대로 바뀝니다. 고르기 전에는 바뀌지 않습니다.</small>
        <div className="spacer" />
        <button className="btn sm" onClick={onAgain}>다 별로예요</button>
        <button className="btn sm" onClick={onClose}>닫기</button>
      </div>

      <div className="deckrows">
        {안들.map((x) => (
          <div className={`deckrow ${x.draft ? "" : "now"}`} key={x.번호}>
            <div className="deckinfo">
              <b>{x.이름}{x.draft ? ` · ${x.draft.name}` : ""}</b>
              <small>{x.why}</small>
              <small className="cnt">{x.slides.length}장</small>
              <button className="btn sm" onClick={() => setBig({ 안: x.번호, 장: 0 })}>크게 보기</button>
              {x.draft
                ? <button className="btn sm accent" onClick={() => onPick(x.draft!)}>{x.번호}안으로</button>
                : <small className="tag">적용 중</small>}
            </div>
            <div className="deckstrip">
              {x.slides.map((s, i) => {
                const g = draw(s, x.규격);
                return (
                  <button className="deckpage" key={i} title={`${i + 1}장 — 누르면 크게 보입니다`}
                    onClick={() => setBig({ 안: x.번호, 장: i })}>
                    <SlideView ops={g.ops} style={g.style} zoom={0.2} />
                    <small>{i + 1}</small>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {큰안 && 큰장 && (
        <div className="bigview" ref={bigRef} onClick={() => setBig(null)}>
          <button className="nav" aria-label="앞 장"
            onClick={(e) => { e.stopPropagation(); 넘기기(-1); }} disabled={big!.장 === 0}>‹</button>
          <div onClick={(e) => e.stopPropagation()}>
            <SlideView ops={큰장.ops} style={큰장.style} zoom={bigZoom} />
            <div className="bigbar">
              <b>{큰안.이름}{큰안.draft ? ` · ${큰안.draft.name}` : ""}</b>
              <small>{big!.장 + 1} / {큰안.slides.length}장</small>
              {/* 같은 장을 다른 안으로 바로 건너뛴다 */}
              <div className="bigswitch">
                {안들.map((y) => (
                  <button key={y.번호} className={`btn sm ${y.번호 === big!.안 ? "accent" : ""}`}
                    onClick={() => 안바꾸기(y.번호)}>{y.이름}</button>
                ))}
              </div>
              <div className="spacer" />
              {큰안.draft && (
                <button className="btn sm accent" onClick={() => onPick(큰안.draft!)}>{큰안.번호}안으로</button>
              )}
              <button className="btn sm" onClick={() => setBig(null)}>닫기</button>
            </div>
          </div>
          <button className="nav" aria-label="뒤 장"
            onClick={(e) => { e.stopPropagation(); 넘기기(1); }}
            disabled={big!.장 === 큰안.slides.length - 1}>›</button>
        </div>
      )}
    </div>
  );
}
