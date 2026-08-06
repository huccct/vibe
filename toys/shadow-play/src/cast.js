/**
 * 《三打白骨精》的配角皮子：白骨精的三个化身、真村民、唐僧。
 *
 * 跟悟空同一套皮子（geometry.js 的 folk* + leather.js 的 drawPiece），
 * 只是不跑 IK —— 配角只需要走路，姿态用一条正弦相位算出来就够。
 *
 * 坐标约定：walker.x/y 是**双脚落地点**，身体朝 +x（向右）。
 * flip=-1 从右边入场、朝左走。
 *
 * 白骨精的"看破"：把每块皮子的 bones 镂孔按 revealLevel 挖穿，
 * 光真的从骨头形状里透过来。不另画一层骨架。
 */

import { folkHead, folkTorso, folkLimb, basket, cane } from './geometry.js';
import { drawPiece } from './leather.js';

/**
 * @typedef {'village'|'elder'|'oldman'|'extra'|'monk'} Form
 *
 * @typedef {object} Walker
 * @property {number} x 落脚点 X
 * @property {number} y 落脚点 Y（地平线）
 * @property {number} phase 走步相位（弧度）
 * @property {number} flip +1=朝右, -1=朝左
 * @property {Form} form 造型
 * @property {number} revealLevel 0=全遮 1=骨头全透（只对 isBone 有意义）
 * @property {boolean} isBone 是否是白骨精
 * @property {number} speed 横向速度（世界像素/秒）
 * @property {boolean} exiting 已遁走
 * @property {boolean} dead 被打中
 * @property {number} deathTimer 倒地计时
 * @property {boolean} chanting 念咒（只有唐僧用）
 */

/**
 * 骨长。要跟 folk* 皮子的尺寸对上：folkTorso 的肩口在 x=140，
 * 所以躯干骨就是 140，脖子接在皮子顶端而不是半腰。
 * 合起来约 372 世界像素高，乘体量后约 345 —— 悟空 426，矮一头，
 * 才读得出"凡人"。
 */
const TORSO = 140;
/** 肩不在躯干顶端，在稍下一点，跟悟空一样（他是 128/150）。 */
const SHOULDER = 118;
const HEAD_H = 80;
const ARM_U = 52;
const ARM_F = 54;
const LEG_T = 74;
const LEG_S = 78;
const LEG = LEG_T + LEG_S;

const D = Math.PI / 180;

/**
 * 每种造型的皮子和体量。皮子只刻一次，所有同型配角共用
 * —— 反正 Piece 是只读的顶点表。
 */
const KINDS = {
  // 三个化身得在剪影上就分得开 —— 光换个头饰，第二回看着还是第一回。
  // 村姑挺、老妇塌得最狠也最小、老翁高瘦驼一点
  village: { kind: 'girl', scale: 0.94, prop: 'basket', lean: 0, colors: ['196, 55, 44', '225, 126, 38'] },
  extra: { kind: 'girl', scale: 0.96, prop: 'basket', lean: 0, colors: ['196, 55, 44', '225, 126, 38'] },
  elder: { kind: 'crone', scale: 0.8, prop: 'cane', lean: 26, colors: ['43, 126, 105', '91, 157, 116'] },
  oldman: { kind: 'oldman', scale: 0.97, prop: 'cane', lean: 14, colors: ['179, 115, 27', '215, 157, 48'] },
  monk: { kind: 'monk', scale: 1, prop: 'none', lean: 0, colors: ['187, 76, 24', '226, 144, 35'] },
};

/** @type {Record<string, {head: any, torso: any, arm: any, thighP: any, shinP: any, prop: any}>} */
const SKINS = {};

function skinFor(form) {
  const cfg = KINDS[form] ?? KINDS.extra;
  if (!SKINS[form]) {
    SKINS[form] = {
      head: folkHead(cfg.kind),
      torso: folkTorso(cfg.kind),
      arm: folkLimb(ARM_U, 'upper'),
      fore: folkLimb(ARM_F, 'fore'),
      thighP: folkLimb(LEG_T, 'thigh'),
      shinP: folkLimb(LEG_S, 'shin'),
      basket: cfg.prop === 'basket' ? basket() : null,
      propKind: cfg.prop,
    };
  }
  return [SKINS[form], cfg];
}

/**
 * 画一块挂在关节上的皮子。
 * @param {CanvasRenderingContext2D} ctx
 * @param {[number, number]} at @param {number} ang
 * @param {import('./geometry.js').Piece} piece
 * @param {number} alpha @param {number} reveal
 */
function limb(ctx, at, ang, piece, alpha, reveal, tint) {
  ctx.save();
  ctx.translate(at[0], at[1]);
  ctx.rotate(ang);
  drawPiece(ctx, piece, alpha, reveal, tint);
  ctx.restore();
}

/** 沿某个角度走一段，得到下一个关节。 @returns {[number, number]} */
const step = (at, ang, len) => [at[0] + Math.cos(ang) * len, at[1] + Math.sin(ang) * len];

/**
 * 画一个 Walker。
 * @param {CanvasRenderingContext2D} ctx
 * @param {Walker} w
 * @param {number} t 秒
 */
export function drawWalker(ctx, w, t) {
  const [sk, cfg] = skinFor(w.form);
  const [cloth, skin] = cfg.colors;
  const rev = w.isBone ? w.revealLevel : 0;
  const swing = Math.sin(w.phase);
  const moving = Math.abs(w.speed) > 1;
  const sw = moving ? swing * 0.34 : swing * 0.04;

  ctx.save();
  ctx.translate(w.x, w.y);
  ctx.scale(w.flip * cfg.scale, cfg.scale);

  // 被打中：绕胯往后倒下去，边倒边淡
  if (w.dead) {
    ctx.translate(0, -LEG);
    ctx.rotate(-Math.min(1.5, w.deathTimer * 2.4));
    ctx.translate(0, LEG);
    ctx.globalAlpha = Math.max(0, 1 - w.deathTimer * 0.7);
  }

  // 走路时胯会随步子起伏一点，不然像滑行
  const bob = moving ? Math.abs(Math.cos(w.phase)) * 3 : 0;
  /** @type {[number, number]} */
  const hip = [0, -LEG + bob];

  const torsoAng = -90 * D + cfg.lean * D;
  const shoulder = step(hip, torsoAng, SHOULDER);
  const neck = step(hip, torsoAng, TORSO);

  // ——— 远侧腿臂：淡一档，先画，被躯干压住。
  // 跟悟空同一档（0.72），再淡就成半透明的了
  const far = 0.74;
  // 膝只能往后弯。腿往前迈时（角度小于 90°）小腿要拖在后面，
  // 也就是再加一个正角；往后甩时腿是直的
  const farThighAng = 90 * D - sw * 0.9;
  const farKnee = step(hip, farThighAng, LEG_T);
  limb(ctx, hip, farThighAng, sk.thighP, far, rev, cloth);
  limb(ctx, farKnee, farThighAng + Math.max(0, sw) * 0.55, sk.shinP, far, rev, cloth);

  // 合掌：肘沉在身侧偏后，小臂折上来，两手在胸前碰头。
  // 大臂往前抬会变成"伸手要东西"，不是念咒
  const chantFar = w.form === 'monk' && w.chanting;
  const farArmAng = chantFar ? 100 * D : 96 * D + sw * 0.8;
  const farElbow = step(shoulder, farArmAng, ARM_U);
  limb(ctx, shoulder, farArmAng, sk.arm, far, rev, cloth);
  limb(ctx, farElbow, chantFar ? -37 * D : farArmAng - 0.3, sk.fore, far, rev, cloth);

  // ——— 躯干 + 头
  limb(ctx, hip, torsoAng, sk.torso, 0.95, rev, cloth);
  const nod = moving ? Math.sin(w.phase * 2) * 0.03 : Math.sin(t * 1.4) * 0.02;
  limb(ctx, neck, torsoAng + cfg.lean * D * 0.6 + nod, sk.head, 1, rev, skin);

  // ——— 近侧腿臂
  const nearThighAng = 90 * D + sw * 0.9;
  const nearKnee = step(hip, nearThighAng, LEG_T);
  limb(ctx, hip, nearThighAng, sk.thighP, 1, rev, cloth);
  limb(ctx, nearKnee, nearThighAng + Math.max(0, -sw) * 0.55, sk.shinP, 1, rev, cloth);

  // 唐僧念咒时合掌当胸 —— 一眼看出咒是他在念。
  // 手别抬过头，抬高了会挡住自己的脸
  const chant = w.form === 'monk' && w.chanting;
  const tremble = chant ? Math.sin(t * 7) * 0.06 : 0;
  const nearArmAng = chant ? 100 * D + tremble : 88 * D - sw * 0.8;
  const nearElbow = step(shoulder, nearArmAng, ARM_U);
  limb(ctx, shoulder, nearArmAng, sk.arm, 1, rev, cloth);
  const nearForeAng = chant ? -37 * D + tremble : nearArmAng + 0.28;
  limb(ctx, nearElbow, nearForeAng, sk.fore, 1, rev, cloth);

  // ——— 道具挂在近侧手上。篮和拐都要竖着挂，
  // 所以角度是 +90°（局部 +x 朝下），跟手臂当时的姿态无关。
  if (sk.propKind !== 'none' && !chant) {
    const hand = step(nearElbow, nearForeAng, ARM_F);
    if (sk.propKind === 'cane') {
      // 局部原点在落脚点，所以地面就是 y=0：
      // 手离地 -hand[1]，拐杖就得这么长才杵得到地上
      limb(ctx, hand, 90 * D, cane(-hand[1] - 2), 0.9, 0, '93, 49, 22');
    } else if (sk.basket) {
      // 往身前挪一点，不然篮子压在近侧腿上
      limb(ctx, [hand[0] + 16, hand[1]], 90 * D, sk.basket, 0.9, 0, '132, 73, 24');
    }
  }

  ctx.restore();
}

/**
 * @param {Partial<Walker>} init
 * @returns {Walker}
 */
export function createWalker(init = {}) {
  return {
    x: 0, y: 620, phase: 0, flip: 1, form: 'extra',
    revealLevel: 0, isBone: false, speed: 42,
    exiting: false, dead: false, deathTimer: 0,
    chanting: false,
    ...init,
  };
}

/**
 * 推进一个 Walker。
 * @param {Walker} w @param {number} dt
 */
export function stepWalker(w, dt) {
  if (w.dead) {
    w.deathTimer += dt;
    return;
  }
  w.x += w.speed * w.flip * dt;
  w.phase += dt * (w.speed / 11);
}

/** Walker 的碰撞盒（世界坐标）。跟着体量一起缩。 */
export function walkerBox(w) {
  const [, cfg] = skinFor(w.form);
  const s = cfg.scale;
  // 躯干加下摆约 ±46 宽；高从脚到头顶
  return {
    x0: w.x - 46 * s, x1: w.x + 46 * s,
    y0: w.y - (LEG + TORSO + HEAD_H) * s, y1: w.y + 6,
  };
}
