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
import { firebaseReady, functionsBase, idToken } from "../store/firebase";

/** 우리가 쓰는 커넥터 이름 (claude.ai 설정에 보이는 그대로) */
export const SEARCH_SERVER = "Parallel Search";

/**
 * 이 브라우저에서 한 번만 만드는 대화 번호.
 *
 * 커넥터가 "한 대화에서는 같은 번호를 계속 쓰라" 고 한다.
 * 무료 사용량을 그 번호로 센다. AI 가 매번 새 번호를 지어내면
 * 한 사람이 여러 사람인 것처럼 보여 금방 막힌다.
 */
const 대화번호 =
  `mtmb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

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
      return `claude.ai 설정 → 커넥터에서 "${SEARCH_SERVER}" 를 추가해 주십시오. 무료이고 로그인도 필요 없습니다.`;
    case "다시연결":
      return `claude.ai 설정 → 커넥터에서 "${SEARCH_SERVER}" 를 다시 연결해 주십시오.`;
    case "거절":
      return "검색 사용을 허용하지 않으셨습니다. 다시 켜시려면 한 번 더 눌러 주십시오.";
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
/**
 * 네이버 검색 연장.
 *
 * 바깥 검색은 네이버 블로그·카페·지역을 한 건도 못 찾는다.
 * 네이버가 바깥 크롤러를 막기 때문이다 — 확인한 사실이다.
 * 그래서 네이버가 공식으로 여는 창구를 우리 서버가 대신 두드린다.
 * (열쇠를 브라우저에 둘 수 없으니 서버를 거친다)
 */
function naverTool(): WebTool | null {
  if (!firebaseReady) return null;
  return {
    name: "네이버검색",
    description:
      "네이버 안을 정식 창구로 찾는다. 블로그 · 카페글 · 뉴스 · 웹문서 · 지역(업체) · 쇼핑 · 지식iN. " +
      "특히 바깥 검색으로 못 가는 곳에 쓴다 — 카페글, 지역 업체(주소·전화), 쇼핑 가격, 지식iN. " +
      "최신순으로 훑고 싶을 때(sort=date)도 이쪽이 낫다. " +
      "kinds 를 비워 두면 블로그 · 카페 · 뉴스 · 웹문서를 한꺼번에 찾는다.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "찾을 말. 한국어로." },
        kinds: {
          type: "array",
          description: "찾을 곳. 비우면 널리 찾는다.",
          items: { type: "string", enum: ["blog", "cafearticle", "news", "webkr", "local", "shop", "kin", "doc"] },
        },
        display: { type: "number", description: "한 곳당 몇 건까지 (기본 8, 최대 20)" },
        sort: { type: "string", description: "sim=정확도순(기본), date=최신순" },
      },
      required: ["query"],
    },
    execute: (input, ctx) => callOurServer("naver", input, ctx.signal),
  };
}

/**
 * 구글 검색 연장.
 *
 * 색인이 가장 넓다. 바깥 검색이 놓친 것을 한 번 더 훑을 때,
 * 한 사이트 안에서만 찾을 때(나라장터·발주처 홈페이지), 기간을 좁힐 때 쓴다.
 * 하루 100건까지 무료라 기본 연장으로 두지 않고 "더 넓게" 쪽으로 둔다.
 */
function googleTool(): WebTool | null {
  if (!firebaseReady) return null;
  return {
    name: "구글검색",
    description:
      "구글로 찾는다. 색인이 가장 넓다. 다른 검색으로 못 찾았을 때 한 번 더 훑거나, " +
      "한 사이트 안에서만 찾을 때(site 에 주소를 넣는다), 최근 것만 볼 때(기간) 쓴다. " +
      "하루 쓸 수 있는 횟수가 적으니 꼭 필요할 때만 쓰고, 한 번에 제대로 된 검색어를 넣어라.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "검색어" },
        site: { type: "string", description: "이 사이트 안에서만. 예: incheon.go.kr" },
        기간: { type: "string", description: "최근 것만. d7=일주일, m3=석달, y1=일년" },
        한국어만: { type: "boolean", description: "한국어 문서만 볼 때" },
        num: { type: "number", description: "몇 건까지 (최대 10)" },
      },
      required: ["query"],
    },
    execute: (input, ctx) => callOurServer("google", input, ctx.signal),
  };
}

/** 우리 서버의 검색 창구를 두드린다 (열쇠는 서버에만 있다) */
async function callOurServer(길: string, input: unknown, signal: AbortSignal) {
  const token = await idToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  const r = await fetch(`${functionsBase}/${길}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
    signal,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.error) throw new Error(data.error ?? `검색 실패 (${r.status})`);
  return data;
}

export async function readyWeb(): Promise<WebState> {
  const naver = naverTool();
  const google = googleTool();
  const 우리것 = [naver, google].filter(Boolean) as WebTool[];

  const mcp = await capability<Mcp>("mcp");
  // 바깥 검색이 없어도 네이버만으로 열어 준다
  if (!mcp) return 우리것.length ? { on: true, tools: 우리것 } : { on: false, why: "없음" };

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
    const bad = fromError(e);
    return 우리것.length ? { on: true, tools: 우리것 } : bad;
  }
  if (!found || !found.tools?.length) {
    return 우리것.length ? { on: true, tools: 우리것 } : { on: false, why: "안붙임" };
  }
  if (found.authStatus === "needs_reauth") {
    return 우리것.length ? { on: true, tools: 우리것 } : { on: false, why: "다시연결" };
  }

  const 한글이름: Record<string, string> = {
    web_search: "인터넷검색",
    web_fetch: "웹페이지읽기",
  };
  const 설명: Record<string, string> = {
    web_search:
      "인터넷을 찾아본다. 지금의 사실(시세·최근 소식·경쟁사 현황·통계·공고)이 필요할 때 쓴다. " +
      "objective 에 무엇을 찾는지 한 문장, search_queries 에 3~6 단어짜리 검색어를 2~3개 넣어라. " +
      "관공서·공공기관 자료가 잘 잡힌다. " +
      "검색어에 site:주소 를 붙이면 그 사이트 안만 뒤진다. 이게 제일 쓸모 있다 — " +
      "site:g2b.go.kr (나라장터 입찰 공고, 제안요청서 본문까지 잡힌다), " +
      "site:blog.naver.com (국내 후기·가격·현장 이야기가 본문째로 잡힌다), " +
      "발주처 홈페이지 주소를 넣으면 그 기관 공고·보도자료만 볼 수 있다. " +
      "다만 네이버 카페는 로그인 벽이라 이 길로는 안 잡힌다. " +
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
        // 번호는 우리가 붙인다. AI 가 지어내게 두지 않는다.
        const 보낼것 = { ...input, session_id: 대화번호, model_name: "claude-opus-5-5" };
        const r = await mcp.callTool(SEARCH_SERVER, t.name, 보낼것, { signal: ctx.signal });
        return r.payload ?? r.content ?? "";
      },
    });
  }

  tools.push(...우리것);
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
