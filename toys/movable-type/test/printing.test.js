import test from 'node:test';
import assert from 'node:assert/strict';
import { averageQuality, editionOutcome, impressionQuality, inkPass, layoutBlocks, normalizePhrase, seeded } from '../printing.js';

test('短句去空白并限制为八个 Unicode 字符', () => {
  assert.equal(normalizePhrase(' 春 风 得 意 '), '春风得意');
  assert.equal(Array.from(normalizePhrase('一二三四五六七八九')).length, 8);
});

test('活字按印刷方向反排', () => {
  const blocks = layoutBlocks('春风得意', { x: 0, y: 0, width: 500, height: 100 });
  assert.deepEqual(blocks.map((block) => block.char), ['意', '得', '风', '春']);
  assert.ok(blocks.every((block, index) => index === 0 || block.x > blocks[index - 1].x));
});

test('滚筒只给经过的活字上墨', () => {
  const blocks = layoutBlocks('天地', { x: 100, y: 0, width: 400, height: 100 });
  const inked = inkPass(blocks, blocks[0].x, blocks[0].x + 20, 50, 1);
  assert.ok(inked[0].coverage > 0);
  assert.equal(inked[1].coverage, 0);
});

test('墨量和压力共同决定印痕', () => {
  assert.equal(impressionQuality(1, 0), 0);
  assert.ok(impressionQuality(1, 0.9) > impressionQuality(0.3, 0.9));
  assert.ok(averageQuality([{ coverage: 1 }, { coverage: 0 }], 0.9) < 0.6);
});

test('相同种子产生相同纸面缺口', () => {
  const a = seeded(42);
  const b = seeded(42);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test('试印判词可复现，并优先反映墨量问题', () => {
  assert.deepEqual(editionOutcome(0.8, false, 42), editionOutcome(0.8, false, 42));
  assert.equal(editionOutcome(0.8, true, 42).stamp, '墨多胆大');
  assert.equal(editionOutcome(0.1, false, 42).effect, 'missing');
});
