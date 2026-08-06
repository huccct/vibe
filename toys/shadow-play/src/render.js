import { boneOrigin, boneTip } from './puppet.js';
import { drawWalker } from './cast.js';
import { drawScenery } from './scene.js';
import { LEATHER, drawPiece } from './leather.js';
import { drawWukongSprite, wukongSpritesReady } from './sprites.js';

/**
 * @typedef {import('./geometry.js').Pt} Pt
 * @typedef {import('./geometry.js').Piece} Piece
 * @typedef {import('./puppet.js').Puppet} Puppet
 * @typedef {import('./puppet.js').BoneName} BoneName
 * @typedef {{ pos: Pt, r: number }} Handle
 */

/** 影窗的世界变换：绕 ORIGIN 缩放。main.js 反算指针坐标要用同一组常量。 */
export const SCALE = 1;
/** @type {Pt} */
export const ORIGIN = [550, 390];
/** 旧世界坐标向上裁掉这一段，形成传统七宽三高的长影窗。 */
export const VIEW_Y = 190;

/** 地平线。所有人都站这条线上。 */
export const GROUND_Y = 620;

/** @returns {Pt} */
export function toWorld(px, py) {
  return [
    (px - ORIGIN[0]) / SCALE + ORIGIN[0],
    (py + VIEW_Y - ORIGIN[1]) / SCALE + ORIGIN[1],
  ];
}

/**
 * 画序：远侧肢体 → 躯干 → 头 → 近侧肢体。
 * 后画的皮子会盖住先画的镂空，跟真皮影一样。
 * @type {BoneName[]}
 */
const ORDER = [
  'farThigh',
  'farShin',
  'farUpperArm',
  'farForeArm',
  'torso',
  'head',
  'nearThigh',
  'nearShin',
  'nearUpperArm',
  'nearForeArm',
];

const WUKONG = {
  head: '221, 126, 34',
  torso: '188, 43, 31',
  arm: '210, 68, 30',
  leg: '42, 118, 91',
};

function wukongTint(name) {
  if (name === 'head') return WUKONG.head;
  if (name === 'torso') return WUKONG.torso;
  return name.includes('Arm') ? WUKONG.arm : WUKONG.leg;
}

function drawPlumes(ctx) {
  const plume = (endX, endY, bendX, bendY) => {
    ctx.beginPath();
    ctx.moveTo(56, -31);
    ctx.bezierCurveTo(62, -72, bendX, bendY, endX, endY);
    ctx.stroke();
  };
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(42, 16, 12, 0.96)';
  ctx.lineWidth = 10;
  plume(25, -158, 60, -126);
  plume(6, -146, 35, -112);
  ctx.strokeStyle = 'rgba(205, 70, 30, 0.96)';
  ctx.lineWidth = 5.5;
  plume(25, -158, 60, -126);
  plume(6, -146, 35, -112);
}

/**
 * 竹签：一根挑躯干，两根挑手。斜插向台下，操纵者在幕后。
 * @param {CanvasRenderingContext2D} ctx @param {Puppet} p @param {number} h
 */
function drawRods(ctx, p, h) {
  ctx.lineCap = 'round';
  const rod = (from, lean, w, alpha) => {
    // 越往下越淡：签子伸进幕后的暗处，不该跟影人一样实
    const grad = ctx.createLinearGradient(from[0], from[1], from[0] + lean, h);
    grad.addColorStop(0, `rgba(${LEATHER}, ${alpha})`);
    grad.addColorStop(1, `rgba(${LEATHER}, 0)`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(from[0], from[1]);
    ctx.lineTo(from[0] + lean, h);
    ctx.stroke();
  };
  rod(boneTip(p, 'nearForeArm'), 74, 2.6, 0.62);
  rod(boneTip(p, 'farForeArm'), 104, 2.2, 0.4);
  rod(boneOrigin(p, 'head'), 52, 3.2, 0.66);
}

/** 金箍棒。攥在近侧手里，跟着小臂转。 */
export const STAFF_FWD = 168;
const STAFF_BACK = 54;

/** 棒的两端（世界坐标）。挥棒判定和画都用这个。 */
export function staffEnds(p) {
  const hand = boneTip(p, 'nearForeArm');
  // 手腕可以转棒；手动状态下也与小臂近似垂直，不再像小臂凭空变长。
  const ang = p.staffAngle ?? p.bones.nearForeArm.angle - Math.PI / 2;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return {
    hand,
    tip: [hand[0] + c * STAFF_FWD, hand[1] + s * STAFF_FWD],
    butt: [hand[0] - c * STAFF_BACK, hand[1] - s * STAFF_BACK],
  };
}

/** @param {CanvasRenderingContext2D} ctx @param {Puppet} p */
function drawStaff(ctx, p) {
  const { tip, butt } = staffEnds(p);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(${LEATHER}, 1)`;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(butt[0], butt[1]);
  ctx.lineTo(tip[0], tip[1]);
  ctx.stroke();

  // 两头的金箍：留白两道，靠 destination-out 挖出来
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = 7;
  const band = (t) => {
    const x = butt[0] + (tip[0] - butt[0]) * t;
    const y = butt[1] + (tip[1] - butt[1]) * t;
    const nx = (tip[1] - butt[1]) / STAFF_FWD;
    const ny = -(tip[0] - butt[0]) / STAFF_FWD;
    ctx.beginPath();
    ctx.moveTo(x - nx * 5, y - ny * 5);
    ctx.lineTo(x + nx * 5, y + ny * 5);
    ctx.lineWidth = 3;
    ctx.stroke();
  };
  band(0.12);
  band(0.9);
  ctx.restore();
}

/** 皮革层的离屏画布。整个影人先画在这里，再整层 multiply 叠到布幕上。 */
let layer = null;
/** 景片层。比影人淡、比影人虚，贴幕没那么紧。 */
let sceneLayer = null;

function getLayer(w, h) {
  if (!layer || layer.width !== w || layer.height !== h) {
    layer = document.createElement('canvas');
    layer.width = w;
    layer.height = h;
  }
  const c = layer.getContext('2d');
  if (!c) throw new Error('2d context unavailable');
  return [layer, c];
}

function getSceneLayer(w, h) {
  if (!sceneLayer || sceneLayer.width !== w || sceneLayer.height !== h) {
    sceneLayer = document.createElement('canvas');
    sceneLayer.width = w;
    sceneLayer.height = h;
  }
  const c = sceneLayer.getContext('2d');
  if (!c) throw new Error('2d context unavailable');
  return [sceneLayer, c];
}

let grain = null;

/** 布幕的织纹。一次性生成一小块噪点当 pattern 铺满。 */
function grainPattern(ctx) {
  if (grain) return grain;
  const tile = document.createElement('canvas');
  tile.width = tile.height = 96;
  const tc = tile.getContext('2d');
  if (!tc) return null;
  const img = tc.createImageData(96, 96);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 74;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  tc.putImageData(img, 0, 0);
  grain = ctx.createPattern(tile, 'repeat');
  return grain;
}

/** 灯光打在布幕上：中心暖亮，四周压暗。 */
function drawScreen(ctx, w, h, t, play) {
  // 灯焰的呼吸，很轻微，别晃眼
  const flicker = 1 + Math.sin(t * 2.1) * 0.012 + Math.sin(t * 5.7) * 0.008;

  // 聚金睛时灯色退青，像有别的光压过来；念咒时整幕泛红
  const eye = play?.eyeLevel ?? 0;
  const spell = play?.phase === 'spell' && play.monk?.chanting
    ? Math.min(1, play.timer / 0.3) * (0.6 + Math.sin(t * 9) * 0.4)
    : 0;

  const mix = (a, b, k) => Math.round(a + (b - a) * k);
  const r0 = mix(mix(255, 214, eye * 0.5), 255, spell);
  const g0 = mix(mix(233, 236, eye * 0.5), 150, spell);
  const b0 = mix(mix(186, 246, eye * 0.5), 132, spell);

  // 白棉布后的一盏油灯：中央亮、四角旧，不做电影式大光晕。
  const lamp = ctx.createRadialGradient(w * 0.52, h * 0.48, 20, w * 0.52, h * 0.48, w * 0.7);
  lamp.addColorStop(0, `rgba(${r0}, ${g0}, ${b0}, ${0.98 * flicker})`);
  lamp.addColorStop(0.62, `rgba(${mix(245, 236, spell * 0.4)}, ${mix(221, 165, spell)}, ${mix(174, 132, spell)}, 0.96)`);
  lamp.addColorStop(1, 'rgba(185, 142, 91, 0.95)');
  ctx.fillStyle = '#ead3a3';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = lamp;
  ctx.fillRect(0, 0, w, h);

  const pat = grainPattern(ctx);
  if (pat) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, h * 0.32, w * 0.5, h * 0.5, w * 0.58);
  vig.addColorStop(0, 'rgba(60, 30, 12, 0)');
  vig.addColorStop(1, 'rgba(46, 22, 8, 0.34)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Puppet} p
 * @param {number} t 秒，用于灯焰呼吸和把手脉动
 * @param {Handle[]} handles
 * @param {number} handleAlpha
 */
export function render(ctx, p, t, handles, handleAlpha, play) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  // 打空的余震：整个画面晃一下
  const shake = play?.shake ?? 0;
  ctx.save();
  if (shake > 0.01) {
    ctx.translate(Math.sin(t * 60) * shake * 5, Math.sin(t * 47) * shake * 3);
  }

  drawScreen(ctx, w, h, t, play);

  // 景片先上，单独一层，糊一点、淡一点 —— 贴幕没影人紧
  if (play) {
    const [sc, sctx] = getSceneLayer(w, h);
    sctx.clearRect(0, 0, w, h);
    drawScenery(sctx, w, h, t, GROUND_Y - VIEW_Y);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.85;
    ctx.filter = 'blur(2.4px)';
    ctx.drawImage(sc, 0, 0);
    ctx.restore();
  }

  const demon = play?.walkers.find((wk) => wk.isBone && !wk.dead && !wk.exiting);
  const reveal = Math.max(0, ((play?.eyeLevel ?? 0) - 0.42) / 0.58);
  if (demon && reveal > 0.01) {
    // 骨相不是 HUD 数值：灯要先在她背后冷下来，观众才会抬眼看她。
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const dy = demon.y - VIEW_Y;
    const aura = ctx.createRadialGradient(demon.x, dy - 170, 18, demon.x, dy - 170, 185);
    aura.addColorStop(0, `rgba(210, 248, 244, ${reveal * 0.42})`);
    aura.addColorStop(0.45, `rgba(119, 202, 194, ${reveal * 0.2})`);
    aura.addColorStop(1, 'rgba(119, 202, 194, 0)');
    ctx.fillStyle = aura;
    ctx.fillRect(demon.x - 190, dy - 370, 380, 390);
    ctx.restore();
  }

  const [lc, lctx] = getLayer(w, h);
  lctx.clearRect(0, 0, w, h);
  lctx.save();
  lctx.translate(0, -VIEW_Y);
  lctx.translate(ORIGIN[0], ORIGIN[1]);
  lctx.scale(SCALE, SCALE);
  lctx.translate(-ORIGIN[0], -ORIGIN[1]);

  // 配角：白骨精、村民、唐僧
  if (play) {
    for (const wk of play.walkers) drawWalker(lctx, wk, t);
    drawWalker(lctx, play.monk, t);
  }

  drawRods(lctx, p, h + VIEW_Y);
  drawStaff(lctx, p);
  for (const name of ORDER) {
    const bone = p.bones[name];
    const [x, y] = boneOrigin(p, name);
    lctx.save();
    lctx.translate(x, y);
    lctx.rotate(bone.angle);
    if (name === 'head' && !wukongSpritesReady()) drawPlumes(lctx);
    lctx.globalAlpha = bone.alpha;
    if (!drawWukongSprite(lctx, name)) drawPiece(lctx, bone.piece, 1, 0, wukongTint(name));
    lctx.restore();
  }

  // 华县影人的轮盘关节是结构，也是装饰；正面必须看得见。
  if (!wukongSpritesReady()) for (const name of ORDER) {
    if (name === 'torso' || name === 'head') continue;
    const [x, y] = boneOrigin(p, name);
    lctx.beginPath();
    lctx.arc(x, y, 6.5, 0, Math.PI * 2);
    lctx.fillStyle = `rgba(${wukongTint(name)}, 0.98)`;
    lctx.fill();
    lctx.lineWidth = 2.4;
    lctx.strokeStyle = 'rgba(42, 16, 12, 0.95)';
    lctx.stroke();
    lctx.beginPath();
    lctx.arc(x, y, 1.8, 0, Math.PI * 2);
    lctx.fillStyle = 'rgba(242, 205, 118, 0.9)';
    lctx.fill();
  }
  lctx.restore();

  // 皮子紧贴布幕，边缘会晕出一圈暖光
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.3;
  ctx.filter = 'blur(11px)';
  ctx.drawImage(lc, 0, 0);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(lc, 0, 0);
  ctx.restore();

  if (handleAlpha > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const pulse = 0.55 + Math.sin(t * 3) * 0.28;
    for (const hd of handles) {
      const [hx, hy] = hd.pos;
      const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, hd.r);
      g.addColorStop(0, `rgba(255, 208, 130, ${0.5 * pulse * handleAlpha})`);
      g.addColorStop(0.6, `rgba(255, 176, 90, ${0.22 * pulse * handleAlpha})`);
      g.addColorStop(1, 'rgba(255, 160, 60, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(hx, hy, hd.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 看破的那一瞬，幕上过一道白光
  if (play?.revealFlash > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = `rgba(225, 255, 248, ${play.revealFlash * 0.3})`;
    ctx.fillRect(0, 0, w, h);
    if (demon) {
      ctx.strokeStyle = `rgba(221, 255, 248, ${play.revealFlash * 0.72})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(demon.x, demon.y - VIEW_Y - 170, 70 + (1 - play.revealFlash) * 115, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore(); // 收掉画面晃动
}
