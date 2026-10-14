import type { PageType, Slide, StylePreset } from "../core/types";
import { Grip, usePanel } from "./panels";
import { interpret } from "../core/interpret";
import { SlideView } from "../render/html";

/**
 * 담은 선반.
 *
 * 여러 제안서를 넘겨보다가 마음에 드는 장만 오른쪽으로 던져 모은다.
 * 다 모으면 한 벌로 새 제안서를 만든다.
 *
 * 출처가 제각각이어도 모양이 한 벌로 맞는다.
 * 우리 페이지는 그림이 아니라 데이터라서, 지금 스타일로 "다시 그려지기" 때문이다.
 */

export interface TrayItem {
  key: string;
  slide: Slide;
  fromTitle: string;
  /** 출처 제안서가 들고 있던 사진들 (가져올 때 같이 따라와야 한다) */
  fromAssets: Record<string, string>;
}

interface Props {
  items: TrayItem[];
  style: StylePreset;
  pageTypes: PageType[];
  onRemove: (key: string) => void;
  onMove: (key: string, d: -1 | 1) => void;
  onClear: () => void;
  onMake: () => void;
  /** 이어 붙일 제안서 (작업하던 게 있을 때만) */
  appendTo?: { id: string; title: string } | null;
  onAppend?: () => void;
}

export function Tray({ items, style, pageTypes, onRemove, onMove, onClear, onMake, appendTo, onAppend }: Props) {
  const panel = usePanel("tray", 296, 180, 560);

  return (
    <>
      <Grip onDrag={(dx) => panel.nudge(-dx)} onReset={panel.reset} />
      <div className="tray" style={{ width: panel.size }}>
      <div className="tray-head">
        <b>담은 페이지 {items.length}장</b>
        {items.length > 0 && (
          <button className="btn sm" onClick={onClear}>비우기</button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="tray-empty">
          넘겨보다가 마음에 드는 장을 <b>담기</b> 하면 여기 쌓입니다.
          <br />
          <br />
          여러 제안서에서 섞어 담아도 됩니다. 만들 때 <b>지금 스타일로 한 벌로 다시 그려집니다.</b>
        </p>
      ) : (
        <>
          <div className="tray-list" style={{ overflowY: "auto" }}>
            {items.map((it, i) => {
              const t = pageTypes.find((x) => x.id === it.slide.pageTypeId);
              const ops = t
                ? interpret(t, it.slide.content, { style, assets: it.fromAssets })
                : [];
              return (
                <div className="tray-item" key={it.key}>
                  <span className="no">{i + 1}</span>
                  <div className="shot">
                    <SlideView ops={ops} style={style} zoom={0.1} />
                  </div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <b>{t?.name ?? "알 수 없음"}</b>
                    <small>{it.fromTitle}</small>
                  </div>
                  <div className="tray-btns">
                    <button className="btn sm" disabled={i === 0} onClick={() => onMove(it.key, -1)}>↑</button>
                    <button className="btn sm" disabled={i === items.length - 1} onClick={() => onMove(it.key, 1)}>↓</button>
                    <button className="btn sm" onClick={() => onRemove(it.key)}>×</button>
                  </div>
                </div>
              );
            })}
          </div>
          {/* 바닥에 붙여 둔다. 목록이 길어져도 항상 보여야 한다. */}
          <div className="tray-foot">
            <button className="btn primary" style={{ width: "100%" }} onClick={onMake}>
              담은 {items.length}장으로 새 제안서 만들기
            </button>
            {appendTo && onAppend && (
              <button className="btn" style={{ width: "100%", marginTop: 6 }} onClick={onAppend}>
                「{appendTo.title}」 에 이어 붙이기
              </button>
            )}
          </div>
        </>
      )}
      </div>
    </>
  );
}
