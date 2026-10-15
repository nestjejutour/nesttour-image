import type { Content, Slot } from "../core/types";
import { uid } from "../store/db";
import { readShrunk } from "../core/image";

/**
 * 오른쪽 입력폼.
 * 페이지 타입의 slots(데이터)를 보고 스스로 만들어진다.
 * 그래서 새 페이지 타입이 추가돼도 이 파일은 고칠 필요가 없다.
 */

interface Props {
  slots: Slot[];
  content: Content;
  onChange: (next: Content) => void;
  /** 사진을 넣으면 여기에 등록한다 */
  onAsset: (key: string, dataUrl: string) => void;
  assets: Record<string, string>;
}

export function SlotForm({ slots, content, onChange, onAsset, assets }: Props) {
  const set = (key: string, v: unknown) => onChange({ ...content, [key]: v });

  return (
    <>
      {slots.map((s) => (
        <SlotField
          key={s.key}
          slot={s}
          value={content[s.key]}
          onChange={(v) => set(s.key, v)}
          onAsset={onAsset}
          assets={assets}
        />
      ))}
    </>
  );
}

function SlotField({
  slot,
  value,
  onChange,
  onAsset,
  assets,
}: {
  slot: Slot;
  value: any;
  onChange: (v: unknown) => void;
  onAsset: (key: string, dataUrl: string) => void;
  assets: Record<string, string>;
}) {
  const label = (
    <label>
      {slot.label}
      {slot.required && <span style={{ color: "var(--todo)" }}> *</span>}
      {slot.hint && <span className="hint"> — {slot.hint}</span>}
    </label>
  );

  // ---- 사진 ----
  if (slot.kind === "image") {
    const src = typeof value === "string" ? (assets[value] ?? value) : undefined;
    return (
      <div className="field">
        {label}
        <div className="row">
          {src && (
            <img
              src={src}
              alt=""
              style={{ width: 54, height: 36, objectFit: "cover", borderRadius: 4, border: "1px solid var(--line)" }}
            />
          )}
          <label className="btn sm grow" style={{ textAlign: "center" }}>
            {src ? "사진 변경" : "사진 선택"}
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                const data = await readShrunk(f);   // 저장소가 차지 않게 줄여서 넣는다
                const key = `img-${uid()}`;
                onAsset(key, data);
                onChange(key);
              }}
            />
          </label>
          {src && (
            <button className="btn sm" onClick={() => onChange("")} title="사진 삭제">
              ×
            </button>
          )}
        </div>
      </div>
    );
  }

  // ---- 목록 (카드, 숫자, 항목표 …) ----
  if (slot.kind === "list") {
    const items: Content[] = Array.isArray(value) ? value : [];
    const full = slot.max !== undefined && items.length >= slot.max;

    const update = (i: number, next: Content) =>
      onChange(items.map((it, k) => (k === i ? next : it)));

    return (
      <div className="field">
        {label}
        {items.map((item, i) => (
          <div className="listitem" key={i}>
            <div className="head">
              <b>{i + 1}</b>
              <span className="row">
                <button className="btn sm" disabled={i === 0}
                  onClick={() => {
                    const n = [...items];
                    [n[i - 1], n[i]] = [n[i], n[i - 1]];
                    onChange(n);
                  }}>↑</button>
                <button className="btn sm" disabled={i === items.length - 1}
                  onClick={() => {
                    const n = [...items];
                    [n[i + 1], n[i]] = [n[i], n[i + 1]];
                    onChange(n);
                  }}>↓</button>
                <button className="btn sm"
                  onClick={() => onChange(items.filter((_, k) => k !== i))}>×</button>
              </span>
            </div>
            {(slot.itemSlots ?? []).map((is) => (
              <SlotField
                key={is.key}
                slot={is}
                value={item?.[is.key]}
                onChange={(v) => update(i, { ...item, [is.key]: v })}
                onAsset={onAsset}
                assets={assets}
              />
            ))}
          </div>
        ))}
        <button className="btn sm" disabled={full}
          onClick={() => onChange([...items, {}])}>
          + {slot.label} 추가{full ? ` (최대 ${slot.max})` : ""}
        </button>
      </div>
    );
  }

  // ---- 글자 ----
  return (
    <div className="field">
      {label}
      {slot.kind === "textarea" ? (
        <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
