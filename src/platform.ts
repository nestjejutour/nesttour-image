/**
 * 이 프로그램은 두 곳에서 돈다.
 *   ① 옆 패널(Artifact) — Claude 기능을 쓴다
 *   ② 대표님 PC        — 내 컴퓨터의 작은 서버를 쓴다
 *
 * 어디인지 "미리 판정"하지 않는다.
 * 켜지는 순간에는 Claude 기능이 아직 안 붙어 있을 수 있기 때문이다.
 * 그때그때 있는지 물어보고, 있으면 쓰고 없으면 서버로 간다.
 */

type Use = (name: string) => Promise<unknown>;

function useFn(): Use | null {
  const w = window as unknown as { claude?: { use?: Use } };
  return typeof w.claude?.use === "function" ? w.claude.use.bind(w.claude) : null;
}

/** 지금 이 순간 옆 패널인가 (쓸 때마다 다시 본다) */
export function hasClaude(): boolean {
  return typeof window !== "undefined" && useFn() !== null;
}

/**
 * Claude 기능 하나를 가져온다. 못 쓰면 null.
 * 켜진 직후에는 아직 안 붙어 있을 수 있어 잠깐 기다려 본다.
 */
export async function capability<T>(name: string, waitMs = 3000): Promise<T | null> {
  const started = Date.now();
  while (Date.now() - started < waitMs) {
    const use = useFn();
    if (use) {
      try {
        return ((await use(name)) as T) ?? null;
      } catch {
        return null;
      }
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  return null;
}
