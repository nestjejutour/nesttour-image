import { useState } from "react";
import type { DB } from "../store/db";
import { 내려받기, 들여오기 } from "../store/backup";
import { prettySize } from "../core/intake";

/**
 * 통째로 보관하기
 *
 * "저장은 어떻게 하니" 라는 물음에 "알아서 저장됩니다" 라고만 답하면
 * 어디에 저장되는지, 날아갈 수 있는지를 안 알려 준 것이다.
 * 여기서 그걸 밝히고, 파일 하나로 내려받아 두는 길을 준다.
 */
export function Backup({ db, setDb }: { db: DB; setDb: (f: (d: DB) => DB) => void }) {
  const [하는중, set하는중] = useState("");
  const [끝난말, set끝난말] = useState("");
  const [탈난말, set탈난말] = useState("");
  /** 덮어쓰기를 한 번 더 묻는 중 (브라우저 창은 틀 안에서 막힌다) */
  const [들일것, set들일것] = useState<File | null>(null);

  const 그림수 = db.library.filter((x) => !x.noThumb).length;

  const 내보내기 = async () => {
    set하는중("담는 중…"); set끝난말(""); set탈난말("");
    try {
      const r = await 내려받기(db);
      set끝난말(`${r.이름} (${prettySize(r.크기)})  저장했습니다. 회사 자료함에 보관하십시오.`);
    } catch (e: any) {
      set탈난말(e?.message ?? "내려받지 못했습니다");
    }
    set하는중("");
  };

  const 들이기 = async (f: File) => {
    set들일것(null);
    set하는중("들여오는 중…"); set끝난말(""); set탈난말("");
    try {
      const 들온것 = await 들여오기(f);
      setDb(() => 들온것);
      set끝난말("들여왔습니다. 화면이 바뀐 것을 확인해 주십시오.");
    } catch (e: any) {
      set탈난말(e?.message ?? "들여오지 못했습니다");
    }
    set하는중("");
  };

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <h1>보관하기</h1>

      <p className="saynote" style={{ marginBottom: 18 }}>
        지금 자료는 <b>이 브라우저 안에만</b> 있습니다.
        다른 컴퓨터나 휴대폰에서 열면 보이지 않고, 브라우저 기록을 지우면 함께 지워집니다.
        중요한 작업을 하신 날에는 아래에서 <b>백업을 한 번 저장해</b> 회사 자료함에 두십시오.
        <br />보관 파일에는 제안서·분류·규칙과 자료의 <b>미리보기</b>가 들어갑니다.
        자료의 <b>원본 파일</b>은 덩치가 커서 빠집니다 — 원본은 보관함의 자료함에서 <b>저장</b>으로 내려받으십시오.
      </p>

      <div className="status" style={{ marginBottom: 18 }}>
        <div><b>{db.projects.length}</b> 제안서</div>
        <div><b>{db.library.length}</b> 자료<small>{그림수}장 그림 있음</small></div>
        <div><b>{db.rules.length}</b> 규칙</div>
        <div><b>{db.pageTypes.filter((t) => !t.builtIn).length}</b> 직접 만든 페이지</div>
      </div>

      <div className="row" style={{ gap: 9, flexWrap: "wrap" }}>
        <button className="btn primary" disabled={!!하는중} onClick={() => void 내보내기()}>
          {하는중 === "담는 중…" ? "저장 중…" : "백업 저장"}
        </button>
        <label className="btn">
          백업 복원
          <input type="file" accept="application/json,.json" className="숨은칸"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) set들일것(f);
            }} />
        </label>
      </div>

      {들일것 && (
        <div className="정말칸">
          <b>{들일것.name} 로 복원합니다</b>
          <small>
            지금 이 브라우저에 있는 것을 전부 덮어씁니다. 되돌릴 수 없습니다.
            먼저 <b>백업 저장</b> 을 한 번 해 두시는 편이 안전합니다.
          </small>
          <div className="row" style={{ marginTop: 9 }}>
            <button className="btn sm danger" onClick={() => void 들이기(들일것)}>복원</button>
            <button className="btn sm" onClick={() => set들일것(null)}>취소</button>
          </div>
        </div>
      )}

      {끝난말 && <p className="goodnote">{끝난말}</p>}
      {탈난말 && <p className="gateerr">{탈난말}</p>}

      <h1 style={{ marginTop: 30 }}>평소에는</h1>
      <p className="lede">
        따로 저장하실 것이 없습니다. 고치는 즉시 저장됩니다 —
        화면 오른쪽 위 <b>저장됨 00:00</b> 이 그 표시입니다.
        여기 <b>백업 저장</b> 은 그와 별개로, 컴퓨터가 바뀌거나 탈이 났을 때를 위한 것입니다.
      </p>
      <p className="lede">
        회사 서버(Firebase)를 붙이면 이 일이 저절로 됩니다 —
        어느 컴퓨터에서 열어도 같은 자료가 보이고, 휴대폰에서도 열립니다.
        그때까지는 이 파일 하나가 그 몫을 합니다.
      </p>
    </div>
  );
}
