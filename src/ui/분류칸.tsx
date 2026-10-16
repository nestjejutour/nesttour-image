import type { Category } from "../core/types";

/**
 * 분류를 고르는 칸의 줄들.
 *
 * optgroup 을 쓰면 브라우저가 그 속만 한 칸 더 들여 쓴다.
 * 그래서 묶음에 든 "입찰제안서" 와 묶음이 없는 "회사소개서" 의
 * 왼쪽 선이 어긋난다. 또 묶음 이름과 그 안의 "바로 여기" 가 겹쳐 적힌다.
 *
 * 묶지 않고 한 줄씩 늘어놓되, 세부 분류만 손수 들여 쓴다.
 * 모든 줄이 고를 수 있고, 왼쪽 선이 한 줄로 선다.
 */
export function 분류줄들(categories: Category[]) {
  const 들임 = "   ";
  const 줄: { id: string; 글: string }[] = [];
  const 보이는것 = categories.filter((c) => !c.hidden);
  for (const 큰 of 보이는것.filter((c) => !c.parentId).sort((a, b) => a.order - b.order)) {
    줄.push({ id: 큰.id, 글: 큰.name.trim() || "(이름 없음)" });
    for (const 세부 of 보이는것.filter((c) => c.parentId === 큰.id).sort((a, b) => a.order - b.order)) {
      줄.push({ id: 세부.id, 글: 들임 + (세부.name.trim() || "(이름 없음)") });
    }
  }
  return 줄;
}

/** 그대로 꽂아 쓰는 줄들 */
export function 분류옵션({ categories }: { categories: Category[] }) {
  return (
    <>
      {분류줄들(categories).map((x) => (
        <option key={x.id} value={x.id}>{x.글}</option>
      ))}
    </>
  );
}
