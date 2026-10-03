import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler, { setClient } from '../api/plan.js';

function fakeClient(output, capture = {}) {
  return {
    beta: {
      messages: {
        create: async (params) => {
          capture.params = params;
          return { model: params.model, stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(output) }] };
        },
      },
    },
  };
}

function call(body) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 0,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(c) { this.statusCode = c; return this; },
      json(d) { resolve({ status: this.statusCode, body: d }); return this; },
    };
    handler({ method: 'POST', headers: { 'x-forwarded-for': `t${Math.random()}` }, body }, res);
  });
}

test('自然語言 → 檢索上下文 → 驗證後的規劃', async () => {
  const cap = {};
  setClient(fakeClient({
    intent: 'plan', start: 'n258', vias: ['n264', 'n278', 'n258'], mode: 'time', days: 2,
    overnight: ['n264'], candidates: [], answer: '塔塔加上排雲住一晚，隔天攻頂 [1]', citations: [1],
  }, cap));
  const r = await call({ text: '從塔塔加上玉山主峰，住排雲兩天一夜' });
  assert.equal(r.status, 200);
  assert.equal(r.body.plan.intent, 'plan');
  assert.deepEqual(r.body.plan.vias, ['n264', 'n278', 'n258']);
  assert.equal(r.body.sources.length, 1);
  // 檢索結果有送進模型，結構化輸出有設定
  const msg = cap.params.messages[0].content;
  assert.match(msg, /n264｜排雲山莊/);
  assert.match(msg, /玉山主峰 兩天一夜/);
  assert.equal(cap.params.output_config.format.type, 'json_schema');
  assert.equal(cap.params.tool_choice, undefined);
});

test('空白與過長輸入回 400，GET 回 405', async () => {
  assert.equal((await call({ text: '  ' })).status, 400);
  assert.equal((await call({ text: '山'.repeat(501) })).status, 400);
  const r = await new Promise((resolve) => {
    handler({ method: 'GET', headers: {} }, {
      setHeader() {}, status(c) { this.c = c; return this; }, json() { resolve(this.c); },
    });
  });
  assert.equal(r, 405);
});

test('未設定 CLAUDE_MODEL 時預設用 claude-sonnet-5-5', async () => {
  if (process.env.CLAUDE_MODEL) return;
  const cap = {};
  setClient(fakeClient({ intent: 'question', start: '', vias: [], mode: 'time', days: 1, overnight: [], candidates: [], answer: 'ok', citations: [] }, cap));
  await call({ text: '高山症怎麼辦' });
  assert.equal(cap.params.model, 'claude-sonnet-5-5');
});
