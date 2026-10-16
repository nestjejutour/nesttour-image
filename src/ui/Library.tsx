import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, LibItem } from "../core/types";
import { 미리보기뽑기, 큰그림 } from "../core/thumb";
import { 피디에프인가 } from "../core/intake";
import { getThumb, putThumb, delThumb, putFile, getFile, delFile, 쓰는자리 } from "../store/thumbs";
import { uid } from "../store/db";
import { 분류옵션 } from "./분류칸";
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
  /**
   * 한 건에 딸린 자료함으로 쓸 때 그 건의 번호.
   * 주면 그 건의 자료만 다루고, 담는 것도 그 건에 붙는다.
   */
  projectId?: string;
  /** 머리말에 적을 말 */
  제목?: string;
  categories: Category[];
  items: LibItem[];
  byName?: string;
  onAdd: (items: LibItem[]) => void;
  onRemove: (id: string) => void;
  onRemoveMany: (ids: string[]) => void;
  onRename: (id: string, name: string) => void;
  onMove: (id: string, categoryId: string) => void;
  /** 폴더 이름으로 세부 분류를 만들어(이미 있으면 그대로) 번호를 돌려준다 */
  onMakeFolders: (parentId: string, names: string[]) => Record<string, string>;
  /** 메모 적기 */
  onNote: (id: string, note: string) => void;
  /** 바깥에서도 자료를 넣을 수 있게 담는 손을 건네준다 */
  onReady?: (담기: (files: File[]) => void) => void;
}

/** 전체 화면에 띄우는 최근 자료 수 */
const 최근몇개 = 12;

export function Library({ sel, projectId, 제목, categories, items, byName, onAdd, onRemove, onRemoveMany, onRename, onMove, onMakeFolders, onNote, onReady }: Props) {
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
  /** 삭제를 한 번 더 묻는 중 — 브라우저 창(confirm)은 틀 안에서 막히므로 화면 안에서 묻는다 */
  const [지울까, set지울까] = useState(false);
  const [탈난말, set탈난말] = useState("");
  /** 방금 만들어진 세부 분류 이름들 */
  const [만든폴더, set만든폴더] = useState<string[]>([]);

  /**
   * 담을 곳.
   *
   * "전체" 를 보고 있을 때 첫 분류에 몰래 넣었는데, 그러면 어디로 갔는지 모른다.
   * 분류를 고르기 전에는 받지 않는다.
   */
  const 담을곳 = projectId ? (sel !== "all" ? sel : "건") : (sel !== "all" ? sel : "");
  const 담을곳이름 = categories.find((c) => c.id === 담을곳)?.name ?? "";

  const 보일것 = useMemo(() => {
    const 범위 = sel === "all"
      ? null
      : new Set([sel, ...categories.filter((c) => c.parentId === sel).map((c) => c.id)]);
    const q = 찾기.trim().toLowerCase();
    return items
      // 한 건의 자료함이면 그 건의 것만, 분류의 자료함이면 건에 딸리지 않은 것만.
      // 섞어 놓으면 분류 자료함이 건별 자료로 뒤덮인다.
      .filter((x) => (projectId ? x.projectId === projectId : !x.projectId))
      .filter((x) => (projectId ? true : 범위 ? 범위.has(x.categoryId) : true))
      .filter((x) => !q || x.name.toLowerCase().includes(q) || (x.tags ?? []).join(" ").toLowerCase().includes(q))
      .sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
  }, [items, sel, categories, 찾기]);

  // 빈 제안서 자리에서도 같은 손으로 담는다. 길이 둘이면 코드도 둘이 되면 안 된다.
  useEffect(() => { onReady?.(받기안전); });

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
  const 받기 = async (받은것: File[]) => {
    set탈난말("");
    // 윈도우·맥이 폴더마다 끼워 넣는 것들. 섞여 들어오면 목록이 지저분해진다.
    const 찌꺼기 = /^(\.|~\$)|^(Thumbs\.db|desktop\.ini|\.DS_Store)$/i;
    const files = 받은것.filter((f) => f.size > 0 && !찌꺼기.test(f.name));
    if (!files.length) {
      if (받은것.length) set탈난말("담을 수 있는 파일이 없습니다.");
      return;
    }
    if (!담을곳) {
      set탈난말("왼쪽에서 분류를 먼저 고르십시오. 어디에 담을지 정해야 합니다.");
      return;
    }
    // 고르자마자 보여 준다. 큰 파일은 그림 뽑는 데 몇 초 걸려 멎은 줄 안다.
    set담는중({ 끝난: 0, 전부: files.length, 지금: files[0].name });

    /**
     * 폴더째 담았으면 그 폴더를 세부 분류로 만든다.
     *
     * 길의 맨 앞이 지금 고른 분류와 같은 이름이면 그건 껍데기다 (그 분류를 고르고
     * 같은 이름 폴더를 담은 것). 벗겨 낸다.
     * 세부 분류는 한 겹까지라, 여러 겹이면 가장 안쪽 이름을 쓴다 — 그게 제일 또렷하다.
     */
    const 지금이름 = categories.find((c) => c.id === 담을곳)?.name;
    const 세부분류이름 = (f: File) => {
      let 토막 = 속한폴더(f);
      if (토막[0] && 지금이름 && 토막[0] === 지금이름) 토막 = 토막.slice(1);
      return 토막.length ? 토막[토막.length - 1] : "";
    };
    // 세부 분류 밑에 담고 있으면 더 깊이 못 판다. 그때는 꼬리표로만 남긴다.
    // 한 건에 딸린 자료는 분류를 늘리지 않는다. 그 건 안에서 끝나는 자료다.
    const 세부가능 = !projectId && !categories.find((c) => c.id === 담을곳)?.parentId;
    const 만들이름 = 세부가능
      ? [...new Set(files.map(세부분류이름).filter(Boolean))]
      : [];
    const 폴더번호 = 만들이름.length ? onMakeFolders(담을곳, 만들이름) : {};

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
        categoryId: 폴더번호[세부분류이름(f)] ?? 담을곳,
        projectId,
        fileName: f.name,
        size: f.size,
        w: 그림.w, h: 그림.h, mmW: 그림.mmW, mmH: 그림.mmH,
        noThumb: 그림.thumb ? undefined : (그림.못뽑은까닭 ?? "그림을 못 뽑았습니다"),
        hasFile: 품었나,
        noFile: 품었나 ? undefined : 못품은까닭,
        tags: 속한폴더(f).length ? 속한폴더(f) : undefined,
        addedAt: new Date(Date.now() - i).toISOString(),   // 고른 차례를 지킨다
        byName,
      });
      // 화면이 숨 쉴 틈을 준다
      await new Promise((r) => setTimeout(r, 0));
    }
    set담는중(null);
    if (!담긴.length) { set탈난말("담긴 것이 없습니다. 다시 시도해 주십시오."); return; }
    onAdd(담긴);
    set방금(담긴.length);
    if (만들이름.length) set만든폴더(만들이름);
    setTimeout(() => set만든폴더([]), 6000);
    setTimeout(() => set방금(null), 4000);
  };

  /** 탈이 나도 조용히 넘어가면 안 된다 */
  const 받기안전 = (files: File[]) =>
    받기(files).catch((e: any) => {
      set담는중(null);
      set탈난말(e?.message ?? "자료를 담지 못했습니다");
    });

  /** 전체를 볼 때는 최근 것만. 분류를 고르면 전부 */
  const 줄일까 = sel === "all" && 보일것.length > 최근몇개 && !찾기.trim();
  const 펼친것 = 줄일까 ? 보일것.slice(0, 최근몇개) : 보일것;
  const 못뽑은수 = 보일것.filter((x) => x.noThumb).length;
  const 고른것 = 보일것.filter((x) => !뺀것.has(x.id));
  const 원본없는수 = 보일것.filter((x) => !x.hasFile).length;
  const 받을수있는수 = 고른것.filter((x) => x.hasFile).length;
  const 다골랐나 = 고른것.length === 보일것.length && 보일것.length > 0;

  /** 고른 것을 한꺼번에 삭제한다 */
  const 일괄삭제 = async () => {
    set지울까(false);
    if (!고른것.length) return;
    for (const x of 고른것) {
      try { await delThumb(x.id); } catch { /* 없으면 넘어간다 */ }
      try { await delFile(x.id); } catch { /* 없으면 넘어간다 */ }
    }
    onRemoveMany(고른것.map((x) => x.id));
    set뺀것(new Set());
  };

  /** 고른 것을 원본 그대로 내려받는다. 여러 개면 묶음(zip) 한 덩어리로 */
  const 내려받기 = async (피디에프로 = false) => {
    const 받을것 = 고른것.filter((x) => x.hasFile);
    if (!받을것.length) return;
    set내리는중("담는 중…");
    try {
      /** .ai 를 PDF 로 바꿔 달라고 했으면 이름만 바꾼다 — 속이 이미 PDF 다 */
      const 바꿔 = async (b: Blob, 이름: string): Promise<[Blob, string]> =>
        피디에프로 && /\.ai$/i.test(이름) && (await 피디에프인가(b))
          ? [new Blob([b], { type: "application/pdf" }), 이름.replace(/\.ai$/i, ".pdf")]
          : [b, 이름];

      if (받을것.length === 1) {
        const b = await getFile(받을것[0].id);
        if (b) { const [바뀐, 이름] = await 바꿔(b, 받을것[0].fileName); 떨구기(바뀐, 이름); }
      } else {
        const { zipSync } = await import("fflate");
        const 짐: Record<string, Uint8Array> = {};
        const 쓴이름 = new Set<string>();
        for (let i = 0; i < 받을것.length; i++) {
          set내리는중(`${i + 1} / ${받을것.length} 담는 중…`);
          const b = await getFile(받을것[i].id);
          if (!b) continue;
          // 같은 이름이 둘이면 뒤엣것이 앞엣것을 덮는다. 번호를 붙여 피한다.
          const [바뀐, 첫이름] = await 바꿔(b, 받을것[i].fileName);
          let 이름 = 첫이름;
          for (let n = 2; 쓴이름.has(이름); n++) {
            이름 = 첫이름.replace(/(\.[^.]+)?$/, (ext) => ` (${n})${ext}`);
          }
          쓴이름.add(이름);
          짐[이름] = new Uint8Array(await 바뀐.arrayBuffer());
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
        <b>{제목 ?? "자료"}</b>
        {!projectId && <small className="무슨칸">참고용 — 제안서가 아닌 것</small>}
        <small>{보일것.length}개{못뽑은수 > 0 && ` · 그림 못 뽑음 ${못뽑은수}개`}</small>
        {방금 !== null && <small className="방금">{방금}개 담아 저장했습니다</small>}
        {만든폴더.length > 0 && (
          <small className="방금">폴더 {만든폴더.join(" · ")} 를 분류로 만들었습니다</small>
        )}
        {자리 && 보일것.length > 0 && (
          <small title="이 기기(브라우저)가 쓰고 있는 저장 공간 전체입니다">저장 공간 {자리}</small>
        )}
        {고른것.length > 0 && 받을수있는수 === 0 && (
          <small className="없음">선택한 자료에 원본이 없어 저장할 수 없습니다</small>
        )}
        <div className="spacer" />
        {보일것.length > 0 && (
          <input className="libfind" placeholder="이름으로 찾기"
            value={찾기} onChange={(e) => set찾기(e.target.value)} />
        )}
        <label className="btn sm" title="폴더를 통째로 담습니다 (안의 파일을 모두)">
          + 폴더 추가
          <input type="file" multiple className="숨은칸" disabled={!담을곳}
            ref={(el) => { if (el) { el.webkitdirectory = true; el.setAttribute("webkitdirectory", ""); } }}
            onChange={(e) => {
              const fs = Array.from(e.target.files ?? []);
              e.target.value = "";
              void 받기안전(fs);
            }} />
        </label>
        {보일것.length > 0 && (
          <>
            <label className="allpick" title="전체 고르기">
              <input type="checkbox" checked={다골랐나}
                onChange={(e) => set뺀것(e.target.checked ? new Set() : new Set(보일것.map((x) => x.id)))} />
              <span>전체</span>
            </label>
            <small className="골랐수">{고른것.length}개 선택</small>
            {고른것.some((x) => x.hasFile && /\.ai$/i.test(x.fileName)) && (
              <button className="btn sm" disabled={!!내리는중 || !받을수있는수}
                title="고른 일러스트 파일을 PDF 로 바꿔 내려받습니다"
                onClick={() => void 내려받기(true)}>
                PDF로 저장
              </button>
            )}
            <button className="btn sm" disabled={!!내리는중 || !받을수있는수}
              title={받을수있는수
                ? "선택한 자료의 원본 파일을 내 컴퓨터로 내려받습니다"
                : "선택한 자료에 원본이 없습니다. 다시 끌어다 놓으시면 원본까지 담깁니다"}
              onClick={() => void 내려받기()}>
              {내리는중 || `내 PC로 저장 ${받을수있는수}개`}
            </button>
            {지울까 ? (
              <span className="정말">
                <b>{고른것.length}개를 삭제할까요?</b>
                <button className="btn sm danger" onClick={() => void 일괄삭제()}>삭제</button>
                <button className="btn sm" onClick={() => set지울까(false)}>취소</button>
              </span>
            ) : (
              <button className="btn sm danger" disabled={!고른것.length || !!내리는중}
                title="선택한 자료를 삭제합니다"
                onClick={() => set지울까(true)}>
                삭제 {고른것.length}개
              </button>
            )}
          </>
        )}
        <label className="btn sm primary">
          + 파일 추가
          {/* display:none 으로 숨기면 파일이 안 꽂히는 브라우저가 있다. 자리만 지운다 */}
          <input type="file" multiple className="숨은칸"
            onChange={(e) => {
              const fs = Array.from(e.target.files ?? []);
              e.target.value = "";
              void 받기안전(fs);
            }} />
        </label>
      </div>

      <label
        className={`libdrop ${끄는중 ? "들어옴" : ""} ${담을곳 ? "" : "잠김"}`}
        onDragOver={(e) => { e.preventDefault(); set끄는중(true); }}
        onDragLeave={() => set끄는중(false)}
        onDrop={(e) => {
          e.preventDefault(); set끄는중(false);
          void 놓은것펼치기(e.dataTransfer).then(받기안전);
        }}
      >
        <input type="file" multiple className="숨은칸" disabled={!담을곳}
          onChange={(e) => {
            const fs = Array.from(e.target.files ?? []);
            e.target.value = "";
            void 받기안전(fs);
          }} />
        {담는중 ? (
          <>
            <b>{담는중.끝난 + 1} / {담는중.전부} 담는 중</b>
            <div className="libbar"><i style={{ width: `${((담는중.끝난 + 1) / 담는중.전부) * 100}%` }} /></div>
            <small>{담는중.지금}</small>
          </>
        ) : (
          <>
            <b>{담을곳 ? "여기에 파일을 끌어다 놓거나, 눌러서 고르십시오" : "왼쪽에서 분류를 먼저 고르십시오"}</b>
            <small>
              {projectId
                ? "이 건의 자료로 담깁니다. "
                : 담을곳이름
                  ? `"${담을곳이름}" 에 들어갑니다. `
                  : "어디에 담을지 정해야 받을 수 있습니다. "}
              {projectId
                ? "한 번에 여러 개, 폴더째 끌어다 놓아도 됩니다."
                : "폴더째 끌어다 놓으면 그 폴더가 세부 분류로 생기고 안의 파일이 담깁니다."}
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
      </label>
      {탈난말 && <p className="gateerr">{탈난말}</p>}

      {펼친것.length > 0 && (
        <div className="libgrid">
          {펼친것.map((x) => (
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
                    {규격(x) ? ` · ${규격(x)}` : ""}
                    {!x.hasFile && <b className="없음"> · 원본 없음</b>}
                  </small>
                </div>
              )}
              <button className="rowbtn libmore" title="더 보기"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => set메뉴(메뉴 === x.id ? null : x.id)}>⋯</button>
              {메뉴 === x.id && (
                <div className="rowmenu" onPointerDown={(e) => e.stopPropagation()}>
                  <button onClick={() => { set고치는이름(x.id); set메뉴(null); }}>이름 변경</button>
                  {!projectId && <label className="movepick">
                    <small>폴더 이동</small>
                    <select value={x.categoryId}
                      onChange={(e) => { onMove(x.id, e.target.value); set메뉴(null); }}>
                      <분류옵션 categories={categories} />
                    </select>
                  </label>}
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

      {줄일까 && (
        <p className="lede" style={{ marginTop: 9, fontSize: 13.5 }}>
          최근 {최근몇개}개만 보입니다. 왼쪽에서 분류를 고르시면 그 분류의 자료가 모두 보입니다
          (전체 {보일것.length}개).
        </p>
      )}

      {크게 && (() => {
        const 자리 = 보일것.findIndex((x) => x.id === 크게.id);
        const 넘기기 = (d: number) => {
          const n = 보일것[자리 + d];
          if (n) set크게(n);
        };
        const 분류이름 = categories.find((c) => c.id === 크게.categoryId)?.name ?? "";
        return (
        <div className="한장" onClick={() => set크게(null)}>
          <div className="한장틀" onClick={(e) => e.stopPropagation()}>
            <div className="한장머리">
              <b>{크게.name}</b>
              <small>{분류이름}{자리 >= 0 ? ` · ${자리 + 1} / ${보일것.length}` : ""}</small>
              <div className="spacer" />
              <button className="btn sm" onClick={() => set크게(null)}>닫기</button>
            </div>

            <div className="한장몸">
              <div className="한장그림">
                <button className="넘김" disabled={자리 <= 0}
                  onClick={() => 넘기기(-1)} aria-label="앞 자료">‹</button>
                <큰보기 x={크게} />
                <button className="넘김" disabled={자리 < 0 || 자리 >= 보일것.length - 1}
                  onClick={() => 넘기기(1)} aria-label="뒤 자료">›</button>
              </div>

              <div className="한장옆">
                <label className="field">
                  <small>이름</small>
                  <input defaultValue={크게.name} key={`n${크게.id}`}
                    onBlur={(e) => { onRename(크게.id, e.target.value); set크게({ ...크게, name: e.target.value.trim() || 크게.name }); }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
                </label>

                <label className="field">
                  <small>폴더</small>
                  <select value={크게.categoryId}
                    onChange={(e) => { onMove(크게.id, e.target.value); set크게({ ...크게, categoryId: e.target.value }); }}>
                    <분류옵션 categories={categories} />
                  </select>
                </label>

                <label className="field">
                  <small>메모</small>
                  <textarea rows={4} defaultValue={크게.note ?? ""} key={`m${크게.id}`}
                    placeholder="쓰임새, 치수, 주의할 점…"
                    onBlur={(e) => { onNote(크게.id, e.target.value); set크게({ ...크게, note: e.target.value }); }} />
                </label>

                <dl className="한장표">
                  <dt>원본 파일</dt><dd>{크게.fileName}</dd>
                  <dt>파일 크기</dt><dd>{prettySize(크게.size)}</dd>
                  {규격(크게) && <><dt>인쇄 규격</dt><dd><b>{규격(크게)}</b></dd></>}
                  {크게.w && !크게.mmW && <><dt>픽셀</dt><dd>{크게.w} × {크게.h}</dd></>}
                  <dt>담은 날</dt><dd>{new Date(크게.addedAt).toLocaleString("ko-KR")}</dd>
                  {크게.byName && <><dt>담은 사람</dt><dd>{크게.byName}</dd></>}
                  {크게.tags?.length && <><dt>원래 폴더</dt><dd>{크게.tags.join(" / ")}</dd></>}
                </dl>

                <div className="row" style={{ gap: 7, flexWrap: "wrap" }}>
                  <button className="btn primary" disabled={!크게.hasFile}
                    title={크게.hasFile ? "원본 파일을 내 컴퓨터로 내려받습니다" : "원본이 없습니다"}
                    onClick={async () => {
                      const b = await getFile(크게.id);
                      if (b) 떨구기(b, 크게.fileName);
                    }}>
                    원본 저장
                  </button>
                  {크게.hasFile && /\.ai$/i.test(크게.fileName) && (
                    <button className="btn"
                      title="일러스트 파일을 PDF 로 저장합니다 (PDF 호환으로 저장된 파일이면 그대로 열립니다)"
                      onClick={async () => {
                        const b = await getFile(크게.id);
                        if (!b) return;
                        if (!(await 피디에프인가(b))) {
                          set탈난말("PDF 호환으로 저장된 파일이 아니라 PDF 로 바꿀 수 없습니다.");
                          return;
                        }
                        떨구기(new Blob([b], { type: "application/pdf" }),
                              크게.fileName.replace(/\.ai$/i, ".pdf"));
                      }}>
                      PDF로 저장
                    </button>
                  )}
                  <button className="btn danger"
                    onClick={() => {
                      void delThumb(크게.id); void delFile(크게.id);
                      onRemove(크게.id); set크게(null);
                    }}>
                    삭제
                  </button>
                </div>

                {!크게.hasFile && (
                  <p className="saynote">
                    원본이 없습니다. 이 자료를 다시 끌어다 놓으시면 원본까지 담깁니다.
                  </p>
                )}
                <p className="lede" style={{ fontSize: 13 }}>
                  일러스트 파일은 브라우저에서 고칠 수 없습니다.
                  <b> 내 PC로 저장</b> 으로 원본을 받아 일러스트에서 여십시오.
                </p>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

/**
 * 그 파일이 어느 폴더에 있었는가.
 *
 * 폴더째 담으면 webkitRelativePath 에 "현수막/개인/팔음초.ai" 처럼 길이 담긴다.
 * 맨 앞(고른 폴더 이름)과 파일 이름을 빼고 남는 것이 속한 갈래다.
 */
function 속한폴더(f: File): string[] {
  const 길 = (f as any).webkitRelativePath as string | undefined;
  if (!길 || !길.includes("/")) return [];
  return 길.split("/").slice(0, -1).filter(Boolean);
}

/**
 * 끌어다 놓은 것에서 파일을 모두 꺼낸다.
 *
 * 폴더를 끌어다 놓으면 dataTransfer.files 는 비어 있다.
 * 폴더는 webkitGetAsEntry 로 하나씩 펼쳐야 파일이 나온다.
 */
export async function 놓은것펼치기(dt: DataTransfer): Promise<File[]> {
  const 입구 = Array.from(dt.items ?? [])
    .map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null))
    .filter(Boolean) as any[];
  if (!입구.length) return Array.from(dt.files ?? []);

  const 모은것: File[] = [];
  const 파일로 = (e: any) => new Promise<File | null>((res) => e.file(res, () => res(null)));
  const 줄줄이 = (r: any) => new Promise<any[]>((res) => r.readEntries(res, () => res([])));

  const 훑기 = async (e: any, 앞길: string) => {
    if (e.isFile) {
      const f = await 파일로(e);
      if (f) {
        // 폴더째 고른 것과 같은 길을 붙여 준다 (갈래를 꼬리표로 쓰기 위함)
        try { Object.defineProperty(f, "webkitRelativePath", { value: `${앞길}${e.name}` }); } catch { /* 못 붙여도 담는다 */ }
        모은것.push(f);
      }
      return;
    }
    if (e.isDirectory) {
      const r = e.createReader();
      for (;;) {
        const 묶음 = await 줄줄이(r);
        if (!묶음.length) break;
        for (const x of 묶음) await 훑기(x, `${앞길}${e.name}/`);
      }
    }
  };

  for (const e of 입구) await 훑기(e, "");
  return 모은것;
}

/**
 * 사람이 읽는 규격.
 *
 * 현수막은 "400×90cm" 가 곧 주문 규격이다. 포인트 숫자를 보여 줘 봐야 못 쓴다.
 * 그림 파일은 인쇄 치수를 알 수 없으므로 픽셀로 적는다.
 */
function 규격(x: LibItem): string {
  if (x.mmW && x.mmH) {
    const cm = (mm: number) => {
      const v = mm / 10;
      return Number.isInteger(v) ? String(v) : v.toFixed(1);
    };
    return `${cm(x.mmW)} × ${cm(x.mmH)} cm`;
  }
  return x.w && x.h ? `${x.w} × ${x.h} px` : "";
}

/** 파일 하나를 내려받게 떨군다 */
function 떨구기(blob: Blob, 이름: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = 이름;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * 한 장 화면의 큰 그림.
 *
 * 목록에 깔린 작은 그림(360px)을 늘리면 뭉개진다.
 * 원본을 품고 있으니 열어 볼 때 그 자리에서 크게 다시 그린다.
 */
function 큰보기({ x }: { x: LibItem }) {
  const [src, setSrc] = useState<string | null>(null);
  const [그리는중, set그리는중] = useState(false);

  useEffect(() => {
    let 살아있다 = true;
    setSrc(null);
    (async () => {
      // 작은 그림이라도 먼저 띄워 둔다. 빈 화면보다 낫다.
      const 작은 = await getThumb(x.id);
      if (살아있다 && 작은) setSrc(작은);
      if (!x.hasFile) return;
      set그리는중(true);
      const b = await getFile(x.id);
      const 큰 = b ? await 큰그림(b, x.fileName) : undefined;
      if (살아있다 && 큰) setSrc(큰);
      if (살아있다) set그리는중(false);
    })();
    return () => { 살아있다 = false; };
  }, [x.id, x.hasFile, x.fileName]);

  if (x.noThumb && !src) return <span className="nothumb">{x.noThumb}</span>;
  if (!src) return <span className="nothumb">그리는 중…</span>;
  return (
    <span className="큰그림칸">
      <img src={src} alt="" className="big" />
      {그리는중 && <small className="또렷하게">또렷하게 그리는 중…</small>}
    </span>
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
