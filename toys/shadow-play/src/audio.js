/**
 * 锣鼓板。皮影戏一半的魂在打击乐上，可这儿没法带音频文件，
 * 所以锣、鼓、板全部用 WebAudio 现合成。
 */

/** @type {AudioContext|null} */
let ac = null;
/** @type {GainNode|null} */
let master = null;
/** @type {AudioBuffer|null} */
let noiseBuf = null;
let muted = false;

/** 浏览器不许无手势出声，所以第一次点击时才建 context。 */
export function initAudio() {
  if (ac) return;
  const AC = window.AudioContext ?? /** @type {any} */ (window).webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain();
  master.gain.value = 0.85;
  master.connect(ac.destination);

  // 一秒白噪声，鼓和板都从这儿取料
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

/** @param {boolean} v */
export function setMuted(v) {
  muted = v;
  if (master && ac) master.gain.setTargetAtTime(v ? 0 : 0.85, ac.currentTime, 0.02);
}

export const isMuted = () => muted;

/** 现在的音频时钟。排点子要用它，不能用 performance.now。 */
const now = () => (ac ? ac.currentTime : 0);

/** @returns {AudioBufferSourceNode|null} */
function noise() {
  if (!ac || !noiseBuf) return null;
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  return s;
}

/**
 * 锣。金属声的特征是分音不成整数倍，所以几个失谐的正弦叠起来，
 * 再加一层带通噪声当敲击的"沙"。收音时略微下滑，锣面才像在晃。
 * @param {number} at @param {number} gain @param {number} base
 */
export function gong(at = now(), gain = 1, base = 196) {
  if (!ac || !master) return;
  const bus = ac.createGain();
  bus.gain.setValueAtTime(0, at);
  bus.gain.linearRampToValueAtTime(gain * 0.9, at + 0.006);
  bus.gain.exponentialRampToValueAtTime(0.0001, at + 1.6);
  bus.connect(master);

  // 失谐比例，刻意避开 2、3 这种整数倍
  for (const [mul, amp] of [[1, 1], [2.41, 0.5], [3.83, 0.32], [5.19, 0.2], [6.72, 0.12]]) {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(base * mul, at);
    o.frequency.exponentialRampToValueAtTime(base * mul * 0.94, at + 1.2);
    const g = ac.createGain();
    g.gain.value = amp;
    o.connect(g).connect(bus);
    o.start(at);
    o.stop(at + 1.7);
  }

  const n = noise();
  if (n) {
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = base * 6;
    bp.Q.value = 0.7;
    const g = ac.createGain();
    g.gain.setValueAtTime(gain * 0.5, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
    n.connect(bp).connect(g).connect(master);
    n.start(at);
    n.stop(at + 0.35);
  }
}

/**
 * 单皮鼓。一记短促的闷响：低频正弦下坠 + 一点噪声当鼓皮。
 * @param {number} at @param {number} gain @param {number} base
 */
export function drum(at = now(), gain = 1, base = 132) {
  if (!ac || !master) return;
  const o = ac.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(base, at);
  o.frequency.exponentialRampToValueAtTime(base * 0.45, at + 0.14);
  const g = ac.createGain();
  g.gain.setValueAtTime(gain * 0.85, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
  o.connect(g).connect(master);
  o.start(at);
  o.stop(at + 0.25);

  const n = noise();
  if (n) {
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(gain * 0.35, at);
    ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
    n.connect(lp).connect(ng).connect(master);
    n.start(at);
    n.stop(at + 0.1);
  }
}

/**
 * 板（梆子）。极短的一记"嗒"，高频噪声掐出来。
 * @param {number} at @param {number} gain
 */
export function clap(at = now(), gain = 1) {
  if (!ac || !master) return;
  const n = noise();
  if (!n) return;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2100;
  bp.Q.value = 2.4;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain * 0.7, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);
  n.connect(bp).connect(g).connect(master);
  n.start(at);
  n.stop(at + 0.06);
}

/** 上场：一记锣加一记鼓，把人"引"出来。 */
export function cueEnter() {
  const t = now();
  gong(t, 0.5, 240);
  drum(t + 0.13, 0.7);
}

/** 打中：锣砸下去。 */
export function cueHit() {
  const t = now();
  drum(t, 1);
  gong(t + 0.02, 1, 165);
  clap(t + 0.18, 0.6);
}

/** 打空：一记闷鼓，不给锣——听得出没落着。 */
export function cueMiss() {
  drum(now(), 0.45, 96);
}

/**
 * 紧箍咒。低频下压 + 缓慢起落，压着人喘不上气。
 * @param {number} dur
 */
export function cueSpell(dur = 2.5) {
  if (!ac || !master) return;
  const t = now();
  const bus = ac.createGain();
  bus.gain.setValueAtTime(0, t);
  bus.gain.linearRampToValueAtTime(0.5, t + 0.25);
  bus.gain.setValueAtTime(0.5, t + dur - 0.6);
  bus.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  bus.connect(master);

  for (const [f, amp, det] of [[58, 1, 0], [87, 0.5, 1.6], [116, 0.28, -2.2]]) {
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f + det;
    const g = ac.createGain();
    g.gain.value = amp;
    // 微微颤，像念咒的调子
    const lfo = ac.createOscillator();
    lfo.frequency.value = 5.5;
    const lg = ac.createGain();
    lg.gain.value = f * 0.012;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur);
  }
  gong(t, 0.4, 110);
}

/** @type {{ osc: OscillatorNode, gain: GainNode }|null} */
let eyeNode = null;

/**
 * 火眼金睛的蓄力嗡鸣。电平和音高跟着蓄力值走，松手就淡出。
 * @param {number} level 0..1
 */
export function eyeHum(level) {
  if (!ac || !master) return;
  if (level < 0.01) {
    if (eyeNode) {
      eyeNode.gain.gain.setTargetAtTime(0, ac.currentTime, 0.08);
      const n = eyeNode;
      eyeNode = null;
      setTimeout(() => n.osc.stop(), 400);
    }
    return;
  }
  if (!eyeNode) {
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 620;
    bp.Q.value = 3.5;
    const gain = ac.createGain();
    gain.gain.value = 0;
    osc.connect(bp).connect(gain).connect(master);
    osc.start();
    eyeNode = { osc, gain };
  }
  eyeNode.osc.frequency.setTargetAtTime(150 + level * 90, ac.currentTime, 0.05);
  eyeNode.gain.gain.setTargetAtTime(level * 0.11, ac.currentTime, 0.05);
}

/** 看破的一瞬：一声轻锣，音很高，像有什么被照出来了。 */
export function cueReveal() {
  gong(now(), 0.34, 470);
}

/** 贬书 / 收场：一记长锣压住。 */
export function cueExile() {
  const t = now();
  gong(t, 0.9, 124);
  drum(t + 0.45, 0.5, 108);
  drum(t + 0.8, 0.36, 96);
}
