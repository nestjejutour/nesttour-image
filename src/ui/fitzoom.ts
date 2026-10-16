import { useEffect, useRef, useState } from "react";

/**
 * 자리에 맞춰 크기를 키운다.
 *
 * "크게 보여 달라" 는 말은 화면이 허락하는 만큼 크게라는 뜻이다.
 * 고정된 배율로 띄우면 넓은 모니터에서는 작고 좁은 화면에서는 잘린다.
 */
export function useFit(
  on: boolean,
  widthIn: number,
  heightIn: number,
  /** 좌우·위아래로 비워 둘 자리 (화살표·설명줄) */
  padX = 120,
  padY = 84,
) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.8);

  useEffect(() => {
    if (!on) return;
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth - padX;
      const h = el.clientHeight - padY;
      if (w <= 0 || h <= 0) return;
      const z = Math.min(w / (widthIn * 96), h / (heightIn * 96));
      setZoom(Math.max(0.3, Math.min(1.8, Number(z.toFixed(3)))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [on, widthIn, heightIn, padX, padY]);

  return [ref, zoom] as const;
}
