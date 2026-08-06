import { GifWriter, applyPalette, buildPalette } from './gif.js';

/**
 * @typedef {import('./puppet.js').Puppet} Puppet
 * @typedef {import('./puppet.js').BoneName} BoneName
 * @typedef {object} Pose 一帧只存骨骼角度和根位置 —— 比存像素小四个数量级
 * @property {[number, number]} root
 * @property {Partial<Record<BoneName, number>>} angles
 * @property {number|null} staffAngle
 */

export const FPS = 20;
export const DURATION = 5;
export const MAX_FRAMES = FPS * DURATION;

/** 影窗原画尺寸，要和 index.html 的 canvas 一致。 */
const FULL_W = 1120;
const FULL_H = 480;

/** GIF 输出尺寸。缩到这个尺寸微信 / 小红书都能直接发。 */
const OUT_W = 560;
const OUT_H = 240;

/**
 * @param {Puppet} p @returns {Pose}
 */
export function capturePose(p) {
  const angles = {};
  for (const [name, bone] of Object.entries(p.bones)) angles[name] = bone.angle;
  return { root: [p.root[0], p.root[1]], angles, staffAngle: p.staffAngle };
}

/**
 * @param {Puppet} p @param {Pose} pose
 */
export function applyPose(p, pose) {
  p.root = [pose.root[0], pose.root[1]];
  for (const [name, angle] of Object.entries(pose.angles)) {
    if (angle !== undefined) p.bones[name].angle = angle;
  }
  p.staffAngle = pose.staffAngle;
}

/**
 * 整场快照。GIF 要重现的是一台戏，不只是悟空 ——
 * 白骨精走到哪、金睛聚了多少、幕是不是泛红，都得存。
 * 仍然只存数字，不存像素。
 * @typedef {object} Shot
 * @property {Pose} pose
 * @property {any[]} walkers
 * @property {any} monk
 * @property {number} eyeLevel
 * @property {string} phase
 * @property {number} timer
 * @property {number} shake
 * @property {number} revealFlash
 */

const cloneWalker = (w) => ({
  x: w.x, y: w.y, phase: w.phase, flip: w.flip, form: w.form,
  revealLevel: w.revealLevel, isBone: w.isBone, dead: w.dead,
  deathTimer: w.deathTimer, exiting: w.exiting, chanting: w.chanting,
  speed: w.speed,
});

/**
 * @param {Puppet} p @param {any} play @returns {Shot}
 */
export function captureShot(p, play) {
  return {
    pose: capturePose(p),
    walkers: play.walkers.map(cloneWalker),
    monk: cloneWalker(play.monk),
    eyeLevel: play.eyeLevel,
    phase: play.phase,
    timer: play.timer,
    shake: play.shake,
    revealFlash: play.revealFlash,
  };
}

/** 把快照还原成可渲染的 play 形状。 */
export function shotToPlay(shot) {
  return {
    walkers: shot.walkers,
    monk: shot.monk,
    eyeLevel: shot.eyeLevel,
    phase: shot.phase,
    timer: shot.timer,
    shake: shot.shake,
    revealFlash: shot.revealFlash,
  };
}

/** 让出主线程一帧，编码时 UI 不卡。 */
const yieldToUI = () => new Promise((r) => setTimeout(r, 0));

/**
 * 重放每一帧姿态，编码成 GIF。
 * @param {Pose[]} poses
 * @param {(ctx: CanvasRenderingContext2D, pose: Pose, index: number) => void} drawFrame
 *   把一个 pose 画到给定的 800×1000 上下文里
 * @param {(done: number, total: number) => void} [onProgress]
 * @returns {Promise<Blob>}
 */
export async function encodeGif(poses, drawFrame, onProgress, title) {
  const full = document.createElement('canvas');
  full.width = FULL_W;
  full.height = FULL_H;
  const fctx = full.getContext('2d');

  const small = document.createElement('canvas');
  small.width = OUT_W;
  small.height = OUT_H;
  const sctx = small.getContext('2d', { willReadFrequently: true });

  if (!fctx || !sctx) throw new Error('2d context unavailable');
  sctx.imageSmoothingQuality = 'high';

  const grab = (i) => {
    drawFrame(fctx, poses[i], i);
    sctx.drawImage(full, 0, 0, OUT_W, OUT_H);
    if (title) {
      // 戏名烧进画面 —— 转出去的人才知道这是哪一折
      sctx.save();
      sctx.font = '600 19px "Songti SC", "SimSun", serif';
      sctx.textAlign = 'center';
      sctx.textBaseline = 'bottom';
      sctx.shadowColor = 'rgba(60, 28, 10, 0.55)';
      sctx.shadowBlur = 6;
      sctx.fillStyle = 'rgba(74, 36, 14, 0.9)';
      sctx.fillText(title, OUT_W / 2, OUT_H - 16);
      sctx.restore();
    }
    return sctx.getImageData(0, 0, OUT_W, OUT_H).data;
  };

  // 全片共用一张色板：色域窄，首帧取样就够，且能避免逐帧换板导致的色彩跳动
  const pal = buildPalette(grab(0));
  const gif = new GifWriter(OUT_W, OUT_H, pal.palette);
  const delay = Math.round(1000 / FPS);

  for (let i = 0; i < poses.length; i++) {
    // 首帧已经画过，但为了代码直白就重画一次，成本可忽略
    gif.writeFrame(applyPalette(grab(i), pal), delay);
    onProgress?.(i + 1, poses.length);
    if (i % 4 === 3) await yieldToUI();
  }

  return gif.finish();
}

/**
 * @param {Blob} blob @param {string} filename
 */
export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // 立刻 revoke 有几率赶在下载真正开始之前，把 URL 抽掉
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
