import type { Plugin } from "vite";
import { loadEnv } from "vite";

/**
 * 카피 작업실 창구 (ChatGPT)
 *
 * 내 PC 안에서만 돈다. 열쇠는 여기 서버에만 있고 브라우저로 나가지 않는다.
 * 옆 패널(Artifact)에서는 외부 호출이 막혀 있어 쓸 수 없다.
 */

const DEFAULT_MODEL = "gpt-5";

export function copyPlugin(): Plugin {
  return {
    name: "mtmb-copy",
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), "");
      const apiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      const model = env.OPENAI_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL;

      server.middlewares.use("/api/copy", async (req, res) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8");

        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "POST 만 받습니다" }));
          return;
        }
        if (!apiKey) {
          res.statusCode = 400;
          res.end(JSON.stringify({
            error:
              "ChatGPT 열쇠가 없습니다. 프로젝트 폴더의 .env.local 에 " +
              "OPENAI_API_KEY=여기에키 한 줄을 적고 프로그램을 다시 켜 주세요.",
          }));
          return;
        }

        try {
          const body = (await readJson(req)) as {
            system: string;
            messages: { role: "user" | "assistant"; content: string }[];
          };

          const r = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [{ role: "system", content: body.system }, ...body.messages],
            }),
          });

          const data: any = await r.json();

          if (!r.ok) {
            const m: string = data?.error?.message ?? `ChatGPT 호출 실패 (${r.status})`;
            res.statusCode = 400;
            res.end(JSON.stringify({
              error: /model/i.test(m)
                ? `${m}\n\n모델 이름이 맞지 않는 것 같습니다. .env.local 에 OPENAI_MODEL=쓸모델이름 을 적어 주세요. (지금 쓰는 이름: ${model})`
                : m,
            }));
            return;
          }

          const text: string = data?.choices?.[0]?.message?.content ?? "";
          res.end(JSON.stringify({ text, model }));
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
      if (raw.length > 5_000_000) reject(new Error("보낸 내용이 너무 깁니다"));
    });
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); } catch { reject(new Error("보낸 내용을 읽을 수 없습니다")); }
    });
    req.on("error", reject);
  });
}
