import { useState } from "react";

/**
 * 들어오기
 *
 * 이름을 적고 암호를 넣는다.
 * 암호가 자리를 가른다 — 대표 암호로 들어오면 대표, 직원 암호로 들어오면 직원.
 *
 * 밝혀 둘 것: 이건 자물쇠가 아니라 이름표다.
 * 암호는 이 브라우저 안에 그대로 적혀 있어서, 마음먹으면 들여다볼 수 있다.
 * 누가 만들고 누가 고쳤는지 남기려는 것이지 자료를 잠그려는 것이 아니다.
 */

/** 지난번에 적은 이름을 기억해 둔다 */
const 이름칸 = "mtmb-지난이름";

export function SignIn({
  대표암호, 직원암호, onIn,
}: {
  대표암호: string;
  직원암호: string;
  onIn: (name: string, role: "대표" | "직원") => void;
}) {
  const [이름, set이름] = useState(() => {
    try { return localStorage.getItem(이름칸) ?? ""; } catch { return ""; }
  });
  const [암호, set암호] = useState("");
  const [틀림, set틀림] = useState("");

  const 로그인 = () => {
    const n = 이름.trim();
    if (!n) { set틀림("이름을 적어 주세요."); return; }
    const 자리 = 암호 === 대표암호 ? "대표" : 암호 === 직원암호 ? "직원" : null;
    if (!자리) { set틀림("암호가 다릅니다."); set암호(""); return; }
    try { localStorage.setItem(이름칸, n); } catch { /* 기억 못 해도 들어가는 데는 지장 없다 */ }
    onIn(n, 자리);
  };

  return (
    <div className="gate">
      <div className="gatebox">
        <div className="brand" style={{ fontSize: 20, marginBottom: 12 }}>
          <span>디자인 스튜디오</span>
        </div>

        <input
          className="namebox"
          placeholder="이름"
          enterKeyHint="next"
          value={이름}
          autoFocus={!이름}
          onChange={(e) => { set이름(e.target.value); set틀림(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") 로그인(); }}
        />
        <input
          className="pinbox"
          type="password"
          placeholder="암호"
          enterKeyHint="go"
          value={암호}
          autoFocus={!!이름}
          onChange={(e) => { set암호(e.target.value); set틀림(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") 로그인(); }}
        />
        <button className="btn primary" style={{ width: "100%" }} onClick={로그인}>
          로그인
        </button>
        {틀림 && <p className="gateerr">{틀림}</p>}
        <small className="gatenote">
          적으신 이름은 다음에 열 때 그대로 떠 있습니다. 암호만 넣으시면 됩니다.
        </small>
      </div>
    </div>
  );
}
