/**
 * 인터넷 검색
 *
 * 앱 자체는 바깥 인터넷에 나가지 못한다(막혀 있다).
 * 대신 claude.ai 에 붙여 둔 "커넥터" 를 대표님 자격으로 빌려 쓴다.
 * 열쇠는 claude.ai 가 들고 있고, 우리 쪽 코드는 토큰을 구경도 못 한다.
 *
 * 쓰는 곳은 하나다 — AI 에게 "검색이라는 연장" 을 쥐여 준다.
 * 그러면 AI 가 필요하다고 판단할 때 알아서 찾아보고 답한다.
 * 지금 Claude 와 대화할 때와 같은 방식이다.
 */

import { capability } from "../platform";

/** 우리가 쓰는 커넥터 이름 (claude.ai 설정에 보이는 그대로) */
export const SEARCH_SERVER = "Parallel Search";

export interface WebTool {
  name: string;
  description: string;
  inputSchema?: unknown;
  execute: (input: Record<string, unknown>, ctx: { signal: AbortSignal }) => Promise<unknown>;
}

export type WebState =
  | { on: false; why: "없음" | "안붙임" | "다시연결" | "거절" | "오류"; message?: string }
  | { on: true; tools: WebTool[] };

type Mcp = {
  listTools: (server?: string) => Promise<{ servers?: { server: string; authStatus: string; tools: { name: string; description: string }[] }[] }>;
  describeTool: (server: string, tool: string) => Promise<{ inputSchema?: unknown; description?: string }>;
  callTool: (server: string, tool: string, input?: unknown, opts?: { signal?: AbortSignal }) => Promise<{ payload?: unknown; content?: unknown }>;
};

type Perms = {
  request: (names: string[]) => Promise<Record<string, string> | void>;
};

/** 사람이 읽을 안내 — 왜 안 되는지 한 줄로 */
export function whyNot(s: Extract<WebState, { on: false }>): string {
  switch (s.why) {
    case "없음":
      return "이 화면에서는 인터넷 검색을 쓸 수 없습니다.";
    case "안붙임":
      return `claude.ai 설정 → 커넥터에서 "${SEARCH_SERVER}" 를 추가해 주세요. 무료이고 로그인도 필요 없습니다.`;
    case "다시연결":
      return `claude.ai 설정 → 커넥터에서 "${SEARCH_SERVER}" 를 다시 연결해 주세요.`;
    case "거절":
      return "검색 사용을 허용하지 않으셨습니다. 다시 켜시려면 한 번 더 눌러 주세요.";
    default:
      return s.message ?? "검색을 준비하지 못했습니다.";
  }
}

/**
 * 검색 연장을 챙긴다.
 *
 * 커넥터가 스스로 알려 주는 "입력 모양"을 그대로 받아 AI 에게 넘긴다.
 * 우리가 짐작해서 지어내지 않는다 — 짐작하면 호출이 틀어진다.
 */
export async function readyWeb(): Promise<WebState> {
  const mcp = await capability<Mcp>("mcp");
  if (!mcp) return { on: false, why: "없음" };

  // 처음 켤 때 한 번 허락을 받는다. 받아야 입력 모양을 물어볼 수 있다.
  try {
    const perms = await capability<Perms>("permissions");
    await perms?.request([`mcp:${SEARCH_SERVER}`]);
  } catch { /* 못 물어봐도 아래에서 다시 걸린다 */ }

  let found;
  try {
    const list = await mcp.listTools(SEARCH_SERVER);
    found = list.servers?.find((s) => s.server === SEARCH_SERVER);
  } catch (e: any) {
    return fromError(e);
  }
  if (!found || !found.tools?.length) return { on: false, why: "안붙임" };
  if (found.authStatus === "needs_reauth") return { on: false, why: "다시연결" };

  const 한글이름: Record<string, string> = {
    web_search: "인터넷검색",
    web_fetch: "웹페이지읽기",
  };
  const 설명: Record<string, string> = {
    web_search:
      "인터넷을 찾아본다. 지금의 사실(시세·최근 소식·경쟁사 현황·통계)이 필요할 때 쓴다. " +
      "찾은 내용을 그대로 옮기지 말고, 출처와 날짜를 함께 밝혀라.",
    web_fetch:
      "주소를 주면 그 웹페이지의 내용을 읽어 온다. 특정 공고나 상품 페이지를 확인할 때 쓴다.",
  };

  const tools: WebTool[] = [];
  for (const t of found.tools) {
    if (!(t.name in 한글이름)) continue;
    let inputSchema: unknown;
    try {
      inputSchema = (await mcp.describeTool(SEARCH_SERVER, t.name)).inputSchema;
    } catch {
      continue; // 입력 모양을 모르면 지어내지 말고 그냥 뺀다
    }
    if (!inputSchema) continue;
    tools.push({
      name: 한글이름[t.name],
      description: 설명[t.name] ?? t.description,
      inputSchema,
      execute: async (input, ctx) => {
        const r = await mcp.callTool(SEARCH_SERVER, t.name, input, { signal: ctx.signal });
        return r.payload ?? r.content ?? "";
      },
    });
  }

  if (!tools.length) return { on: false, why: "오류", message: "검색 연장을 준비하지 못했습니다." };
  return { on: true, tools };
}

function fromError(e: any): Extract<WebState, { on: false }> {
  const code = e?.code;
  if (code === "server_not_connected" || code === "not_in_manifest") return { on: false, why: "안붙임" };
  if (code === "needs_reauth") return { on: false, why: "다시연결" };
  if (code === "not_granted" || code === "consent_required") return { on: false, why: "거절" };
  if (code === "capability_disabled" || code === "capability_removed") return { on: false, why: "없음" };
  return { on: false, why: "오류", message: e?.message };
}
