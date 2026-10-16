import { useState } from "react";

/**
 * 인쇄물 규격 묻기
 *
 * 현수막은 장 수보다 치수가 먼저다. 고객사가 "400×90" 이라고 부르면
 * 그 숫자가 곧 주문서이고 인쇄 데이터 크기다. 그러니 만들기 전에 묻는다.
 * (이미 만들어진 파일을 담을 때는 묻지 않는다 — 파일에서 읽어 낸다)
 */

/** 자주 쓰는 규격. 늘리고 줄일 수 있게 둔다 */
const 흔한것: { 이름: string; w: number; h: number }[] = [
  { 이름: "400 × 90", w: 4000, h: 900 },
  { 이름: "300 × 70", w: 3000, h: 700 },
  { 이름: "500 × 90", w: 5000, h: 900 },
  { 이름: "200 × 45", w: 2000, h: 450 },
  { 이름: "100 × 180 (세로)", w: 1000, h: 1800 },
];

export function 규격묻기({
  분류이름, 기본W, 기본H, 바꾸기 = false, onOk, onCancel,
}: {
  분류이름: string;
  기본W?: number;
  기본H?: number;
  /** 이미 있는 작업물의 규격을 바꾸는 중인가. 켜면 이름을 묻지 않는다 */
  바꾸기?: boolean;
  /** 밀리미터로 돌려준다 */
  onOk: (mmW: number, mmH: number, 이름: string) => void;
  onCancel: () => void;
}) {
  const [가로, set가로] = useState(String((기본W ?? 4000) / 10));
  const [세로, set세로] = useState(String((기본H ?? 900) / 10));
  const [이름, set이름] = useState("");

  const w = Number(가로), h = Number(세로);
  const 쓸만한가 = w > 0 && h > 0 && w <= 2000 && h <= 2000;

  return (
    <div className="page" style={{ maxWidth: 620 }}>
      <h1>{분류이름} — 규격{바꾸기 ? " 바꾸기" : ""}</h1>
      <p className="lede">
        {바꾸기
          ? <>새 크기를 <b>센티미터</b>로 적어 주십시오.
              디자인은 그대로 두고 판만 늘고 줄어듭니다.</>
          : <>만드실 인쇄물의 크기를 <b>센티미터</b>로 적어 주십시오.
              이 숫자가 그대로 인쇄 데이터 크기가 됩니다.</>}
      </p>

      <div className="picks" style={{ marginBottom: 16 }}>
        {흔한것.map((x) => (
          <button key={x.이름}
            className={`pick ${w * 10 === x.w && h * 10 === x.h ? "on" : ""}`}
            onClick={() => { set가로(String(x.w / 10)); set세로(String(x.h / 10)); }}>
            <span>{x.이름}</span>
          </button>
        ))}
      </div>

      <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label className="field">
          <small>가로 (cm)</small>
          <input inputMode="decimal" value={가로} autoFocus
            onChange={(e) => set가로(e.target.value.replace(/[^\d.]/g, ""))} />
        </label>
        <span style={{ paddingBottom: 9, color: "var(--muted)" }}>×</span>
        <label className="field">
          <small>세로 (cm)</small>
          <input inputMode="decimal" value={세로}
            onChange={(e) => set세로(e.target.value.replace(/[^\d.]/g, ""))} />
        </label>
        {!바꾸기 && (
          <label className="field grow" style={{ minWidth: 200 }}>
            <small>이름 — 몰라도 됩니다</small>
            <input value={이름} onChange={(e) => set이름(e.target.value)}
              placeholder="예: 팔음초 28회 제주 회관여행" />
          </label>
        )}
      </div>

      {!쓸만한가 && (
        <p className="saynote" style={{ marginTop: 12 }}>
          가로·세로를 1cm 에서 2000cm(20m) 사이로 적어 주십시오.
        </p>
      )}

      <div className="row" style={{ gap: 8, marginTop: 18 }}>
        <button className="btn primary" disabled={!쓸만한가}
          onClick={() => onOk(Math.round(w * 10), Math.round(h * 10), 이름.trim())}>
          {바꾸기 ? "이 규격으로 바꾸기" : "이 규격으로 시작"}
        </button>
        <button className="btn" onClick={onCancel}>취소</button>
      </div>

      <p className="lede" style={{ marginTop: 16, fontSize: 13.5 }}>
        화면에서는 작게 보이지만 속으로는 {가로 || "?"}×{세로 || "?"}cm 로 잡습니다.
        다 만드신 뒤 <b>인쇄용으로 저장</b> 하시면 그 크기의 파일이 나옵니다.
      </p>
    </div>
  );
}
