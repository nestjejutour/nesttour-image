/**
 * AI 가 한 말을 읽히게 그린다.
 *
 * 글만 길게 쏟아 놓으면 눈이 어디를 봐야 할지 모른다.
 * 줄의 생김새를 보고 제목·목록·짚어 둘 말을 갈라 세운다.
 * (바깥에서 서식을 따로 받지 않는다 — 받은 글 그대로 보고 판단한다)
 */

/** 굵게(**이렇게**)와 홑따옴표 강조만 살린다 */
function 줄안에(t: string, key: string) {
  const 조각 = t.split(/(\*\*[^*]+\*\*|'[^']+'|"[^"]+")/g).filter(Boolean);
  return 조각.map((x, i) => {
    if (x.startsWith("**") && x.endsWith("**")) return <b key={`${key}-${i}`}>{x.slice(2, -2)}</b>;
    if ((x.startsWith("'") && x.endsWith("'")) || (x.startsWith('"') && x.endsWith('"')))
      return <em key={`${key}-${i}`} className="q">{x.slice(1, -1)}</em>;
    return <span key={`${key}-${i}`}>{x}</span>;
  });
}

/** 머리말로 볼 줄인가 — "안 1. 사진 중심", "참고:", "확인해 주실 것" 같은 것 */
const 머리말 = (t: string) =>
  /^(안\s*\d+|\d+\s*안|참고|확인(해)?\s*주실?\s*것|요약|다음\s*단계)(?![가-힣])\s*[.:：]?/.test(t) &&
  t.length <= 40;

/** 짚어 둘 말인가 — 틀렸다고 밝히거나 주의를 구하는 줄. 길이와 무관하게 띄워 준다 */
const 짚을말 = (t: string) => /^(정정|주의|경고|바로잡습니다)(?![가-힣])\s*[.:：]?/.test(t);

export function Say({ text }: { text: string }) {
  const 줄들 = (text ?? "").split("\n");
  const 덩어리: JSX.Element[] = [];
  let 목록: { 번호: boolean; 글: string[] } | null = null;

  const 목록닫기 = () => {
    if (!목록) return;
    const { 번호, 글 } = 목록;
    const 항목 = 글.map((t, i) => <li key={i}>{줄안에(t, `l${덩어리.length}-${i}`)}</li>);
    덩어리.push(번호
      ? <ol key={`b${덩어리.length}`} className="saylist">{항목}</ol>
      : <ul key={`b${덩어리.length}`} className="saylist">{항목}</ul>);
    목록 = null;
  };

  줄들.forEach((raw, i) => {
    const t = raw.trim();
    if (!t) { 목록닫기(); return; }

    const 점 = t.match(/^[-·•]\s+(.*)$/);
    const 숫 = t.match(/^(\d+)[.)]\s+(.*)$/);

    if (점) {
      if (!목록 || 목록.번호) { 목록닫기(); 목록 = { 번호: false, 글: [] }; }
      목록.글.push(점[1]);
      return;
    }
    if (숫 && !머리말(t)) {
      if (!목록 || !목록.번호) { 목록닫기(); 목록 = { 번호: true, 글: [] }; }
      목록.글.push(숫[2]);
      return;
    }

    목록닫기();
    if (짚을말(t)) {
      덩어리.push(<p key={`n${i}`} className="saynote">{줄안에(t, `n${i}`)}</p>);
      return;
    }
    if (머리말(t)) {
      덩어리.push(<h5 key={`h${i}`} className="sayhead">{t.replace(/[:：]$/, "")}</h5>);
      return;
    }
    덩어리.push(<p key={`p${i}`}>{줄안에(t, `p${i}`)}</p>);
  });
  목록닫기();

  return <div className="say">{덩어리}</div>;
}
