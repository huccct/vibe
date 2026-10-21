// node scripts/check-metronome.mjs — no browser or audio device required.
import assert from 'node:assert/strict';
import { settingsFrom, tapTempo, nextPulse, createMetronome } from '../toys/metronome/engine.js';

assert.equal(settingsFrom({ bpm: 900, volume: -1 }).bpm, 300);
assert.equal(settingsFrom({ bpm: 'bad', volume: -1 }).volume, 0);
assert.equal(settingsFrom({ bpm: '' }).bpm, 80);
assert.equal(settingsFrom(null).meter, '4/4');
assert.equal(settingsFrom({ meter: 'invalid' }).meter, '4/4');
assert.deepEqual(settingsFrom({ meter: '7/8', accents: [0, 2, 'bad'] }).accents, [0, 2, 1, 1, 1, 1, 1]);
assert.equal(tapTempo([0]), null);
assert.equal(tapTempo([0, 500, 1000, 1500]), 120);
assert.equal(tapTempo([0, 2000, 4000]), 30);

for (const division of [1, 2, 3, 4]) {
  const settings = settingsFrom({ meter: '7/8', division });
  let pulse = { beat: 0, subdivision: 0 };
  const seen = new Set();
  for (let i = 0; i < division * 7; i++) {
    seen.add(`${pulse.beat}:${pulse.subdivision}`);
    pulse = nextPulse(pulse, settings);
  }
  assert.equal(seen.size, division * 7);
  assert.deepEqual(pulse, { beat: 0, subdivision: 0 });
}

// A minimal audio clock checks actual scheduling, muting, and stop/restart cleanup.
let interval;
const realSet = globalThis.setInterval, realClear = globalThis.clearInterval;
globalThis.setInterval = (callback) => { interval = callback; return 1; };
globalThis.clearInterval = () => { interval = undefined; };
try {
  const sources = [];
  const param = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ gain: param(), frequency: param(), connect(target) { return target; }, disconnect() { this.disconnected = true; } });
  const context = {
    currentTime: 0, sampleRate: 48000, destination: {},
    createGain: node,
    createBuffer: () => ({ getChannelData: () => new Float32Array(1920) }),
    createOscillator() { const voice = { ...node(), start(time) { this.time = time; }, stop() { this.stopped = true; } }; sources.push(voice); return voice; },
    createBufferSource() { return this.createOscillator(); },
  };
  let settings = settingsFrom({ bpm: 120, division: 4 });
  let pulses = [];
  const engine = createMetronome(context, () => settings, (pulse) => pulses.push(pulse));
  engine.start();
  for (let i = 1; i <= 40; i++) { context.currentTime = i * .025; interval(); }
  assert.ok(pulses.length >= 8);
  for (let i = 1; i < pulses.length; i++) assert.ok(Math.abs(pulses[i].time - pulses[i - 1].time - .125) < 1e-9);
  assert.deepEqual(pulses.slice(0, 5).map(({ beat, subdivision }) => [beat, subdivision]), [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0]]);
  engine.stop();
  assert.equal(interval, undefined);
  assert.ok(sources.every((voice) => voice.stopped && voice.disconnected));

  for (const sound of ['wood', 'click', 'hat']) {
    settings = settingsFrom({ sound });
    pulses = []; engine.start();
    assert.deepEqual([pulses[0].beat, pulses[0].subdivision], [0, 0]);
    engine.stop();
  }
  const count = sources.length;
  settings = settingsFrom({ accents: [0, 0, 0, 0] });
  engine.start(); engine.stop();
  settings = settingsFrom({ volume: 0 });
  engine.start(); engine.stop();
  assert.equal(sources.length, count);

  settings = settingsFrom(); engine.start();
  pulses = []; context.currentTime += 10; interval();
  assert.equal(pulses.length, 1);
  assert.ok(pulses[0].time > context.currentTime);
  engine.stop();
} finally {
  globalThis.setInterval = realSet;
  globalThis.clearInterval = realClear;
}
console.log('Metronome checks passed: settings, tap tempo, subdivisions, audio clock, mute, stop/restart, throttling.');
