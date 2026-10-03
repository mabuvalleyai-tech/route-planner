import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sanitizePlan } from '../lib/plan.js';

const { nodes } = JSON.parse(readFileSync('data/trail-network.json', 'utf8'));
const base = { intent: 'plan', mode: 'time', days: 1, overnight: [], candidates: [], answer: '', citations: [] };

test('合法規劃原樣通過，並帶出區域', () => {
  const p = sanitizePlan({ ...base, start: 'n258', vias: ['n264', 'n278'], days: 2, overnight: ['n264'] }, nodes);
  assert.equal(p.intent, 'plan');
  assert.deepEqual(p.vias, ['n264', 'n278']);
  assert.deepEqual(p.overnight, ['n264']);
  assert.equal(p.comp, 0);
});

test('不存在的 ID 被剔除，沒有通過點就降級為 clarify', () => {
  const p = sanitizePlan({ ...base, start: 'n258', vias: ['n99999'] }, nodes);
  assert.equal(p.intent, 'clarify');
  assert.deepEqual(p.vias, []);
});

test('跨區域降級為 clarify，並把點放進候選', () => {
  const p = sanitizePlan({ ...base, start: 'n258', vias: ['n583'] }, nodes); // 玉山區 → 雪山主峰
  assert.equal(p.intent, 'clarify');
  assert.ok(p.candidates.includes('n583'));
  assert.match(p.answer, /不同區域/);
});

test('不在這次候選清單的 ID 不採用', () => {
  const p = sanitizePlan({ ...base, start: 'n258', vias: ['n264'] }, nodes, new Set(['n258']));
  assert.equal(p.intent, 'clarify');
});

test('重複通過點去重；回到起點允許', () => {
  const p = sanitizePlan({ ...base, start: 'n258', vias: ['n264', 'n278', 'n264', 'n258'] }, nodes);
  assert.deepEqual(p.vias, ['n264', 'n278', 'n258']);
});

test('question 不帶路線', () => {
  const p = sanitizePlan({ ...base, intent: 'question', start: 'n258', vias: ['n264'] }, nodes);
  assert.equal(p.start, '');
  assert.deepEqual(p.vias, []);
});
