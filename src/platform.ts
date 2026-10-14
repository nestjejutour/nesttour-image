/**
 * 이 프로그램은 두 곳에서 돈다.
 *   ① 대표님 PC     — AI는 내 컴퓨터의 작은 서버로, 파일은 바로 저장
 *   ② 옆 패널(Artifact) — AI는 Claude 기능으로, 파일은 내려받기 기능으로
 * 어느 쪽인지 여기서 한 번만 가린다.
 */

type Use = (name: string) => Promise<unknown>;

function useFn(): Use | null {
  const w = window as unknown as { claude?: { use?: Use } };
  return typeof w.claude?.use === "function" ? w.claude.use.bind(w.claude) : null;
}

/** 옆 패널(Artifact)에서 돌고 있는가 */
export const inArtifact = typeof window !== "undefined" && useFn() !== null;

/** Claude 기능 하나를 가져온다. 못 쓰면 null */
export async function capability<T>(name: string): Promise<T | null> {
  const use = useFn();
  if (!use) return null;
  try {
    return ((await use(name)) as T) ?? null;
  } catch {
    return null;
  }
}
