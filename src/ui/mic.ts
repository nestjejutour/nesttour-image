import { useEffect, useRef, useState } from "react";

/**
 * 마이크로 받아쓰기
 *
 * 브라우저가 들고 있는 받아쓰기 기능을 쓴다. 따로 열쇠가 필요 없다.
 * 크롬·엣지에서 된다. 사파리·파이어폭스는 아직 없어서, 없으면 버튼을 숨긴다.
 *
 * 말하는 동안 글이 실시간으로 쌓이고, 멈추면 그대로 입력칸에 남는다.
 */

type Rec = {
  lang: string; continuous: boolean; interimResults: boolean;
  start: () => void; stop: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

const Engine = (): (new () => Rec) | null => {
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export interface Mic {
  /** 이 브라우저가 받아쓰기를 할 수 있는가 */
  can: boolean;
  듣는중: boolean;
  오류: string;
  toggle: () => void;
}

export function useMic(onText: (add: string) => void): Mic {
  const [can] = useState(() => !!Engine());
  const [듣는중, set듣는중] = useState(false);
  const [오류, set오류] = useState("");
  const rec = useRef<Rec | null>(null);
  /** 이미 입력칸에 넣은 길이 — 같은 말을 두 번 넣지 않으려고 */
  const 넣은곳 = useRef(0);

  useEffect(() => () => { try { rec.current?.stop(); } catch { /* 이미 멈춤 */ } }, []);

  const toggle = () => {
    if (듣는중) { try { rec.current?.stop(); } catch { /* 이미 멈춤 */ } return; }
    const E = Engine();
    if (!E) return;

    set오류("");
    넣은곳.current = 0;
    const r = new E();
    r.lang = "ko-KR";
    r.continuous = true;
    r.interimResults = true;

    r.onresult = (e: any) => {
      // 확정된 말만 입력칸에 넣는다. 듣는 중인 말은 계속 바뀐다.
      let 확정 = "";
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) 확정 += e.results[i][0].transcript;
      }
      if (확정.length > 넣은곳.current) {
        onText(확정.slice(넣은곳.current));
        넣은곳.current = 확정.length;
      }
    };
    r.onerror = (e: any) => {
      const code = e?.error;
      set오류(
        code === "not-allowed" || code === "service-not-allowed"
          ? "마이크 사용이 막혀 있습니다. 브라우저 주소창의 자물쇠에서 마이크를 허용하거나, 이 화면을 새 탭으로 열어 주세요."
          : code === "no-speech" ? "소리가 들리지 않았습니다."
          : code === "audio-capture" ? "마이크를 찾지 못했습니다."
          : code === "network" ? "받아쓰기 서버에 닿지 못했습니다."
          : "받아쓰기를 하지 못했습니다.",
      );
      set듣는중(false);
    };
    r.onend = () => set듣는중(false);

    try { r.start(); rec.current = r; set듣는중(true); }
    catch { set오류("마이크를 켜지 못했습니다."); }
  };

  return { can, 듣는중, 오류, toggle };
}
