import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, LibItem } from "../core/types";
import { 미리보기뽑기 } from "../core/thumb";
import { getThumb, putThumb, delThumb, putFile, getFile, delFile, 쓰는자리 } from "../store/thumbs";
import { uid } from "../store/db";
import { prettySize } from "../core/intake";

/**
 * 자료함 — 분류에 쌓아 두는 것들
 *
 * 현수막 .ai 100장처럼 "제안서가 아닌 것" 을 분류별로 모아 두고 꺼내 본다.
 * 한 번에 여러 개를 끌어다 놓으면 차례로 미리보기를 뽑아 담는다.
 *
 * 원본은 담지 않는다. 그건 회사 자료함에 그대로 둔다 — 여기엔 보고 고를 그림만.
 */

interface Props {
  /** 지금 고른 분류 ("all" 이면 전체) */
  sel: string;
  categories: Category[];
  items: LibItem[];
  byName?: string;
  onAdd: (items: LibItem[]) => void;
  onRemove: (id: string) => void;
  onRemoveMany: (ids: string[]) => void;
  onRename: (id: string, name: string) => void;
  onMove: (id: string, categoryId: string) => void;
}

export function Library({ sel, categories, items, byName, onAdd, onRemove, onRemoveMany, onRename, onMove }: Props) {
  const [끄는중, set끄는중] = useState(false);
  const [담는중, set담는중] = useState<{ 끝난: number; 전부: number; 지금: string } | null>(null);
  const [찾기, set찾기] = useState("");
  const [크게, set크게] = useState<LibItem | null>(null);
  const [고치는이름, set고치는이름] = useState<string | null>(null);
  const [메뉴, set메뉴] = useState<string | null>(null);
  /** 방금 담은 개수 — 잠깐 보였다 사라진다 */
  const [방금, set방금] = useState<number | null>(null);
  /** 체크를 푼 것들. 기본은 전부 체크다 — 푼 것만 기억하면 된다 */
  const [뺀것, set뺀것] = useState<Set<string>>(() => new Set());
  const [내리는중, set내리는중] = useState("");
  const [자리, set자리] = useState("");

  /** 담을 곳 — 전체를 보고 있으면 첫 분류에 담는다 */
  const 담을곳 = sel !== "all" ? sel : (categories[0]?.id ?? "");
  const 담을곳이름 = categories.find((c) => c.id === 담을곳)?.name ?? "";

  const 보일것 = useMemo(() => {
    const 범위 = sel === "all"
      ? null
      : new Set([sel, ...categories.filter((c) => c.parentId === sel).map((c) => c.id)]);
    const q = 찾기.trim().toLowerCase();
    return items
      .filter((x) => (범위 ? 범위.has(x.categoryId) : true))
      .filter((x) => !q || x.name.toLowerCase().includes(q) || (x.tags ?? []).join(" ").toLowerCase().includes(q))
      .sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
  }, [items, sel, categories, 찾기]);

  useEffect(() => {
    void 쓰는자리().then((r) => {
      if (r?.쓴것) set자리(`${prettySize(r.쓴것)} 씀`);
    });
  }, [items.length]);

  useEffect(() => {
    if (!메뉴) return;
    const 닫기 = () => set메뉴(null);
    window.addEventListener("pointerdown", 닫기);
    return () => window.removeEventListener("pointerdown", 닫기);
  }, [메뉴]);

  /** 받은 파일들을 하나씩 담는다. 100개를 한꺼번에 돌리면 화면이 멈춘다 */
  const 받기 = async (files: File[]) => {
    if (!files.length || !담을곳) return;
    const 담긴: LibItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      set담는중({ 끝난: i, 전부: files.length, 지금: f.name });
      const 그림 = await 미리보기뽑기(f);
      const id = uid();
      if (그림.thumb) {
        try { await putThumb(id, 그림.thumb); } catch { /* 그림만 없이 담는다 */ }
      }
      // 원본도 품는다. 나중에 그대로 내려받아 쓰기 위함이다.
      let 품었나 = false;
      let 못품은까닭 = "";
      try { await putFile(id, f); 품었나 = true; }
      catch (e: any) { 못품은까닭 = e?.name === "QuotaExceededError" ? "저장 자리가 모자랍니다" : "원본을 못 담았습니다"; }
      담긴.push({
        id,
        name: f.name.replace(/\.[^.]+$/, ""),
        categoryId: 담을곳,
        fileName: f.name,
        size: f.size,
        w: 그림.w, h: 그림.h,
        noThumb: 그림.thumb ? undefined : (그림.못뽑은까닭 ?? "그림을 못 뽑았습니다"),
        hasFile: 품었나,
        noFile: 품었나 ? undefined : 못품은까닭,
        addedAt: new Date(Date.now() - i).toISOString(),   // 고른 차례를 지킨다
        byName,
      });
      // 화면이 숨 쉴 틈을 준다
      await new Promise((r) => setTimeout(r, 0));
    }
    set담는중(null);
    onAdd(담긴);
    set방금(담긴.length);
    setTimeout(() => set방금(null), 4000);
  };

  const 못뽑은수 = 보일것.filter((x) => x.noThumb).length;
  const 고른것 = 보일것.filter((x) => !뺀것.has(x.id));
  const 원본없는수 = 보일것.filter((x) => !x.hasFile).length;
  const 받을수있는수 = 고른것.filter((x) => x.hasFile).length;
  const 다골랐나 = 고른것.length === 보일것.length && 보일것.length > 0;

  /** 고른 것을 한꺼번에 삭제한다 */
  const 일괄삭제 = async () => {
    if (!고른것.length) return;
    if (!confirm(`고르신 ${고른것.length}개를 삭제합니다.\n되돌릴 수 없습니다. 이어서 하시겠습니까?`)) return;
    for (const x of 고른것) {
      try { await delThumb(x.id); } catch { /* 없으면 넘어간다 */ }
      try { await delFile(x.id); } catch { /* 없으면 넘어간다 */ }
    }
    onRemoveMany(고른것.map((x) => x.id));
    set뺀것(new Set());
  };

  /** 고른 것을 원본 그대로 내려받는다. 여러 개면 묶음(zip) 한 덩어리로 */
  const 내려받기 = async () => {
    const 받을것 = 고른것.filter((x) => x.hasFile);
    if (!받을것.length) return;
    set내리는중("담는 중…");
    try {
      if (받을것.length === 1) {
        const b = await getFile(받을것[0].id);
        if (b) 떨구기(b, 받을것[0].fileName);
      } else {
        const { zipSync } = await import("fflate");
        const 짐: Record<string, Uint8Array> = {};
        const 쓴이름 = new Set<string>();
        for (let i = 0; i < 받을것.length; i++) {
          set내리는중(`${i + 1} / ${받을것.length} 담는 중…`);
          const b = await getFile(받을것[i].id);
          if (!b) continue;
          // 같은 이름이 둘이면 뒤엣것이 앞엣것을 덮는다. 번호를 붙여 피한다.
          let 이름 = 받을것[i].fileName;
          for (let n = 2; 쓴이름.has(이름); n++) {
            이름 = 받을것[i].fileName.replace(/(\.[^.]+)?$/, (ext) => ` (${n})${ext}`);
          }
          쓴이름.add(이름);
          짐[이름] = new Uint8Array(await b.arrayBuffer());
          await new Promise((r) => setTimeout(r, 0));
        }
        set내리는중("묶는 중…");
        // 이미 눌린 파일들이라 다시 눌러도 줄지 않는다. 그냥 담기만 한다(level 0).
        const zip = zipSync(짐, { level: 0 });
        const d = new Date();
        const 두 = (n: number) => String(n).padStart(2, "0");
        떨구기(new Blob([zip], { type: "application/zip" }),
              `자료-${d.getFullYear()}${두(d.getMonth() + 1)}${두(d.getDate())}-${받을것.length}개.zip`);
      }
    } finally {
      set내리는중("");
    }
  };

  return (
    <div className="lib">
      <div className="libhead">
        <b>자료</b>
        <small>{보일것.length}개{못뽑은수 > 0 && ` · 그림 못 뽑음 ${못뽑은수}개`}</small>
        {방금 !== null && <small className="방금">{방금}개 담아 저장했습니다</small>}
        {자리 && <small title="이 기기에서 쓰고 있는 자리">{자리}</small>}
        <div className="spacer" />
        {보일것.length > 0 && (
          <input className="libfind" placeholder="이름으로 찾기"
            value={찾기} onChange={(e) => set찾기(e.target.value)} />
        )}
        {보일것.length > 0 && (
          <>
            <label className="allpick" title="전체 고르기">
              <input type="checkbox" checked={다골랐나}
                onChange={(e) => set뺀것(e.target.checked ? new Set() : new Set(보일것.map((x) => x.id)))} />
              <span>전체</span>
            </label>
            <small className="골랐수">{고른것.length}개 선택</small>
            <button className="btn sm" disabled={!!내리는중 || !받을수있는수}
              title={받을수있는수
                ? "선택한 자료를 원본 그대로 내려받습니다"
                : "선택한 자료에 원본이 없습니다. 다시 끌어다 놓으시면 원본까지 담깁니다"}
              onClick={() => void 내려받기()}>
              {내리는중 || `저장 ${받을수있는수}개`}
            </button>
            <button className="btn sm danger" disabled={!고른것.length || !!내리는중}
              title="선택한 자료를 삭제합니다"
              onClick={() => void 일괄삭제()}>
              삭제 {고른것.length}개
            </button>
          </>
        )}
        <label className="btn sm primary">
          + 파일 넣기
          <input type="file" multiple hidden
            onChange={(e) => {
              const fs = Array.from(e.target.files ?? []);
              e.target.value = "";
              void 받기(fs);
            }} />
        </label>
      </div>

      <div
        className={`libdrop ${끄는중 ? "들어옴" : ""}`}
        onDragOver={(e) => { e.preventDefault(); set끄는중(true); }}
        onDragLeave={() => set끄는중(false)}
        onDrop={(e) => {
          e.preventDefault(); set끄는중(false);
          void 받기(Array.from(e.dataTransfer.files ?? []));
        }}
      >
        {담는중 ? (
          <>
            <b>{담는중.끝난 + 1} / {담는중.전부} 담는 중</b>
            <div className="libbar"><i style={{ width: `${((담는중.끝난 + 1) / 담는중.전부) * 100}%` }} /></div>
            <small>{담는중.지금}</small>
          </>
        ) : (
          <>
            <b>여기에 파일을 끌어다 놓으세요</b>
            <small>
              {담을곳이름 ? `"${담을곳이름}" 에 들어갑니다. ` : ""}
              한 번에 여러 개, 폴더째 끌어다 놓아도 됩니다.
              일러스트(.ai)·PDF·사진에서 미리보기를 뽑습니다.
              <br />놓는 즉시 저장됩니다 — 따로 저장하실 것이 없습니다.
              {원본없는수 > 0 && (
                <><br /><b className="없음">
                  원본이 없는 자료가 {원본없는수}개 있습니다. 다시 끌어다 놓으시면 원본까지 담깁니다.
                </b></>
              )}
            </small>
          </>
        )}
      </div>

      {보일것.length > 0 && (
        <div className="libgrid">
          {보일것.map((x) => (
            <div className={`libcard ${뺀것.has(x.id) ? "" : "골랐음"}`} key={x.id}>
              <label className="libpick" title="고르기">
                <input type="checkbox" checked={!뺀것.has(x.id)}
                  onChange={(e) => set뺀것((t) => {
                    const n = new Set(t);
                    e.target.checked ? n.delete(x.id) : n.add(x.id);
                    return n;
                  })} />
              </label>
              <button className="libshot" onClick={() => set크게(x)} title="눌러서 크게 보기">
                <Thumb id={x.id} 없음={x.noThumb} />
              </button>
              {고치는이름 === x.id ? (
                <input className="librename" autoFocus defaultValue={x.name}
                  onBlur={(e) => { onRename(x.id, e.target.value); set고치는이름(null); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") set고치는이름(null);
                  }} />
              ) : (
                <div className="libname" title={x.fileName}>
                  <b>{x.name}</b>
                  <small>
                    {prettySize(x.size)}
                    {x.w && x.h ? ` · ${x.w}×${x.h}` : ""}
                    {!x.hasFile && <b className="없음"> · 원본 없음</b>}
                  </small>
                </div>
              )}
              <button className="rowbtn libmore" title="더 보기"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => set메뉴(메뉴 === x.id ? null : x.id)}>⋯</button>
              {메뉴 === x.id && (
                <div className="rowmenu" onPointerDown={(e) => e.stopPropagation()}>
                  <button onClick={() => { set고치는이름(x.id); set메뉴(null); }}>이름 바꾸기</button>
                  <label className="movepick">
                    <small>폴더 이동</small>
                    <select value={x.categoryId}
                      onChange={(e) => { onMove(x.id, e.target.value); set메뉴(null); }}>
                      {categories.filter((c) => !c.parentId).map((c) => {
                        const 속 = categories.filter((k) => k.parentId === c.id);
                        return 속.length ? (
                          <optgroup key={c.id} label={c.name}>
                            <option value={c.id}>{c.name} (바로 여기)</option>
                            {속.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                          </optgroup>
                        ) : (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        );
                      })}
                    </select>
                  </label>
                  <hr />
                  <button className="빨강"
                    onClick={() => { void delThumb(x.id); void delFile(x.id); onRemove(x.id); set메뉴(null); }}>
                    삭제
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {크게 && (
        <div className="bigview" onClick={() => set크게(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <Thumb id={크게.id} 없음={크게.noThumb} 큼 />
            <div className="bigbar">
              <b>{크게.name}</b>
              <small>{크게.fileName} · {prettySize(크게.size)}{크게.w ? ` · ${크게.w}×${크게.h}` : ""}</small>
              <div className="spacer" />
              <button className="btn sm" onClick={() => set크게(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 파일 하나를 내려받게 떨군다 */
function 떨구기(blob: Blob, 이름: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = 이름;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** 그림은 저장 칸(IndexedDB)에서 꺼내 온다 */
function Thumb({ id, 없음, 큼 }: { id: string; 없음?: string; 큼?: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  const 살아있나 = useRef(true);

  useEffect(() => {
    살아있나.current = true;
    if (없음) return;
    void getThumb(id).then((d) => { if (살아있나.current) setSrc(d ?? null); });
    return () => { 살아있나.current = false; };
  }, [id, 없음]);

  if (없음) return <span className="nothumb">{큼 ? 없음 : "그림 없음"}</span>;
  if (!src) return <span className="nothumb">…</span>;
  return <img src={src} alt="" className={큼 ? "big" : ""} />;
}
