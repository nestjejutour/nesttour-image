import { useState } from "react";
import type { Person } from "../core/types";

/**
 * 들어오기
 *
 * 이름을 고르고 네 글자 암호를 넣는다.
 *
 * 밝혀 둘 것: 이건 자물쇠가 아니라 이름표다.
 * 암호는 이 브라우저 안에 그대로 적혀 있어서, 마음먹으면 들여다볼 수 있다.
 * 누가 만들고 누가 고쳤는지 남기려는 것이지 자료를 잠그려는 것이 아니다.
 */
export function SignIn({ people, onIn }: { people: Person[]; onIn: (p: Person) => void }) {
  const [고른이, set고른이] = useState<string>(people[0]?.id ?? "");
  const [암호, set암호] = useState("");
  const [틀림, set틀림] = useState("");

  const 들어가기 = () => {
    const me = people.find((x) => x.id === 고른이);
    if (!me) { set틀림("이름을 골라 주세요."); return; }
    if (암호 !== me.pin) { set틀림("암호가 다릅니다."); set암호(""); return; }
    onIn(me);
  };

  return (
    <div className="gate">
      <div className="gatebox">
        <div className="brand" style={{ fontSize: 20, marginBottom: 10 }}>
          MTMB <span>디자인 스튜디오</span>
        </div>
        <p>이름을 고르고 네 글자 암호를 넣어 주세요.</p>

        <div className="whopick">
          {people.map((x) => (
            <button key={x.id}
              className={`navitem ${고른이 === x.id ? "on" : ""}`}
              onClick={() => { set고른이(x.id); set암호(""); set틀림(""); }}>
              {x.name}
              {x.role === "대표" && <em>대표</em>}
            </button>
          ))}
        </div>

        <input
          className="pinbox"
          type="password"
          inputMode="text"
          maxLength={4}
          placeholder="● ● ● ●"
          value={암호}
          autoFocus
          onChange={(e) => { set암호(e.target.value.slice(0, 4)); set틀림(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") 들어가기(); }}
        />
        <button className="btn primary" style={{ width: "100%" }} onClick={들어가기}>
          들어가기
        </button>
        {틀림 && <p className="gateerr">{틀림}</p>}
        <small className="gatenote">
          암호를 잊으셨으면 대표님께 말씀하세요. 창고 › 사람에서 다시 정해 드립니다.
        </small>
      </div>
    </div>
  );
}
