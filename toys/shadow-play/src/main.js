import { boneOrigin, createPuppet, resetPose, stepPhysics } from './puppet.js';
import { ORIGIN, SCALE, VIEW_Y, render, toWorld } from './render.js';
import { FPS, applyPose, captureShot, download, encodeGif, shotToPlay } from './recorder.js';
import { createPlay } from './play.js';
import { stagePoseAt } from './choreography.js';
import * as A from './audio.js';

/** @typedef {import('./geometry.js').Pt} Pt */
/** @typedef {import('./puppet.js').Puppet} Puppet */
/** @typedef {'life'} RodId */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('screen'));
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('这个浏览器不支持 canvas 2d');

const startBtn = document.getElementById('start');
const exportBtn = document.getElementById('export');
const muteBtn = document.getElementById('mute');
const cueBtn = document.getElementById('cue');
const hint = document.getElementById('hint');
const curtain = document.getElementById('curtain');

const puppet = createPuppet();
const show = createPlay();
show.phase = 'theatre';
show.walkers = [];
show.monk.x = -2000;
puppet.root = [-180, 440];

/** 普通观众只接命签；两根手签由预设身段代操。 */
const RODS = {
  life: { at: (p) => boneOrigin(p, 'head'), lean: 52, hint: '命签托身 —— 左右牵它走台，再点一个身段' },
};

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** @type {RodId|null} */
let grabbed = null;
/** @type {Pt} */
let grabOffset = [0, 0];
let handleAlpha = 0;
let touched = false;
let playing = false;
let showTime = 0;
let cueIndex = 0;
let cueStep = 0;
let assist = null;
const POSE_BONES = ['torso', 'head', 'farUpperArm', 'farForeArm', 'nearUpperArm', 'nearForeArm'];

const AUTO_CUES = [
  { at: 4.2, text: '猴王进台 —— 先稳身，再亮相', sound: () => { A.drum(); A.clap(); } },
  { at: 6.5, text: '亮相 —— 一锣压住身段', sound: () => A.gong(undefined, 0.5, 230) },
  { at: 10.8, text: '探身察看 —— 身先走，手随后', sound: () => A.clap(undefined, 0.55) },
  { at: 15.2, text: '举棒 —— 锣鼓催身', sound: () => { A.drum(undefined, 0.85); A.clap(undefined, 0.7); } },
  { at: 18.4, text: '锣点定格 —— 一动之后必有一停', sound: () => A.gong(undefined, 0.8, 175) },
  { at: 22, text: '这一段演完了 —— 牵命签走台，或点一个身段', sound: () => A.clap(undefined, 0.4) },
];

function assistedPose(at, text, sound) {
  const to = stagePoseAt(at);
  to.x = puppet.root[0];
  const from = { x: puppet.root[0], y: puppet.root[1], staff: (puppet.staffAngle ?? -Math.PI / 2) * 180 / Math.PI };
  for (const name of POSE_BONES) from[name] = puppet.bones[name].angle * 180 / Math.PI;
  assist = { from, to, time: 0 };
  touched = true;
  handleAlpha = 1;
  hint.textContent = text;
  sound();
}

const CUE_ACTIONS = [
  { at: 6.5, next: '下一手 · 探身', text: '亮相接稳了 —— 一锣压住身段', sound: () => A.gong(undefined, 0.45, 230) },
  { at: 10.8, next: '下一手 · 举棒', text: '探身有了 —— 身先走，手随后', sound: () => A.clap(undefined, 0.55) },
  { at: 15.2, next: '收势', text: '棒起得利落 —— 手腕转棒，肘部折起', sound: () => A.drum(undefined, 0.8) },
  { at: 22, next: '再演一遍', text: '这一折接住了 —— 可以收影，也可以再演', sound: () => A.gong(undefined, 0.65, 175) },
];

cueBtn.addEventListener('click', () => {
  const cue = CUE_ACTIONS[cueStep];
  assistedPose(cue.at, cue.text, cue.sound);
  cueBtn.textContent = cue.next;
  cueStep = (cueStep + 1) % CUE_ACTIONS.length;
});

/** @param {PointerEvent} e @returns {Pt} */
function pointerWorld(e) {
  const rect = canvas.getBoundingClientRect();
  return toWorld(
    ((e.clientX - rect.left) / rect.width) * canvas.width,
    ((e.clientY - rect.top) / rect.height) * canvas.height,
  );
}

canvas.addEventListener('pointerdown', (e) => {
  if (!playing) return;
  A.initAudio();
  const [wx, wy] = pointerWorld(e);
  let best = null;
  let bestD = Infinity;

  for (const [id, rod] of Object.entries(RODS)) {
    const [ax, ay] = rod.at(puppet);
    const d = distToSegment(wx, wy, ax, ay, ax + rod.lean, canvas.height + VIEW_Y);
    if (d < 42 && d < bestD) {
      best = /** @type {RodId} */ (id);
      bestD = d;
    }
  }
  if (!best) return;

  grabbed = best;
  touched = true;
  assist = null;
  grabOffset = [puppet.root[0] - wx, puppet.root[1] - wy];
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('dragging');
  hint.textContent = RODS[best].hint;
});

canvas.addEventListener('pointermove', (e) => {
  if (!grabbed) return;
  const target = pointerWorld(e);

  puppet.root = [
    Math.min(1020, Math.max(70, target[0] + grabOffset[0])),
    Math.min(455, Math.max(420, target[1] + grabOffset[1])),
  ];
});

const release = () => {
  if (grabbed) hint.textContent = '锣鼓不断，接着演 —— 台上没有输赢';
  grabbed = null;
  canvas.classList.remove('dragging');
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

const RING = FPS * 8;
let ring = [];

startBtn.addEventListener('click', () => {
  A.initAudio();
  A.cueEnter();
  curtain.classList.add('gone');
  resetPose(puppet);
  puppet.root = [-180, 440];
  puppet.prevRootX = puppet.root[0];
  playing = true;
  touched = false;
  showTime = 0;
  cueIndex = 0;
  cueStep = 0;
  assist = null;
  ring = [];
  handleAlpha = 0;
  exportBtn.disabled = true;
  cueBtn.disabled = false;
  cueBtn.textContent = '接戏 · 亮相';
  hint.textContent = '灯亮 —— 后槽起锣，猴王从下场门上场';
});

muteBtn.addEventListener('click', () => {
  const next = !A.isMuted();
  A.setMuted(next);
  muteBtn.textContent = next ? '🔇' : '🔊';
  muteBtn.setAttribute('aria-label', next ? '开声音' : '静音');
});

exportBtn.addEventListener('click', async () => {
  if (ring.length < FPS) return;
  const clip = ring.slice();
  const live = captureShot(puppet, show);
  const label = exportBtn.textContent;
  exportBtn.disabled = true;
  try {
    const blob = await encodeGif(
      clip,
      (c, shot) => {
        applyPose(puppet, shot.pose);
        render(c, puppet, 0, [], 0, shotToPlay(shot));
      },
      (done, total) => { exportBtn.textContent = `收影 ${Math.round((done / total) * 100)}%`; },
      '《猴王上场》· 华县灯影',
    );
    download(blob, `猴王上场-${Date.now()}.gif`);
    hint.textContent = '这一段影收下来了';
  } finally {
    applyPose(puppet, live.pose);
    exportBtn.textContent = label;
    exportBtn.disabled = false;
  }
});

let last = performance.now();
let recAccum = 0;

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;

  if (playing) {
    showTime += dt;

    // 老戏一动一停；用户一接签，自动身段立刻让位。
    if (!touched) {
      const pose = stagePoseAt(showTime);
      puppet.root = [pose.x, pose.y];
      for (const name of ['torso', 'head', 'farUpperArm', 'farForeArm', 'nearUpperArm', 'nearForeArm']) {
        puppet.bones[name].angle = pose[name] * Math.PI / 180;
      }
      puppet.staffAngle = pose.staff * Math.PI / 180;
      while (cueIndex < AUTO_CUES.length && showTime >= AUTO_CUES[cueIndex].at) {
        const cue = AUTO_CUES[cueIndex++];
        hint.textContent = cue.text;
        cue.sound();
      }
      handleAlpha = showTime >= 22 ? 1 : 0;
    }

    if (assist) {
      assist.time += dt;
      const u = Math.min(1, assist.time / 0.7);
      const ease = u * u * (3 - 2 * u);
      puppet.root = [assist.from.x + (assist.to.x - assist.from.x) * ease, assist.from.y + (assist.to.y - assist.from.y) * ease];
      for (const name of POSE_BONES) puppet.bones[name].angle = (assist.from[name] + (assist.to[name] - assist.from[name]) * ease) * Math.PI / 180;
      puppet.staffAngle = (assist.from.staff + (assist.to.staff - assist.from.staff) * ease) * Math.PI / 180;
      if (u === 1) assist = null;
    }

    stepPhysics(puppet, dt, false);
    recAccum += dt;
    while (recAccum >= 1 / FPS) {
      ring.push(captureShot(puppet, show));
      if (ring.length > RING) ring.shift();
      recAccum -= 1 / FPS;
    }
    if (ring.length >= FPS) exportBtn.disabled = false;
  }

  if (touched) handleAlpha = Math.max(0, handleAlpha - dt * 0.55);
  const handles = Object.values(RODS).map((rod) => {
    const [x, y] = rod.at(puppet);
    return {
      pos: [(x - ORIGIN[0]) * SCALE + ORIGIN[0], (y - ORIGIN[1]) * SCALE + ORIGIN[1] - VIEW_Y],
      r: 32 * SCALE,
    };
  });
  render(ctx, puppet, t, handles, handleAlpha, show);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
