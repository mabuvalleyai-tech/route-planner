// BM25 檢索。索引由 scripts/build-rag-index.mjs 產生。
// 要改成向量檢索（例如 Voyage 嵌入）時，只需換掉這個檔案，search() 介面維持不變。
import { readFileSync } from 'node:fs';
import { tokenize } from './text.js';

const K1 = 1.2;
const B = 0.75;
let INDEX = null;

export function loadIndex(path = new URL('../data/rag/index.json', import.meta.url)) {
  if (!INDEX) INDEX = JSON.parse(readFileSync(path, 'utf8'));
  return INDEX;
}

export function setIndex(index) {
  INDEX = index;
}

function score(index, qtf, c) {
  let s = 0;
  for (const [t, qn] of Object.entries(qtf)) {
    const f = c.tf[t];
    if (!f) continue;
    const df = index.df[t] || 0;
    const idf = Math.log(1 + (index.N - df + 0.5) / (df + 0.5));
    s += qn * idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * c.len) / index.avgdl)));
  }
  return s;
}

// types：要檢索的類型；comp：若指定，同區域的結果稍微加分（使用者正在看的區域）
export function search(query, { k = 10, types, comp } = {}) {
  const index = loadIndex();
  const qtf = {};
  for (const t of tokenize(query)) qtf[t] = (qtf[t] || 0) + 1;
  const hits = [];
  for (const c of index.chunks) {
    if (types && !types.includes(c.type)) continue;
    let s = score(index, qtf, c);
    if (s <= 0) continue;
    if (comp != null && c.comp === comp) s *= 1.15;
    hits.push({ score: s, chunk: c });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, k);
}

// 給 LLM 的上下文：地名查詢要涵蓋句子裡提到的每個地點，所以節點多取一些；
// 文章與行程取較少但完整的片段。
export function retrieveContext(query, { comp } = {}) {
  const nodes = search(query, { k: 30, types: ['node'], comp });
  const docs = search(query, { k: 6, types: ['itinerary', 'article', 'comp'], comp });
  return { nodes, docs };
}
