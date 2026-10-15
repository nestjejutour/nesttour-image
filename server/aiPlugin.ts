import type { Plugin } from "vite";
import { loadEnv } from "vite";
import Anthropic from "@anthropic-ai/sdk";

/**
 * AI 창구 (내 PC 안에서만 도는 작은 서버)
 *
 * 열쇠(API 키)는 여기 서버 쪽에만 있다. 브라우저로 절대 나가지 않는다.
 * 나중에 Netlify 로 올릴 때는 이 파일 내용을 Netlify Function 으로 옮기면 된다.
 */

const MODEL = "claude-opus-5-5";

export function aiPlugin(): Plugin {
  return {
    name: "mtmb-ai",
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), "");
      const apiKey = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;

      server.middlewares.use("/api/ai", async (req, res) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8");

        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "POST 만 받습니다" }));
          return;
        }
        if (!apiKey) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              error:
                "AI 열쇠가 없습니다. 프로젝트 폴더에 .env.local 파일을 만들고 " +
                "ANTHROPIC_API_KEY=여기에키 한 줄을 적은 뒤 서버를 다시 켜 주세요.",
            }),
          );
          return;
        }

        try {
          const body = await readJson(req);
          const { system, messages, imagesBase64 } = body as {
            system: string;
            messages: { role: "user" | "assistant"; content: string }[];
            imagesBase64?: string[];
          };

          // 마지막 사용자 말에 지금 보고 있는 페이지 그림을 붙인다.
          // 그래야 AI 가 "화면을 보고" 판단한다.
          const built: Anthropic.MessageParam[] = messages.map((m, i) => {
            const last = i === messages.length - 1;
            if (last && m.role === "user" && imagesBase64?.length) {
              return {
                role: "user" as const,
                content: [
                  ...imagesBase64.map((data) => ({
                    type: "image" as const,
                    source: { type: "base64" as const, media_type: "image/png" as const, data },
                  })),
                  { type: "text" as const, text: m.content },
                ],
              };
            }
            return { role: m.role, content: m.content };
          });

          const client = new Anthropic({ apiKey });
          const r = await client.beta.messages.create({
            model: MODEL,
            max_tokens: 16000,
            system,
            messages: built,
            thinking: { type: "adaptive" },
            // 안전장치가 요청을 거절할 때 서버가 알아서 다른 모델로 넘긴다
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
          });

          if (r.stop_reason === "refusal") {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "AI 가 이 요청을 거절했습니다." }));
            return;
          }

          const text = r.content
            .filter((b): b is Anthropic.TextBlock => b.type === "text")
            .map((b) => b.text)
            .join("");

          res.end(
            JSON.stringify({
              text,
              model: MODEL,
              usage: {
                입력: r.usage.input_tokens,
                출력: r.usage.output_tokens,
              },
            }),
          );
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e?.message ?? "알 수 없는 오류" }));
        }
      });
    },
  };
}

function readJson(req: any): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c: Buffer) => {
      raw += c;
      if (raw.length > 40_000_000) reject(new Error("보낸 내용이 너무 깁니다"));
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        reject(new Error("보낸 내용을 읽을 수 없습니다"));
      }
    });
    req.on("error", reject);
  });
}
