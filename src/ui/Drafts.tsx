import { useEffect, useRef, useState } from "react";
import { useFit } from "./fitzoom";
import type { Draft, PageType, Project, StylePreset } from "../core/types";
import { interpret } from "../core/interpret";
import { styleFor } from "../core/scope";
import { SlideView } from "../render/html";

/**
 * 시안 고르기
 *
 * "이 페이지 다시 디자인해줘" 하면 AI 가 두세 가지를 내놓는다.
 * 보고 있던 자리에 지금 것과 나란히 띄워 비교하고, 고른 것만 페이지에 들어간다.
 * 고르기 전에는 제안서가 바뀌지 않는다 — 마음 편히 봐도 된다.
 *
 * 작게 늘어놓은 것만으로는 판단이 안 된다.
 * 누르면 크게 뜨고, 큰 화면에서 좌우로 넘겨 가며 견준 뒤 거기서 바로 고른다.
 */

interface Props {
  drafts: Draft[];
  /** 지금 페이지 (맨 앞에 "지금 것" 으로 함께 보여 준다) */
  project: Project;
  slideIndex: number;
  baseStyle: StylePreset;
  pageTypes: PageType[];
  onPick: (d: Draft) => void;
  onClose: () => void;
  /** 다 마음에 안 들 때 — AI 에게 다시 부탁한다 */
  onAgain: () => void;
}

export function Drafts({
  drafts, project, slideIndex, baseStyle, pageTypes, onPick, onClose, onAgain,
}: Props) {
  /**
   * 칸 너비.
   *
   * 안이 몇 개든 한 줄에 나란히 서야 견주어 볼 수 있다.
   * 그러니 배율을 먼저 정하고 칸을 맞추는 게 아니라,
   * 자리를 재서 나눠 가진 뒤 거기에 배율을 맞춘다.
   */
  const rowRef = useRef<HTMLDivElement>(null);
  const [칸폭, set칸폭] = useState(400);
  /** 크게 볼 것 — 0 은 지금 것, 1 부터가 1안 */
  const [big, setBig] = useState<number | null>(null);

  const now = project.slides[slideIndex];
  if (!now) return null;

  const draw = (pageTypeId: string, content: any, own?: any) => {
    const t = pageTypes.find((x) => x.id === pageTypeId);
    if (!t) return { ops: [], style: baseStyle, 틀이름: "" };
    const style = styleFor(baseStyle, project.styleOverride, own);
    return {
      ops: interpret(t, content, { style, assets: project.assets }),
      style,
      틀이름: t.name,
    };
  };

  /** 지금 것을 0번으로 두고 한 줄로 세운다 — 크게 보기에서 좌우로 넘기기 위함 */
  const 줄 = [
    { 번호: 0, 이름: "원안", why: "", draft: null as Draft | null,
      ...draw(now.pageTypeId, now.content, now.styleOverride) },
    ...drafts.map((d, i) => ({
      번호: i + 1, 이름: `${i + 1}안`, why: d.why || d.name, draft: d,
      ...draw(d.pageTypeId, d.content, d.styleOverride),
    })),
  ];

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const 재기 = () => {
      const 여백 = 32, 사이 = 14;
      const 비 = 줄[0].style.slide.widthIn / Math.max(0.1, 줄[0].style.slide.heightIn);

      /*
        현수막은 400×70 처럼 납작하다. 제안서와 같이 넉 장을 나란히 세우면
        한 칸이 손가락만 한 띠가 되어 디자인을 고를 수가 없다.
        그래서 납작할수록 한 줄에 적게 세운다.
      */
      const 한줄 = 비 >= 3 ? 1 : 비 >= 2 ? 2 : Math.min(줄.length, 4);
      const 가로로 = (el.clientWidth - 여백 - 사이 * (한줄 - 1)) / 한줄;

      /*
        세로도 본다. 한 줄에 하나씩 세우면 넉 장이 화면 밖으로 밀려난다.
        나란히 놓고 비교하는 게 시안의 전부라, 밀려나면 뜻이 없다.
        칸 높이는 창 바닥까지 남은 자리를 줄 수로 나눈 만큼으로 묶는다.
      */
      const 글자자리 = 92;   // 이름·설명·고르기 단추가 쓰는 세로
      const 줄수 = Math.ceil(줄.length / 한줄);
      const 남은세로 = window.innerHeight - el.getBoundingClientRect().top - 32;
      const 칸높이 = 남은세로 / 줄수 - 사이 - 글자자리;

      /*
        납작한 것은 세로를 재지 않는다.
        넉 장을 한 화면에 욱여넣으려 하면 칸이 다시 띠가 되고, 오른쪽은 텅 빈다.
        차라리 한 장을 가로로 꽉 채워 크게 보여 주고 내려서 보게 한다 —
        현수막은 크게 봐야 고를 수 있다.
      */
      const 세로로 = 비 >= 3 ? Infinity : 칸높이 > 48 ? 칸높이 * 비 : Infinity;

      const 최대 = 비 >= 3 ? 1600 : 560;
      const w = Math.min(가로로, 세로로);
      if (w > 0) set칸폭(Math.max(200, Math.min(최대, Math.floor(w))));
    };
    재기();
    const ro = new ResizeObserver(재기);
    ro.observe(el);
    return () => ro.disconnect();
  }, [줄.length, 줄[0].style.slide.widthIn, 줄[0].style.slide.heightIn]);

  const 배율 = Number((칸폭 / (줄[0].style.slide.widthIn * 96)).toFixed(3));

  const 큰것 = big !== null ? 줄[big] : null;
  const [bigRef, bigZoom] = useFit(
    big !== null, (큰것?.style ?? baseStyle).slide.widthIn, (큰것?.style ?? baseStyle).slide.heightIn);
  const 넘기기 = (d: number) =>
    setBig((b) => (b === null ? b : Math.max(0, Math.min(줄.length - 1, b + d))));

  return (
    <div className="drafts">
      <div className="drafts-head">
        <b>시안 {drafts.length}개</b>
        <small>눌러서 크게 보시고, 마음에 드는 안을 고르시면 이 페이지가 그대로 바뀝니다. 고르기 전에는 바뀌지 않습니다.</small>
        <div className="spacer" />
        <button className="btn sm" onClick={onAgain}>다 별로예요</button>
        <button className="btn sm" onClick={onClose}>닫기</button>
      </div>

      {/* 칸 너비는 그림이 정한다. 설명 글 길이로 카드가 늘어나면 안 된다 */}
      <div className="drafts-row" ref={rowRef}
        style={{ gridTemplateColumns: `repeat(auto-fill, ${칸폭}px)` }}>
        {줄.map((x) => (
          <div className={`draftcard ${x.draft ? "" : "now"}`} key={x.번호}>
            <button className="shot" title="누르면 크게 보입니다" onClick={() => setBig(x.번호)}>
              <SlideView ops={x.ops} style={x.style} zoom={배율} />
              <span className="zoomtag">크게 보기</span>
            </button>
            <div className="draftinfo">
              <b>{x.이름}{x.draft ? ` · ${x.draft.name}` : ""}</b>
              <small>{x.why || x.틀이름}</small>
              {x.draft
                ? <button className="btn sm accent" onClick={() => onPick(x.draft!)}>{x.번호}안으로</button>
                : <small className="tag">적용 중</small>}
            </div>
          </div>
        ))}
      </div>

      {큰것 && (
        <div className="bigview" ref={bigRef} onClick={() => setBig(null)}>
          <button className="nav" aria-label="앞 안"
            onClick={(e) => { e.stopPropagation(); 넘기기(-1); }} disabled={big === 0}>‹</button>
          <div onClick={(e) => e.stopPropagation()}>
            <SlideView ops={큰것.ops} style={큰것.style} zoom={bigZoom} />
            <div className="bigbar">
              <b>{큰것.이름}{큰것.draft ? ` · ${큰것.draft.name}` : ""}</b>
              <small>{큰것.why || 큰것.틀이름}</small>
              <div className="spacer" />
              {큰것.draft && (
                <button className="btn sm accent" onClick={() => onPick(큰것.draft!)}>{큰것.번호}안으로</button>
              )}
              <button className="btn sm" onClick={() => setBig(null)}>닫기</button>
            </div>
          </div>
          <button className="nav" aria-label="뒤 안"
            onClick={(e) => { e.stopPropagation(); 넘기기(1); }} disabled={big === 줄.length - 1}>›</button>
        </div>
      )}
    </div>
  );
}
