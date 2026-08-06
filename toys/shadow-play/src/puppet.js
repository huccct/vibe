import * as G from './geometry.js';

/**
 * 骨架。角度一律用世界角（弧度，0 = +x 向右，+ = 顺时针，因为 canvas y 朝下）。
 * -90° 朝上，+90° 朝下。父子关系只用来传递位移，角度直接存世界角，
 * 因为 IK 解出来的就是世界角，省一层来回换算。
 *
 * @typedef {'torso'|'head'|'farUpperArm'|'farForeArm'|'nearUpperArm'|'nearForeArm'
 *   |'farThigh'|'farShin'|'nearThigh'|'nearShin'} BoneName
 *
 * @typedef {object} Bone
 * @property {BoneName} name
 * @property {BoneName|null} parent
 * @property {number} len 骨长（像素）
 * @property {[number, number]} pivot 在父骨骼局部空间里的挂点，根骨为 [0,0]
 * @property {number} rest 静止世界角
 * @property {number} angle 当前世界角
 * @property {import('./geometry.js').Piece} piece
 * @property {number} alpha 越远的肢体越淡，靠这个拉开层次
 *
 * @typedef {object} Puppet
 * @property {Record<BoneName, Bone>} bones
 * @property {[number, number]} root 根骨（胯）的世界位置，拖躯干时整体平移
 * @property {[number, number]} restRoot
 * @property {Partial<Record<BoneName, number>>} vel 腿的被动摆动：每根骨一个角速度
 * @property {number} prevRootX 上一帧根位置，用来算加速度
 * @property {number} prevVelX
 * @property {number|null} staffAngle 金箍棒的独立握持角；null 时跟随手腕
 */

const D = Math.PI / 180;

const ARM_U = 74;
const ARM_F = 78;
const LEG_T = 104;
const LEG_S = 101;

/** @returns {Record<BoneName, Bone>} */
export function createBones() {
  const b = (name, parent, len, pivot, restDeg, piece, alpha) => ({
    name,
    parent,
    len,
    pivot,
    rest: restDeg * D,
    angle: restDeg * D,
    piece,
    alpha,
  });

  return {
    torso: b('torso', null, 135, [0, 0], -90, G.torso(), 1),
    head: b('head', 'torso', 96, [135, -12], -90, G.head(), 1),

    // 手臂要摆离躯干轮廓，否则同色 multiply 叠上去看不出形。
    // 远侧甩向身后，近侧探到身前，一眼就分得开。
    // 肘只能朝前弯。远侧手自然下垂，稍稍探出裙摆
    farUpperArm: b('farUpperArm', 'torso', ARM_U, [114, -4], 126, G.upperArm(ARM_U), 0.72),
    farForeArm: b('farForeArm', 'farUpperArm', ARM_F, [ARM_U, 0], 96, G.foreArm(ARM_F), 0.72),
    nearUpperArm: b('nearUpperArm', 'torso', ARM_U, [114, 6], 58, G.upperArm(ARM_U), 1),
    nearForeArm: b('nearForeArm', 'nearUpperArm', ARM_F, [ARM_U, 0], 26, G.foreArm(ARM_F), 1),

    farThigh: b('farThigh', 'torso', LEG_T, [-4, 32], 112, G.thigh(LEG_T), 0.72),
    farShin: b('farShin', 'farThigh', LEG_S, [LEG_T, 0], 68, G.shin(LEG_S), 0.72),
    nearThigh: b('nearThigh', 'torso', LEG_T, [-4, 32], 86, G.thigh(LEG_T), 1),
    nearShin: b('nearShin', 'nearThigh', LEG_S, [LEG_T, 0], 90, G.shin(LEG_S), 1),
  };
}

/** @returns {Puppet} */
// 脚要落在地平线上：root_y + LEG_T + LEG_S = GROUND_Y(620)
export function createPuppet(cx = 500, cy = 415) {
  return {
    bones: createBones(),
    root: [cx, cy],
    restRoot: [cx, cy],
    vel: {},
    prevRootX: cx,
    prevVelX: 0,
    staffAngle: null,
  };
}

/**
 * 骨骼在世界空间的起点。父骨的局部挂点，按父骨世界角旋转后叠加。
 * @param {Puppet} p @param {BoneName} name @returns {[number, number]}
 */
export function boneOrigin(p, name) {
  const bone = p.bones[name];
  if (!bone.parent) return [p.root[0], p.root[1]];
  const parent = p.bones[bone.parent];
  const [px, py] = boneOrigin(p, bone.parent);
  const c = Math.cos(parent.angle);
  const s = Math.sin(parent.angle);
  const [ox, oy] = bone.pivot;
  return [px + ox * c - oy * s, py + ox * s + oy * c];
}

/**
 * 骨骼末端（手 / 脚 / 头顶）。
 * @param {Puppet} p @param {BoneName} name @returns {[number, number]}
 */
export function boneTip(p, name) {
  const bone = p.bones[name];
  const [x, y] = boneOrigin(p, name);
  return [x + Math.cos(bone.angle) * bone.len, y + Math.sin(bone.angle) * bone.len];
}

/** @type {BoneName[]} */
const SWING = ['farThigh', 'farShin', 'nearThigh', 'nearShin'];

/**
 * 腿的被动摆动：阻尼摆 + 弹回静止姿。
 * 挂点横向加速度当惯性驱动力 —— 拖着身子走，腿就自己甩起来。
 * @param {Puppet} p
 * @param {number} dt
 * @param {boolean} heldLegs 用户正牵着脚时，物理让位给 IK
 */
export function stepPhysics(p, dt, heldLegs) {
  const velX = (p.root[0] - p.prevRootX) / dt;
  const accX = (velX - p.prevVelX) / dt;
  p.prevRootX = p.root[0];
  p.prevVelX = velX;

  if (heldLegs) {
    for (const n of SWING) p.vel[n] = 0;
    return;
  }

  const stiffness = 62;
  const damping = 7.4;
  const drive = 0.004;

  for (const n of SWING) {
    const bone = p.bones[n];
    const dev = bone.angle - bone.rest;
    // 惯性项：挂点朝 +x 加速时，腿相对朝 -x 甩
    const forcing = -drive * accX * Math.cos(bone.angle);
    const acc = -stiffness * dev - damping * (p.vel[n] ?? 0) + forcing;
    const v = (p.vel[n] ?? 0) + acc * dt;
    p.vel[n] = v;
    bone.angle = Math.min(bone.rest + 0.5, Math.max(bone.rest - 0.5, bone.angle + v * dt));
  }
}

/** @param {Puppet} p */
export function resetPose(p) {
  for (const bone of Object.values(p.bones)) bone.angle = bone.rest;
  p.root = [p.restRoot[0], p.restRoot[1]];
  p.vel = {};
  p.prevRootX = p.restRoot[0];
  p.prevVelX = 0;
  p.staffAngle = null;
}

/**
 * 双骨 IK：余弦定理。给定根点和目标点，解出两根骨的世界角。
 * @param {[number, number]} root
 * @param {[number, number]} target
 * @param {number} l1 @param {number} l2
 * @param {number} bend +1 / -1 决定肘（膝）往哪边弯
 * @returns {[number, number]}
 */
export function solveIK(root, target, l1, l2, bend) {
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const reach = Math.hypot(dx, dy);
  // 夹在可达范围内，留一点余量避免完全绷直时抖动
  const d = Math.min(Math.max(reach, Math.abs(l1 - l2) + 1), l1 + l2 - 1);
  const toTarget = Math.atan2(dy, dx);

  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const a = Math.acos(Math.min(1, Math.max(-1, cosA)));
  const cosB = (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2);
  const bAng = Math.acos(Math.min(1, Math.max(-1, cosB)));

  const a1 = toTarget + bend * a;
  const a2 = a1 - bend * (Math.PI - bAng);
  return [a1, a2];
}
