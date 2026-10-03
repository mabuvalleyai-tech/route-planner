// 中文檢索用的斷詞：中日韓字元切成字元 bigram（單字也保留），英數字整段當一個 token。
// 地名多是 2–5 字的專有名詞，bigram 對錯字、簡稱（「排雲」對「排雲山莊」）都夠用，又不用分詞字典。
const CJK = /[㐀-鿿豈-﫿]/;

export function normalize(s) {
  return String(s || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/臺/g, '台')
    .replace(/[峯]/g, '峰');
}

export function tokenize(s) {
  const text = normalize(s);
  const out = [];
  let run = '';
  let word = '';
  const flushRun = () => {
    if (run.length === 1) out.push(run);
    for (let i = 0; i + 1 < run.length; i++) out.push(run.slice(i, i + 2));
    run = '';
  };
  const flushWord = () => {
    if (word) out.push(word);
    word = '';
  };
  for (const ch of text) {
    if (CJK.test(ch)) {
      flushWord();
      run += ch;
    } else if (/[a-z0-9.]/.test(ch)) {
      flushRun();
      word += ch;
    } else {
      flushRun();
      flushWord();
    }
  }
  flushRun();
  flushWord();
  return out;
}

export function htmlToText(html) {
  return String(html)
    .replace(/<(script|style|nav|header|footer)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|h[1-6]|li|tr|div|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}
