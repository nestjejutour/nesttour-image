/**
 * 빌드한 결과에 아티팩트용 첫 장(artifact.html)을 만들어 붙인다.
 *
 * vite build 는 dist 를 통째로 비우므로, 빌드 뒤에 매번 다시 만들어야 한다.
 * 파일 이름에 붙는 난수가 빌드마다 바뀌어서 손으로 고치면 틀리기 쉽다.
 *   쓰는 법:  npm run build && node 내보내기.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const s = readFileSync("dist/index.html", "utf8");
const js = s.match(/src="\.\/(assets\/[^"]+\.js)"/)[1];
const css = s.match(/href="\.\/(assets\/[^"]+\.css)"/)[1];

writeFileSync("dist/artifact.html", `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MTMB 디자인 스튜디오</title>
    <style>
      /* 글꼴을 앱 안에 품고 있다. 어느 기기에서 열어도 글자가 같다. */
      @font-face {
        font-family: "Pretendard";
        src: url("fonts/Pretendard-Regular.woff2") format("woff2");
        font-weight: 400; font-style: normal; font-display: swap;
      }
      @font-face {
        font-family: "Pretendard";
        src: url("fonts/Pretendard-Bold.woff2") format("woff2");
        font-weight: 700; font-style: normal; font-display: swap;
      }
      html, body { height: 100%; margin: 0; }
      #root { height: 100%; }
    </style>
    <link rel="stylesheet" href="${css}">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${js}"></script>
  </body>
</html>
`);
console.log(js);
console.log(css);
