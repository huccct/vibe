export const MAX_CHARS = 8;

export function normalizePhrase(value, fallback = '春风得意') {
  const clean = String(value ?? '').normalize('NFC').replace(/\s+/g, '');
  return Array.from(clean || fallback).slice(0, MAX_CHARS).join('');
}

/** 活字从右往左反排，压到纸上才恢复正常阅读顺序。 */
export function layoutBlocks(phrase, bed) {
  const chars = Array.from(normalizePhrase(phrase));
  const gap = Math.max(6, Math.min(14, bed.width * 0.014));
  const size = Math.min(92, (bed.width - gap * (chars.length - 1)) / Math.max(chars.length, 1));
  const total = chars.length * size + (chars.length - 1) * gap;
  const start = bed.x + (bed.width - total) / 2;
  return chars.reverse().map((char, index) => ({
    char,
    x: start + index * (size + gap),
    y: bed.y + (bed.height - size) / 2,
    size,
    coverage: 0,
  }));
}

const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/**
 * 一小段滚筒位移给经过的字面加墨。传入旧数组，返回新数组，方便独立测试。
 */
export function inkPass(blocks, fromX, toX, rollerWidth, ink = 1) {
  const left = Math.min(fromX, toX) - rollerWidth / 2;
  const right = Math.max(fromX, toX) + rollerWidth / 2;
  const travelLeft = Math.min(fromX, toX);
  const travelRight = Math.max(fromX, toX);
  return blocks.map((block) => {
    const touched = overlap(left, right, block.x, block.x + block.size) / block.size;
    if (!touched) return { ...block };
    const contact = overlap(
      travelLeft,
      travelRight,
      block.x - rollerWidth / 2,
      block.x + block.size + rollerWidth / 2,
    );
    const laid = (contact / 650 + 0.004 * touched) * Math.max(0, ink);
    return { ...block, coverage: Math.min(1.28, block.coverage + laid) };
  });
}

export function impressionQuality(coverage, pressure) {
  const ink = Math.max(0, Math.min(1, coverage));
  const press = Math.max(0, Math.min(1, (pressure - 0.12) / 0.78));
  return ink * press;
}

export function averageQuality(blocks, pressure) {
  if (!blocks.length) return 0;
  return blocks.reduce((sum, block) => sum + impressionQuality(block.coverage, pressure), 0) / blocks.length;
}

/** 把手艺与一点运气组合成一张可收藏的试印判词。 */
export function editionOutcome(score, overInk, seed) {
  const random = seeded(seed);
  const luck = random();
  const event = random();
  let rarity = '残卷';
  let tier = 'common';

  if (luck > 0.975) {
    rarity = '镇馆之宝';
    tier = 'legendary';
  } else if (score > 0.74 && luck > 0.64) {
    rarity = '孤本';
    tier = 'rare';
  } else if (score > 0.48 || luck > 0.48) {
    rarity = '佳印';
    tier = 'fine';
  }

  if (overInk) return { rarity, tier, accident: '墨海漫金', stamp: '墨多胆大', effect: 'bleed' };
  if (score < 0.28) return { rarity, tier, accident: '飞白成霜', stamp: '手艺欠佳', effect: 'missing' };
  if (event < 0.22) return { rarity, tier, accident: '纸动半分', stamp: '重影亦真', effect: 'ghost' };
  if (event < 0.44) return { rarity, tier, accident: '版心微斜', stamp: '歪得有理', effect: 'crooked' };
  if (event < 0.62) return { rarity, tier, accident: '一笔走墨', stamp: '墨迹可寻', effect: 'streak' };
  return { rarity, tier, accident: '字口清健', stamp: '此页不传', effect: 'clean' };
}

/** 可复现的 0..1 随机数，印刷缺口不会在动画每一帧乱跳。 */
export function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
