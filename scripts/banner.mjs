/**
 * 用仓库自己的 noise.js 生成一张 flow field banner（SVG）。
 * 固定 seed，所以每次跑出来都一样 —— 改了想重新生成就换 SEED。
 *
 *   node scripts/banner.mjs
 */
import { writeFileSync } from 'fs';
import { makeNoise2D, fbm } from '../src/shared/noise.js';

const W = 1280;
const H = 400;
const SEED = 20260806;

const LINES = 340; // 流线条数
const STEPS = 120; // 每条最多走几步
const STEP = 7; // 步长（px），大一点＝顶点少＝文件小
const SCALE = 0.0022; // 噪声缩放，越小越舒展

// 三个 toy 的主题色
const COLORS = ['#7cf6ff', '#9dff3c', '#ff5ea8'];

const noise = fbm(makeNoise2D(SEED), 4);
const rand = (() => {
  let a = SEED >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();

const paths = [];

for (let i = 0; i < LINES; i++) {
  // 从左侧偏多的地方起笔，让流线有从左往右铺开的感觉
  let x = rand() * W * 1.15 - W * 0.1;
  let y = rand() * H;
  const y0 = y; // 配色按起点算：终点会被流场推到一块儿去，分不出层

  const pts = [[x, y]];
  for (let s = 0; s < STEPS; s++) {
    const a = noise(x * SCALE, y * SCALE) * Math.PI * 2.4;
    x += Math.cos(a) * STEP;
    y += Math.sin(a) * STEP;
    if (x < -20 || x > W + 20 || y < -20 || y > H + 20) break;
    pts.push([x, y]);
  }
  if (pts.length < 5) continue; // 太短的是噪点；阈值放低，否则右侧会空一片

  // 起点的竖直位置决定配色，带一点抖动让三色交界处混起来
  const band = (y0 / H) * COLORS.length + (rand() - 0.5) * 0.9;
  const color = COLORS[Math.max(0, Math.min(COLORS.length - 1, Math.floor(band)))];
  const opacity = (0.16 + rand() * 0.42).toFixed(3);
  const width = (0.5 + rand() * 1.1).toFixed(2);

  const d = pts.map(([px, py], k) => `${k ? 'L' : 'M'}${Math.round(px)} ${Math.round(py)}`).join(' ');
  paths.push(`<path d="${d}" stroke="${color}" stroke-width="${width}" opacity="${opacity}"/>`);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="vibe — a playground of small web toys">
  <defs>
    <linearGradient id="scrim" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#08090c" stop-opacity="0.92"/>
      <stop offset="1" stop-color="#08090c" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#08090c"/>
  <g fill="none" stroke-linecap="round">
    ${paths.join('\n    ')}
  </g>
  <rect y="${H - 170}" width="${W}" height="170" fill="url(#scrim)"/>
  <text x="48" y="${H - 74}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="64" font-weight="600" fill="#e6e8ee">vibe</text>
  <text x="48" y="${H - 42}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="17" fill="#8b90a0">a playground of small web toys</text>
</svg>
`;

writeFileSync(new URL('../assets/banner.svg', import.meta.url), svg);
console.log(`assets/banner.svg — ${paths.length} 条流线`);
