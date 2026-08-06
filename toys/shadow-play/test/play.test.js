import test from 'node:test';
import assert from 'node:assert/strict';
import { canFocusEye, createPlay, startRound } from '../src/play.js';
import { stagePoseAt } from '../src/choreography.js';
import { createPuppet, stepPhysics } from '../src/puppet.js';

test('火眼金睛只在命签攥稳时聚起', () => {
  assert.equal(canFocusEye(null, 0), false);
  assert.equal(canFocusEye('nearRod', 0), false);
  assert.equal(canFocusEye('life', 0), true);
  assert.equal(canFocusEye('life', 40), false);
});

test('同一回所有人披着同一张皮相', () => {
  const play = createPlay();
  play.round = 1;
  startRound(play);
  assert.deepEqual([...new Set(play.walkers.map((walker) => walker.form))], ['elder']);
});

test('猴王上场后探身并举棒，最后回到交签姿态', () => {
  assert.ok(stagePoseAt(0).x < 0);
  assert.ok(stagePoseAt(11).torso > -90);
  assert.ok(stagePoseAt(16).nearForeArm < 0);
  assert.equal(stagePoseAt(16).staff, -90);
  assert.equal(stagePoseAt(30).nearForeArm, 98);
});

test('猛牵命签也不会把腿甩成反关节', () => {
  const puppet = createPuppet();
  puppet.root[0] += 1000;
  stepPhysics(puppet, 1 / 60, false);
  for (const name of ['farThigh', 'farShin', 'nearThigh', 'nearShin']) {
    assert.ok(Math.abs(puppet.bones[name].angle - puppet.bones[name].rest) <= 0.5);
  }
});
