import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 칸 너비 조정
 *
 * 경계를 끌면 움직이고, 한 번 맞춰두면 브라우저에 기억된다.
 * 사람마다 모니터가 다르니 정답을 내가 정할 수 없다.
 */

const KEY = "mtmb-panels-v1";

function readAll(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

/**
 * 켜고 끈 것을 기억하는 자리.
 *
 * 너비와 같은 칸에 둔다 — 기기마다 따로 기억되고, 백업에도 함께 담긴다.
 * 대표님이 손수 접거나 편 것은 다음에도 그대로여야 한다.
 */
export function 기억한것(name: string): boolean | null {
  const v = readAll()[name];
  return typeof v === "number" ? v !== 0 : null;
}

export function 기억해두기(name: string, 켬: boolean) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [name]: 켬 ? 1 : 0 }));
  } catch { /* 못 적어도 이번 판은 돈다 */ }
}

/** 기억되는 크기 하나 */
export function usePanel(name: string, fallback: number, min: number, max: number) {
  const [v, setV] = useState<number>(() => {
    const saved = readAll()[name];
    return typeof saved === "number" ? Math.min(max, Math.max(min, saved)) : fallback;
  });

  // 지금 보이는 값(최소·최대로 다듬어진 값)을 기준으로 움직인다.
  // 안 그러면 최소값에 걸려 있을 때 끌어도 꿈쩍하지 않는다.
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const nudge = useCallback(
    (d: number) => setV((cur) => clamp(clamp(cur) + d)),
    [min, max],
  );

  const reset = useCallback(() => setV(fallback), [fallback]);

  // 끌기가 끝난 뒤에만 저장한다 (끄는 내내 쓰지 않는다)
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [name]: v }));
      } catch { /* 저장 못 해도 화면은 돈다 */ }
    }, 350);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [name, v]);

  return { size: clamp(v), nudge, reset };
}

/**
 * 끌어서 넓히는 손잡이.
 * 두 번 누르면 원래 너비로 돌아간다.
 */
export function Grip({
  onDrag, onReset, title,
}: {
  onDrag: (dx: number) => void;
  onReset?: () => void;
  title?: string;
}) {
  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    let last = e.clientX;
    const move = (ev: PointerEvent) => {
      onDrag(ev.clientX - last);
      last = ev.clientX;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div
      className="grip"
      onPointerDown={down}
      onDoubleClick={onReset}
      title={title ?? "끌어서 너비 조정 · 두 번 누르면 원래대로"}
    >
      <span />
    </div>
  );
}


/**
 * 위아래로 끌어서 높이를 바꾸는 손잡이.
 * 아래로 끌면 아래쪽 칸이 작아진다.
 */
export function GripH({
  onDrag, onReset, title,
}: {
  onDrag: (dy: number) => void;
  onReset?: () => void;
  title?: string;
}) {
  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    let last = e.clientY;
    const move = (ev: PointerEvent) => {
      onDrag(ev.clientY - last);
      last = ev.clientY;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div
      className="griph"
      onPointerDown={down}
      onDoubleClick={onReset}
      title={title ?? "끌어서 높이 조정 · 두 번 누르면 원래대로"}
    >
      <span />
    </div>
  );
}
