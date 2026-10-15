import type { PageType, Slide, StylePreset } from "../core/types";
import { Grip, usePanel } from "./panels";
import { interpret } from "../core/interpret";
import { SlideView } from "../render/html";

/**
 * 선택 페이지 보관칸.
 *
 * 여러 제안서를 열람하며 필요한 장만 이곳에 모은 뒤,
 * 한 건의 제안서로 일괄 구성한다.
 *
 * 출처가 제각각이어도 규격이 한 벌로 맞는다.
 * 페이지가 그림이 아니라 데이터여서, 현재 스타일로 다시 그려지기 때문이다.
 *
 * 평소에는 접어 두고, 필요할 때만 펼친다. 화면을 넓게 쓰기 위함이다.
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
  /** 펼쳐져 있는가 */
  open: boolean;
  onToggle: () => void;
}

export function Tray({ items, style, pageTypes, onRemove, onMove, onClear, onMake, appendTo, onAppend, open, onToggle }: Props) {
  const panel = usePanel("tray", 296, 180, 560);

  // 접혀 있을 때는 세로 띠 하나만 남긴다
  if (!open) {
    return (
      <button className="traystrip" onClick={onToggle}
        title="선택한 페이지로 새 제안서를 구성합니다">
        <span>선택하여 만들기{items.length ? ` ${items.length}` : ""}</span>
      </button>
    );
  }

  return (
    <>
      <Grip onDrag={(dx) => panel.nudge(-dx)} onReset={panel.reset} />
      <div className="tray" style={{ width: panel.size }}>
      <div className="tray-head">
        <b>선택한 페이지 {items.length}장</b>
        <span className="row" style={{ gap: 4 }}>
          {items.length > 0 && (
            <button className="btn sm" onClick={onClear}>전체 해제</button>
          )}
          <button className="btn sm" onClick={onToggle} title="접기">닫기</button>
        </span>
      </div>

      {items.length === 0 ? (
        <p className="tray-empty">
          제안서를 열람하며 <b>선택</b>한 장이 이곳에 모입니다.
          <br />
          <br />
          서로 다른 제안서의 장을 함께 선택할 수 있으며, 새로 구성할 때
          <b> 현재 스타일 규격으로 일괄 재생성</b>됩니다.
        </p>
      ) : (
        <>
          <div className="tray-list" style={{ overflowY: "auto" }}>
            {items.map((it, i) => {
              const t = pageTypes.find((x) => x.id === it.slide.pageTypeId);
              const ops = t
                ? interpret(t, it.slide.content, {
                    style, assets: it.fromAssets,
                    adjust: it.slide.adjust, extras: it.slide.extras,
                  })
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
              선택한 {items.length}장으로 새 제안서 구성
            </button>
            {appendTo && onAppend && (
              <button className="btn" style={{ width: "100%", marginTop: 6 }} onClick={onAppend}>
                「{appendTo.title}」 에 추가
              </button>
            )}
          </div>
        </>
      )}
      </div>
    </>
  );
}
