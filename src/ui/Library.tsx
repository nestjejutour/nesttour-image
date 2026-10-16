import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, LibItem } from "../core/types";
import { 미리보기뽑기 } from "../core/thumb";
import { getThumb, putThumb, delThumb } from "../store/thumbs";
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
  onRename: (id: string, name: string) => void;
  onMove: (id: string, categoryId: string) => void;
}

export function Library({ sel, categories, items, byName, onAdd, onRemove, onRename, onMove }: Props) {
  const [끄는중, set끄는중] = useState(false);
  const [담는중, set담는중] = useState<{ 끝난: number; 전부: number; 지금: string } | null>(null);
  const [찾기, set찾기] = useState("");
  const [크게, set크게] = useState<LibItem | null>(null);
  const [고치는이름, set고치는이름] = useState<string | null>(null);
  const [메뉴, set메뉴] = useState<string | null>(null);
  /** 방금 담은 개수 — 잠깐 보였다 사라진다 */
  const [방금, set방금] = useState<number | null>(null);

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
      담긴.push({
        id,
        name: f.name.replace(/\.[^.]+$/, ""),
        categoryId: 담을곳,
        fileName: f.name,
        size: f.size,
        w: 그림.w, h: 그림.h,
        noThumb: 그림.thumb ? undefined : (그림.못뽑은까닭 ?? "그림을 못 뽑았습니다"),
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

  return (
    <div className="lib">
      <div className="libhead">
        <b>자료</b>
        <small>{보일것.length}개{못뽑은수 > 0 && ` · 그림 못 뽑음 ${못뽑은수}개`}</small>
        {방금 !== null && <small className="방금">{방금}개 담아 저장했습니다</small>}
        <div className="spacer" />
        {보일것.length > 0 && (
          <input className="libfind" placeholder="이름으로 찾기"
            value={찾기} onChange={(e) => set찾기(e.target.value)} />
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
            </small>
          </>
        )}
      </div>

      {보일것.length > 0 && (
        <div className="libgrid">
          {보일것.map((x) => (
            <div className="libcard" key={x.id}>
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
                    <small>옮기기</small>
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
                  <button className="빨강" onClick={() => { void delThumb(x.id); onRemove(x.id); set메뉴(null); }}>
                    지우기
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
