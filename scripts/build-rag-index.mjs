// 建立 RAG 檢索索引 data/rag/index.json。
// 三類資料：路網節點／區域（data/trail-network.json + knowledge/aliases.json）、
// 登山知識文章（posts/*.html）、行程範本（knowledge/itineraries/*.md）。
// 每個 chunk 預先算好詞頻，api 端只做 BM25 打分。
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { tokenize, htmlToText } from '../lib/text.js';

const net = JSON.parse(readFileSync('data/trail-network.json', 'utf8'));
const aliases = JSON.parse(readFileSync('knowledge/aliases.json', 'utf8'));
const chunks = [];

// ---------- 節點 ----------
const nameToIds = {};
for (const [id, n] of Object.entries(net.nodes)) (nameToIds[n.name] ??= []).push(id);
for (const name of Object.keys(aliases)) {
  if (!nameToIds[name]) throw new Error(`aliases.json 的「${name}」不在路網節點裡`);
}
const neighbors = {};
for (const e of net.edges) {
  (neighbors[e.start] ??= new Set()).add(e.finish);
  (neighbors[e.finish] ??= new Set()).add(e.start);
}
for (const [id, n] of Object.entries(net.nodes)) {
  const al = aliases[n.name] || [];
  const near = [...(neighbors[id] || [])].map((x) => net.nodes[x].name);
  const area = net.comps[n.comp].name;
  chunks.push({
    id: `node:${id}`,
    type: 'node',
    nodeId: id,
    comp: n.comp,
    title: n.name,
    text: `${n.name}${al.length ? `（又稱：${al.join('、')}）` : ''}｜海拔 ${Math.round(n.elev)} m｜區域：${area}（c${n.comp}）｜相鄰：${near.join('、')}`,
    // 名稱與別名重複一次加權，讓地名查詢優先命中節點本身而不是鄰點
    boost: `${n.name} ${n.name} ${al.join(' ')} ${al.join(' ')}`,
  });
}

// ---------- 區域 ----------
net.comps.forEach((c, i) => {
  const names = Object.values(net.nodes)
    .filter((n) => n.comp === i && /山屋|山莊|登山口|峰|山$|湖|池/.test(n.name) && !/公尺峰/.test(n.name))
    .map((n) => n.name);
  chunks.push({
    id: `comp:${i}`,
    type: 'comp',
    comp: i,
    title: `區域：${c.name}`,
    text: `路網區域 c${i}「${c.name}」，${c.nodes} 個節點、${c.edges} 段路。主要地點：${names.slice(0, 80).join('、')}`,
  });
});

// ---------- 文章 ----------
for (const f of readdirSync('posts').filter((f) => f.endsWith('.html')).sort()) {
  const html = readFileSync(`posts/${f}`, 'utf8');
  const title = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1]?.replace(/<[^>]+>/g, '').trim() || f;
  const body = html.match(/<article[\s\S]*?<\/article>/)?.[0] || html;
  // 依 h2 切段，太長再依約 400 字切
  const sections = body.split(/(?=<h2)/i);
  let k = 0;
  for (const sec of sections) {
    const text = htmlToText(sec);
    if (text.length < 20) continue;
    for (let i = 0; i < text.length; i += 400) {
      chunks.push({
        id: `post:${f}#${k++}`,
        type: 'article',
        url: `posts/${f}`,
        title,
        text: text.slice(i, i + 450),
      });
    }
  }
}

// ---------- 行程範本 ----------
function frontMatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error('缺少 front matter');
  const meta = {};
  for (const line of m[1].split('\n')) {
    const [, k, v] = line.match(/^(\w+):\s*(.*)$/) || [];
    if (!k) continue;
    meta[k] = /^\[.*\]$/.test(v) ? v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean) : v.trim();
  }
  return { meta, body: m[2].trim() };
}
const resolve = (name, file) => {
  const ids = nameToIds[name];
  if (!ids) throw new Error(`${file}：找不到節點「${name}」`);
  return ids[0];
};
for (const f of readdirSync('knowledge/itineraries').filter((f) => f.endsWith('.md')).sort()) {
  const { meta, body } = frontMatter(readFileSync(`knowledge/itineraries/${f}`, 'utf8'));
  const stops = meta.stops.map((n) => resolve(n, f));
  const overnight = (meta.overnight || []).map((n) => resolve(n, f));
  const comps = new Set(stops.map((id) => net.nodes[id].comp));
  if (comps.size !== 1) throw new Error(`${f}：行程跨了不同區域`);
  chunks.push({
    id: `itin:${f}`,
    type: 'itinerary',
    title: meta.title,
    comp: [...comps][0],
    days: Number(meta.days),
    stops,
    overnight,
    text: `${meta.title}。路線：${meta.stops.join(' → ')}。過夜：${(meta.overnight || []).join('、') || '無（單日）'}。\n${body}`,
  });
}

// ---------- BM25 統計 ----------
const df = {};
let total = 0;
for (const c of chunks) {
  const toks = tokenize(`${c.title} ${c.text} ${c.boost || ''}`);
  const tf = {};
  for (const t of toks) tf[t] = (tf[t] || 0) + 1;
  c.tf = tf;
  c.len = toks.length;
  total += toks.length;
  for (const t of Object.keys(tf)) df[t] = (df[t] || 0) + 1;
  delete c.boost;
}

mkdirSync('data/rag', { recursive: true });
writeFileSync('data/rag/index.json', JSON.stringify({ version: 1, N: chunks.length, avgdl: total / chunks.length, df, chunks }));
const count = (t) => chunks.filter((c) => c.type === t).length;
console.log(`chunks=${chunks.length} node=${count('node')} comp=${count('comp')} article=${count('article')} itinerary=${count('itinerary')}`);
