import { login } from "../store/firebase";
import { useState } from "react";

/** 로그인 화면. 회사 서버로 접속했을 때만 나온다. */
export function Gate({ loading }: { loading?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  return (
    <div className="gate">
      <div className="gatebox">
        <div className="brand" style={{ fontSize: 20, marginBottom: 7 }}>
          <span>디자인 스튜디오</span>
        </div>
        {loading ? (
          <p>자료를 불러오는 중입니다…</p>
        ) : (
          <>
            <p>
              제안서와 규칙은 회사 서버에 저장됩니다.
              <br />
              어느 컴퓨터에서 열어도 같은 자료가 보입니다.
            </p>
            <button className="btn primary" disabled={busy}
              onClick={async () => {
                setBusy(true); setErr("");
                try { await login(); } catch (e: any) { setErr(e?.message ?? "로그인에 실패했습니다."); }
                setBusy(false);
              }}>
              {busy ? "로그인 중…" : "구글 계정으로 로그인"}
            </button>
            {err && <p className="gateerr">{err}</p>}
          </>
        )}
      </div>
    </div>
  );
}
