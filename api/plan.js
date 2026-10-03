// POST /api/plan  { text: string, comp?: number }
// → { plan, sources, model }
// 流程：BM25 檢索 → Claude（結構化輸出）→ 伺服器端驗證節點 ID。
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import { retrieveContext } from '../lib/retrieve.js';
import { SYSTEM_PROMPT, PLAN_SCHEMA, buildUserMessage } from '../lib/prompt.js';
import { sanitizePlan } from '../lib/plan.js';

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';
const MAX_TEXT = 500;
const NET = JSON.parse(readFileSync(new URL('../data/trail-network.json', import.meta.url), 'utf8'));

// 簡易速率限制：同一個 IP 每分鐘 10 次。serverless 實例各自計數，只是擋掉明顯濫用。
const HITS = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (HITS.get(ip) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  HITS.set(ip, recent);
  return recent.length > 10;
}

let client = null;
export function setClient(c) {
  client = c;
}

export async function planFromText(text, comp) {
  const ctx = retrieveContext(text, { comp: Number.isInteger(comp) ? comp : undefined });
  if (!client && !process.env.ANTHROPIC_API_KEY) {
    const err = new Error('伺服器尚未設定 ANTHROPIC_API_KEY（Vercel 專案 Settings → Environment Variables，Preview 與 Production 都要勾），設定後需重新部署。');
    err.status = 500;
    throw err;
  }
  client ??= new Anthropic();
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: PLAN_SCHEMA } },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: buildUserMessage(text, ctx, NET.comps) }],
  });
  if (response.stop_reason === 'refusal') {
    const err = new Error('模型拒絕了這個請求');
    err.status = 422;
    throw err;
  }
  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('模型沒有回傳內容');
  const raw = JSON.parse(textBlock.text);
  const allowed = new Set(ctx.nodes.map((h) => h.chunk.nodeId));
  const plan = sanitizePlan(raw, NET.nodes, allowed);
  const sources = ctx.docs.map(({ chunk }, i) => ({
    n: i + 1,
    title: chunk.title,
    type: chunk.type,
    url: chunk.url || null,
  }));
  // 候選節點附上名稱與區域，前端不用再查一次
  const describe = (id) => ({ id, name: NET.nodes[id].name, comp: NET.nodes[id].comp, area: NET.comps[NET.nodes[id].comp].name });
  return {
    plan,
    candidates: plan.candidates.map(describe),
    sources: sources.filter((s) => plan.citations.includes(s.n)),
    model: response.model,
  };
}

export default async function handler(req, res) {
  // 健康檢查：瀏覽器直接打開 /api/plan 就能確認函式有部署、金鑰有沒有設定（不回傳金鑰本身）
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, model: MODEL, keyConfigured: Boolean(process.env.ANTHROPIC_API_KEY) });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: '只接受 POST' });
  }
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  if (rateLimited(ip)) return res.status(429).json({ error: '請求太頻繁，請稍後再試。' });

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body || {};
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return res.status(400).json({ error: '請輸入想規劃的路線或問題。' });
  if (text.length > MAX_TEXT) return res.status(400).json({ error: `內容請在 ${MAX_TEXT} 字以內。` });

  try {
    return res.status(200).json(await planFromText(text, body.comp));
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return res.status(503).json({ error: 'AI 服務忙碌中，請稍後再試。' });
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('ANTHROPIC_API_KEY 無效或未設定');
      return res.status(500).json({ error: '伺服器尚未設定 AI 金鑰。' });
    }
    if (err instanceof Anthropic.APIError) {
      console.error('Claude API error', err.status, err.message);
      return res.status(502).json({ error: 'AI 服務暫時無法使用。' });
    }
    console.error(err);
    return res.status(err.status || 500).json({ error: err.status ? err.message : '處理時發生錯誤。' });
  }
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
