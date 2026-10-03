import { test } from 'node:test';
import assert from 'node:assert/strict';
import { search } from '../lib/retrieve.js';
import { tokenize } from '../lib/text.js';

const top = (q) => search(q, { k: 1, types: ['node'] })[0]?.chunk.title;

test('口語地名與別名命中正確節點', () => {
  assert.equal(top('排雲'), '排雲山莊');
  assert.equal(top('塔塔加'), '塔塔加鞍部');
  assert.equal(top('369山莊'), '三六九山莊');
  assert.equal(top('雪山主峰'), '雪山主峰');
  assert.equal(top('北大武'), '9K北大武山');
  assert.equal(top('天使的眼淚'), '嘉明湖');
});

test('整句行程優先命中行程範本', () => {
  const hit = search('從塔塔加上玉山主峰住排雲兩天一夜', { k: 1, types: ['itinerary'] })[0];
  assert.match(hit.chunk.title, /玉山主峰 兩天一夜/);
});

test('知識問題命中文章', () => {
  assert.equal(search('高山症怎麼辦', { k: 1 })[0].chunk.type, 'article');
});

test('斷詞：臺／台視為相同、保留英數字', () => {
  assert.deepEqual(tokenize('臺灣'), tokenize('台灣'));
  assert.ok(tokenize('9K北大武').includes('9k'));
});
