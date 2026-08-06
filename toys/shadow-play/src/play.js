/**
 * 一折戏的状态机。
 *
 * 戏核是个两难：火眼金睛要攥住签子**不动**才聚得起来，
 * 白骨才从她皮子里透出来；可打下去必须挥棒——一动，金睛就散。
 * 所以只能先定住看清，再抢在她走出幕之前出手。
 *
 * 而且打对了也要挨罚：唐僧看不见白骨，每打中一次就念紧箍咒。
 * 三打之后他照样写贬书。你全做对了，还是被赶走——这是原著的结局。
 */

import { createWalker, stepWalker, walkerBox } from './cast.js';
import * as A from './audio.js';

/** 火眼金睛只认命签：真攥住、真停稳，才算在看。 */
export const canFocusEye = (grabbed, speed) => grabbed === 'life' && speed < 28;

/**
 * @typedef {'curtain'|'enter'|'watch'|'spell'|'failed'|'exile'|'done'} Phase
 * @typedef {import('./cast.js').Walker} Walker
 */

/** 三个回合的配置。越往后走得越快、金睛聚得越慢。 */
export const ROUNDS = [
  { form: 'village', name: '村姑', extras: 1, speed: 46, chargeRate: 1.5 },
  { form: 'elder', name: '老妇', extras: 2, speed: 58, chargeRate: 1.15 },
  { form: 'oldman', name: '老翁', extras: 2, speed: 72, chargeRate: 0.92 },
];

const GROUND_Y = 620;
const STAGE_W = 1100;

/** @returns {object} */
export function createPlay() {
  return {
    /** @type {Phase} */
    phase: 'curtain',
    round: 0,
    hits: 0,
    /** @type {Walker[]} */
    walkers: [],
    /** 火眼金睛蓄力 0..1 */
    eyeLevel: 0,
    /** 停留计时：签子不动累积，动了清零 */
    stillTime: 0,
    /** 状态计时器 */
    timer: 0,
    /** 唐僧。站在台右看着，他永远看不见白骨 @type {Walker} */
    monk: createWalker({ x: 1010, y: GROUND_Y, flip: -1, form: 'monk', speed: 0 }),
    /** 提示文案 */
    message: '',
    /** 打空的余震，用来晃一下画面 */
    shake: 0,
    /** 刚看破的闪光 */
    revealFlash: 0,
  };
}

/** 白骨精现在在场上吗 */
export const demonOf = (play) => play.walkers.find((w) => w.isBone && !w.dead && !w.exiting);

/**
 * 起一个回合：白骨精 + 真村民，位置打散，从两边入场。
 * @param {object} play
 */
export function startRound(play) {
  const cfg = ROUNDS[play.round];
  play.walkers = [];

  // 白骨精和村民混在一起，入场顺序随机，免得靠位置就能猜
  const slots = [];
  slots.push({ isBone: true, form: cfg.form });
  for (let i = 0; i < cfg.extras; i++) {
    // 同一回必须披着同一张皮相，不然老妇混在村姑里，根本不用火眼金睛。
    slots.push({ isBone: false, form: cfg.form });
  }
  // 洗牌
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  // 入场方向左右交替。各自独立掷硬币的话，几个人经常从同一边挤成一团，
  // 台上就只剩一个目标 —— 玩家没得挑，这一回就废了。
  const flipFirst = Math.random() < 0.5;
  slots.forEach((s, i) => {
    const fromLeft = flipFirst ? i % 2 === 0 : i % 2 === 1;
    play.walkers.push(
      createWalker({
        x: fromLeft ? -80 - Math.floor(i / 2) * 150 : STAGE_W + 80 + Math.floor(i / 2) * 150,
        y: GROUND_Y,
        flip: fromLeft ? 1 : -1,
        form: s.form,
        isBone: s.isBone,
        speed: cfg.speed * (0.9 + Math.random() * 0.25),
        phase: Math.random() * 6,
      }),
    );
  });

  play.phase = 'enter';
  play.timer = 0;
  play.eyeLevel = 0;
  play.stillTime = 0;
  play.message = `第${'一二三'[play.round]}回 · ${cfg.name}上山`;
  A.cueEnter();
}

/**
 * 挥棒打下去。
 * @param {object} play
 * @param {{x0:number,x1:number,y0:number,y1:number}} staffBox 金箍棒扫过的范围
 * @returns {'hit'|'innocent'|'miss'}
 */
export function strike(play, staffBox) {
  if (play.phase !== 'watch') return 'miss';

  const overlaps = (b) =>
    staffBox.x1 > b.x0 && staffBox.x0 < b.x1 && staffBox.y1 > b.y0 && staffBox.y0 < b.y1;

  for (const w of play.walkers) {
    if (w.dead || w.exiting) continue;
    if (!overlaps(walkerBox(w))) continue;

    if (w.isBone) {
      w.dead = true;
      play.hits++;
      A.cueHit();
      play.phase = 'spell';
      play.timer = 0;
      // 唐僧看不见白骨，只看见你打了个老人家
      play.monk.chanting = true;
      A.cueSpell(2.5);
      play.message = '唐僧看不见白骨 —— 紧箍咒念起来了';
      return 'hit';
    }

    // 打错了真人，这一折就演砸了
    w.dead = true;
    A.cueHit();
    play.phase = 'failed';
    play.timer = 0;
    play.monk.chanting = true;
    A.cueExile();
    play.message = '打错了 —— 这是真的村民';
    return 'innocent';
  }

  A.cueMiss();
  play.shake = 0.5;
  return 'miss';
}

/**
 * 推进一帧。
 * @param {object} play
 * @param {number} dt
 * @param {boolean} rodsStill 签子是否基本没动
 */
export function stepPlay(play, dt, rodsStill) {
  play.timer += dt;
  play.shake = Math.max(0, play.shake - dt * 2.4);
  play.revealFlash = Math.max(0, play.revealFlash - dt * 2);

  for (const w of play.walkers) stepWalker(w, dt);

  if (play.phase === 'enter') {
    // 等人走进幕内再交控制权
    if (play.timer > 0.9) {
      play.phase = 'watch';
      play.message = '攥住签子别动 —— 看她是人是骨';
    }
    return;
  }

  if (play.phase === 'watch') {
    stepEye(play, dt, rodsStill);

    // 白骨精走出幕外算逃了
    const demon = demonOf(play);
    if (demon && (demon.x < -110 || demon.x > STAGE_W + 110)) {
      demon.exiting = true;
      play.message = '她走了 —— 这一回没抓住';
      play.phase = 'spell'; // 借用间歇，但不念咒
      play.monk.chanting = false;
      play.timer = 0;
    }
    return;
  }

  if (play.phase === 'spell') {
    A.eyeHum(0);
    play.eyeLevel = Math.max(0, play.eyeLevel - dt * 2);
    if (play.timer > 2.6) {
      play.monk.chanting = false;
      if (play.hits >= 3) {
        play.phase = 'exile';
        play.timer = 0;
        play.message = '三打已毕 —— 唐僧写下贬书';
        A.cueExile();
        return;
      }
      // 回合就等于已打中的次数：打中了自然进下一回，
      // 让她溜了 hits 没变，同一回重来。
      play.round = play.hits;
      startRound(play);
    }
    return;
  }

  if (play.phase === 'failed') {
    A.eyeHum(0);
    if (play.timer > 3) {
      play.phase = 'done';
      play.message = '这一折演砸了 —— 悟空被赶回花果山';
    }
    return;
  }

  if (play.phase === 'exile') {
    A.eyeHum(0);
    if (play.timer > 3.2) {
      play.phase = 'done';
      play.message = '你全做对了，还是被赶走了';
    }
  }
}

/**
 * 火眼金睛的蓄放。升得慢、散得更慢——散得慢是故意的，
 * 不然看破的那一瞬还没等你挥棒就没了。
 */
function stepEye(play, dt, rodsStill) {
  const cfg = ROUNDS[play.round];
  const demon = demonOf(play);

  if (rodsStill) {
    play.stillTime += dt;
    // 前 0.2 秒不算，避免手一顿就开始聚
    if (play.stillTime > 0.2) {
      const before = play.eyeLevel;
      play.eyeLevel = Math.min(1, play.eyeLevel + dt * cfg.chargeRate);
      if (before === 0) play.message = '握稳别动 —— 骨相要透出来了';
      if (before < 0.6 && play.eyeLevel >= 0.6) {
        A.cueReveal();
        play.revealFlash = 1;
        play.message = '看破了 —— 白骨就在她皮下';
      }
    }
  } else {
    play.stillTime = 0;
    play.eyeLevel = Math.max(0, play.eyeLevel - dt * 0.55);
  }

  A.eyeHum(play.eyeLevel);
  // 只有白骨精会透，村民无论怎么看都是人
  for (const w of play.walkers) {
    if (w.isBone) w.revealLevel = play.eyeLevel;
  }
}

export { GROUND_Y, STAGE_W };
