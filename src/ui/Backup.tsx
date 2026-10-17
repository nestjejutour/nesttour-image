import { useState } from "react";
import type { DB } from "../store/db";
import { 내려받기, 들여오기 } from "../store/backup";
import { 전체백업받기, 전체복원하기, type 되는중, type 목록 } from "../store/전체백업";
import { prettySize } from "../core/intake";

/**
 * 통째로 보관하기
 *
 * "저장은 어떻게 하니" 라는 물음에 "알아서 저장됩니다" 라고만 답하면
 * 어디에 저장되는지, 날아갈 수 있는지를 안 알려 준 것이다.
 * 여기서 그걸 밝히고, 파일 하나로 내려받아 두는 길을 준다.
 *
 * 길이 둘이다.
 *  - 전체 백업(zip) : 원본 파일까지 전부. 이것이 기본이다.
 *  - 간편 백업(json): 예전 방식. 원본 파일이 빠진다. 옛 파일을 읽기 위해 남겨 둔다.
 */
export function Backup({ db, setDb }: { db: DB; setDb: (f: (d: DB) => DB) => void }) {
  const [하는중, set하는중] = useState<되는중 | null>(null);
  const [끝난말, set끝난말] = useState("");
  const [반만, set반만] = useState<목록 | null>(null);
  const [탈난말, set탈난말] = useState("");
  /** 덮어쓰기를 한 번 더 묻는 중 (브라우저 창은 틀 안에서 막힌다) */
  const [들일것, set들일것] = useState<{ f: File; 묶음: boolean } | null>(null);

  const 그림수 = db.library.filter((x) => !x.noThumb).length;
  const 원본수 = db.library.filter((x) => x.hasFile).length;
  const 비었나 = db.projects.length === 0 && db.library.length === 0;
  const 치우기 = () => { set끝난말(""); set탈난말(""); set반만(null); };

  /* ── 전체 백업 (zip) ── */
  const 전체담기 = async () => {
    치우기(); set하는중({ 단계: "준비하는 중", 끝난: 0, 전부: 0 });
    try {
      const r = await 전체백업받기(db, set하는중);
      const 센것 = r.목록.건수;
      if (r.목록.빠진것.length) {
        // 하나라도 빠졌으면 "완료" 라고 하지 않는다.
        set반만(r.목록);
      } else {
        set끝난말(
          `${r.이름} (${prettySize(r.크기)}) 저장했습니다. ` +
          `제안서 ${센것.제안서}건 · 원본 파일 ${센것.원본파일}개 · 미리보기 ${센것.미리보기}장이 모두 담겼습니다. ` +
          `회사 자료함이나 USB 로 옮겨 두십시오.`,
        );
      }
    } catch (e: any) {
      set탈난말(
        /quota|exceeded|space/i.test(e?.message ?? "")
          ? "저장 자리가 모자라 묶음을 만들지 못했습니다. 내려받기 폴더를 비운 뒤 다시 해 주십시오."
          : (e?.message ?? "백업하지 못했습니다"),
      );
    }
    set하는중(null);
  };

  /* ── 복원 ── */
  const 되살리기 = async (f: File, 묶음: boolean) => {
    set들일것(null); 치우기(); set하는중({ 단계: "준비하는 중", 끝난: 0, 전부: 0 });
    try {
      if (묶음) {
        // 되살리기 전에 지금 것을 한 벌 받아 둔다. 잘못 고른 파일이어도 되돌아올 자리가 생긴다.
        if (!비었나) {
          set하는중({ 단계: "지금 자료를 먼저 백업하는 중", 끝난: 0, 전부: 1 });
          try { await 전체백업받기(db); }
          catch { throw new Error("되살리기 전에 지금 자료를 백업하려다 실패했습니다. 자료를 지킬 수 없으므로 멈췄습니다 — 자리를 비운 뒤 다시 해 주십시오."); }
        }
        const r = await 전체복원하기(f, set하는중);
        setDb(() => r.db);
        const c = r.목록.건수;
        set끝난말(
          `되살렸습니다. 제안서 ${c.제안서}건 · 페이지 ${c.페이지}장 · ` +
          `원본 파일 ${r.맞춰본것.원본}개 · 미리보기 ${r.맞춰본것.미리보기}장. ` +
          `해시까지 모두 맞았습니다. 화면이 바뀐 것을 확인해 주십시오.`,
        );
      } else {
        const 들온것 = await 들여오기(f);
        setDb(() => 들온것);
        set끝난말("예전 방식(JSON) 백업을 들여왔습니다. 원본 파일은 이 방식에 담기지 않으므로 빠져 있습니다.");
      }
    } catch (e: any) {
      set탈난말(e?.message ?? "들여오지 못했습니다");
    }
    set하는중(null);
  };

  const 고르기 = (묶음: boolean) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) { 치우기(); set들일것({ f, 묶음 }); }
  };

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <h1>보관하기</h1>

      <p className="saynote" style={{ marginBottom: 18 }}>
        지금 자료는 <b>이 브라우저 안에만</b> 있습니다.
        다른 컴퓨터나 휴대폰에서 열면 보이지 않고, 브라우저 기록을 지우면 함께 지워집니다.
        중요한 작업을 하신 날에는 아래에서 <b>전체 백업</b>을 한 번 저장해 회사 자료함에 두십시오.
        <br /><b>전체 백업</b>에는 제안서·분류·규칙·대화·미리보기에 더해
        올리신 <b>원본 파일(.ai · PPTX · PDF · 사진)까지</b> 들어갑니다. 파일 하나면 그대로 되살아납니다.
      </p>

      <div className="status" style={{ marginBottom: 18 }}>
        <div><b>{db.projects.length}</b> 제안서</div>
        <div><b>{db.library.length}</b> 자료<small>{원본수}개 원본 · {그림수}장 그림</small></div>
        <div><b>{db.rules.length}</b> 규칙</div>
        <div><b>{db.pageTypes.filter((t) => !t.builtIn).length}</b> 직접 만든 페이지</div>
      </div>

      <div className="row" style={{ gap: 9, flexWrap: "wrap" }}>
        <button className="btn primary" disabled={!!하는중} onClick={() => void 전체담기()}>
          {하는중 ? "담는 중…" : "전체 백업"}
        </button>
        <label className="btn" style={하는중 ? { opacity: .45, pointerEvents: "none" } : undefined}>
          전체 복원
          <input type="file" accept="application/zip,.zip" className="숨은칸"
            disabled={!!하는중} onChange={고르기(true)} />
        </label>
      </div>

      {하는중 && (
        <p className="lede" style={{ marginTop: 12 }}>
          <b>{하는중.단계}</b>
          {하는중.전부 > 1 && <> — {하는중.끝난} / {하는중.전부}</>}
          {하는중.지금 && <small style={{ display: "block", color: "var(--muted)" }}>{하는중.지금}</small>}
        </p>
      )}

      {들일것 && (
        <div className="정말칸">
          <b>{들일것.f.name} 로 되살립니다</b>
          <small>
            지금 이 브라우저에 있는 것을 <b>전부 덮어씁니다.</b> 되돌릴 수 없습니다.
            {들일것.묶음 && !비었나 && <><br />되살리기 직전에 <b>지금 자료를 한 벌 자동으로 내려받습니다</b> — 잘못 고르셨어도 그 파일로 돌아올 수 있습니다.</>}
            {들일것.묶음 && <><br />파일이 상했거나 빠졌으면 <b>손대기 전에 멈춥니다.</b></>}
          </small>
          <div className="row" style={{ marginTop: 9 }}>
            <button className="btn sm danger" onClick={() => void 되살리기(들일것.f, 들일것.묶음)}>되살리기</button>
            <button className="btn sm" onClick={() => set들일것(null)}>취소</button>
          </div>
        </div>
      )}

      {반만 && (
        <div className="정말칸" style={{ marginTop: 14 }}>
          <b>일부가 빠진 채로 저장됐습니다 — 전체 백업이 아닙니다</b>
          <small>
            담지 못한 것이 {반만.빠진것.length}개 있습니다.
            이 파일로 되살리면 그만큼 비어 있게 됩니다. 아래를 확인하신 뒤 다시 백업해 주십시오.
            <br />{반만.빠진것.slice(0, 8).map((x) => `${x.이름} — ${x.까닭}`).join(" / ")}
            {반만.빠진것.length > 8 && ` 외 ${반만.빠진것.length - 8}개`}
          </small>
        </div>
      )}

      {끝난말 && <p className="goodnote">{끝난말}</p>}
      {탈난말 && <p className="gateerr">{탈난말}</p>}

      <h1 style={{ marginTop: 30 }}>예전 방식 (JSON)</h1>
      <p className="lede">
        전에 쓰던 백업입니다. <b>원본 파일이 담기지 않습니다</b> — 제안서와 미리보기까지만 들어갑니다.
        전에 받아 두신 <b>.json</b> 파일을 읽기 위해 남겨 두었습니다. 새로 받으실 때는 위의 <b>전체 백업</b>을 쓰십시오.
      </p>
      <div className="row" style={{ gap: 9, flexWrap: "wrap" }}>
        <button className="btn sm" disabled={!!하는중} onClick={() => {
          치우기(); set하는중({ 단계: "담는 중", 끝난: 0, 전부: 1 });
          내려받기(db)
            .then((r) => set끝난말(`${r.이름} (${prettySize(r.크기)}) 저장했습니다. 원본 파일은 빠져 있습니다.`))
            .catch((e) => set탈난말(e?.message ?? "내려받지 못했습니다"))
            .finally(() => set하는중(null));
        }}>간편 백업 (JSON)</button>
        <label className="btn sm" style={하는중 ? { opacity: .45, pointerEvents: "none" } : undefined}>
          예전 백업(JSON) 복원
          <input type="file" accept="application/json,.json" className="숨은칸"
            disabled={!!하는중} onChange={고르기(false)} />
        </label>
      </div>

      <h1 style={{ marginTop: 30 }}>평소에는</h1>
      <p className="lede">
        따로 저장하실 것이 없습니다. 고치는 즉시 저장됩니다 —
        화면 오른쪽 위 <b>저장됨 00:00</b> 이 그 표시입니다.
        여기 <b>전체 백업</b> 은 그와 별개로, 컴퓨터가 바뀌거나 탈이 났을 때를 위한 것입니다.
      </p>
      <p className="lede">
        회사 서버(Firebase)를 붙이면 이 일이 저절로 됩니다 —
        어느 컴퓨터에서 열어도 같은 자료가 보이고, 휴대폰에서도 열립니다.
        그때까지는 이 파일 하나가 그 몫을 합니다.
      </p>
    </div>
  );
}
