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
  const now = project.slides[slideIndex];
  if (!now) return null;

  const draw = (pageTypeId: string, content: any, own?: any) => {
    const t = pageTypes.find((x) => x.id === pageTypeId);
    if (!t) return { ops: [], style: baseStyle };
    const style = styleFor(baseStyle, project.styleOverride, own);
    return {
      ops: interpret(t, content, { style, assets: project.assets }),
      style,
      name: t.name,
    };
  };

  const 지금 = draw(now.pageTypeId, now.content, now.styleOverride);

  return (
    <div className="drafts">
      <div className="drafts-head">
        <b>시안 {drafts.length}개</b>
        <small>마음에 드는 것을 고르시면 이 페이지가 그대로 바뀝니다. 고르기 전에는 바뀌지 않습니다.</small>
        <div className="spacer" />
        <button className="btn sm" onClick={onAgain}>다 별로예요</button>
        <button className="btn sm" onClick={onClose}>닫기</button>
      </div>

      <div className="drafts-row">
        {/* 지금 것 — 견주어 보라고 맨 앞에 둔다 */}
        <div className="draftcard now">
          <div className="shot"><SlideView ops={지금.ops} style={지금.style} zoom={0.42} /></div>
          <div className="draftinfo">
            <b>지금 이대로</b>
            <small>{지금.name}</small>
          </div>
        </div>

        {drafts.map((d) => {
          const g = draw(d.pageTypeId, d.content, d.styleOverride);
          return (
            <div className="draftcard" key={d.id}>
              <div className="shot"><SlideView ops={g.ops} style={g.style} zoom={0.42} /></div>
              <div className="draftinfo">
                <b>{d.name}</b>
                <small>{d.why || g.name}</small>
                <button className="btn sm accent" onClick={() => onPick(d)}>이걸로</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
