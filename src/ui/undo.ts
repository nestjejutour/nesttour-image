import { useEffect, useRef, useState } from "react";
import type { DB } from "../store/db";

/** 되돌리기 한 벌. 버튼과 단축키가 같은 걸 쓴다. */
export interface Undo {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

/** 몇 단계까지 기억할지. 너무 많이 쌓으면 메모리를 잡아먹는다. */
const DEPTH = 40;

/**
 * 되돌리기.
 *
 * 자료가 바뀐 걸 지켜보다가, 바뀌기 직전 모습을 쌓아 둔다.
 * 자료는 고칠 때마다 새 덩어리로 만들어지므로(겹쳐 쓰지 않는다)
 * 직전 모습을 그대로 다시 끼워 넣으면 그 상태로 돌아간다.
 * 사진 같은 큰 값은 같은 것을 가리키기만 하니 무게는 늘지 않는다.
 */
export function useUndo(
  db: DB,
  setDb: React.Dispatch<React.SetStateAction<DB | null>>,
  /**
   * 사람이 한 일이 아닌 변화는 단계로 세지 않는다.
   * (사진을 회사 서버로 올리고 주소만 남기는 일 같은 것.
   *  이걸 세면 되돌리기가 사진을 도로 내려받는 꼴이 된다)
   */
  quiet?: React.MutableRefObject<boolean>,
): Undo {
  const [past, setPast] = useState<DB[]>([]);
  const [future, setFuture] = useState<DB[]>([]);
  /** 마지막으로 본 모습 */
  const seen = useRef(db);
  /** 되돌리는 중이라면 그 변화는 기록하지 않는다 (무한 되돌리기 방지) */
  const moving = useRef(false);

  useEffect(() => {
    if (seen.current === db) return;
    const before = seen.current;
    seen.current = db;
    if (moving.current) { moving.current = false; return; }
    if (quiet?.current) { quiet.current = false; return; }
    setPast((s) => [...s.slice(-(DEPTH - 1)), before]);
    setFuture([]);   // 새로 고쳤으면 "다시 하기" 줄은 끊긴다
  }, [db]);

  const undo = () => {
    if (!past.length) return;
    moving.current = true;
    setFuture((f) => [...f, seen.current]);
    setDb(past[past.length - 1]);
    setPast(past.slice(0, -1));
  };

  const redo = () => {
    if (!future.length) return;
    moving.current = true;
    setPast((s) => [...s.slice(-(DEPTH - 1)), seen.current]);
    setDb(future[future.length - 1]);
    setFuture(future.slice(0, -1));
  };

  /* ── 단축키 ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      // 글을 쓰는 칸 안이라면 그 칸의 되돌리기가 먼저다
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [past, future, db]);

  return { canUndo: past.length > 0, canRedo: future.length > 0, undo, redo };
}
