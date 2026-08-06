/**
 * 景片。真皮影的景片贴幕没有影人那么紧，所以更淡、更虚——
 * 这是白捡的纵深，用 alpha 和 blur 直接照抄这个物理事实。
 *
 * 老戏班景片贵在少：一树一石已经交代地点，不能画成动画背景。
 */

const LEATHER = '58, 26, 10';
const lc = (a) => `rgba(${LEATHER},${a})`;

/** 远山：几道折线剪影，最淡最虚。 */
function drawMountains(ctx, w, h) {
  ctx.fillStyle = lc(0.3);
  ctx.beginPath();
  ctx.moveTo(0, h * 0.52);
  const peaks = [
    [0.08, 0.44], [0.16, 0.49], [0.27, 0.38], [0.38, 0.47],
    [0.5, 0.35], [0.62, 0.45], [0.74, 0.4], [0.87, 0.48], [1, 0.42],
  ];
  for (const [px, py] of peaks) ctx.lineTo(w * px, h * py);
  ctx.lineTo(w, h * 0.62);
  ctx.lineTo(0, h * 0.62);
  ctx.closePath();
  ctx.fill();

  // 近一层山，深一点
  ctx.fillStyle = lc(0.42);
  ctx.beginPath();
  ctx.moveTo(0, h * 0.6);
  for (const [px, py] of [[0.12, 0.55], [0.3, 0.59], [0.46, 0.52], [0.66, 0.58], [0.85, 0.54], [1, 0.58]]) {
    ctx.lineTo(w * px, h * py);
  }
  ctx.lineTo(w, h * 0.68);
  ctx.lineTo(0, h * 0.68);
  ctx.closePath();
  ctx.fill();
}

/** 枯松：白骨山上那棵，枝子朝一边斜。 */
function drawPine(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = lc(0.62);
  ctx.lineCap = 'round';

  // 主干，略弯
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-6, -60, 8, -110, 2, -170);
  ctx.stroke();

  // 枝：朝右斜，末端分叉
  const branch = (y0, len, up, wid) => {
    ctx.lineWidth = wid;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.quadraticCurveTo(len * 0.5, y0 - up * 0.4, len, y0 - up);
    ctx.stroke();
    // 末梢两根小杈
    ctx.lineWidth = wid * 0.55;
    ctx.beginPath();
    ctx.moveTo(len, y0 - up);
    ctx.lineTo(len + 16, y0 - up - 12);
    ctx.moveTo(len, y0 - up);
    ctx.lineTo(len + 14, y0 - up + 8);
    ctx.stroke();
  };
  branch(-58, 62, 26, 6.5);
  branch(-104, -52, 20, 5.5);
  branch(-140, 44, 22, 4.6);
  ctx.restore();
}

/** 乱石：地面几块，压住画面下沿。 */
function drawRocks(ctx, w, groundY) {
  ctx.fillStyle = lc(0.5);
  const rocks = [
    [0.06, 26, 16], [0.19, 15, 10], [0.78, 30, 18], [0.92, 20, 12], [0.44, 12, 8],
  ];
  for (const [px, rw, rh] of rocks) {
    const x = w * px;
    ctx.beginPath();
    ctx.moveTo(x - rw, groundY);
    ctx.lineTo(x - rw * 0.5, groundY - rh);
    ctx.lineTo(x + rw * 0.3, groundY - rh * 0.8);
    ctx.lineTo(x + rw, groundY);
    ctx.closePath();
    ctx.fill();
  }
}

/** 云：飘的，慢。 */
function drawClouds(ctx, w, h, t) {
  ctx.fillStyle = lc(0.22);
  const puffs = [
    [0.2, 0.16, 1], [0.62, 0.12, 0.8], [0.85, 0.2, 0.6],
  ];
  for (const [px, py, s] of puffs) {
    // 云头是皮影里的如意纹，一串圆弧
    const drift = ((t * 6 * s) % (w + 300)) - 150;
    const x = w * px + drift * 0.3;
    const y = h * py;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      ctx.arc(i * 26 - 39, Math.sin(i * 1.4) * 5, 17 - Math.abs(i - 1.5) * 3, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  }
}

/**
 * 画整套景片到给定上下文（应该是景片专用的离屏层）。
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w @param {number} h @param {number} t
 * @param {number} groundY 地平线
 */
export function drawScenery(ctx, w, h, t, groundY) {
  // 一棵贴边枯松、三块压脚石，给中间的影人留足台口。
  drawPine(ctx, w * 0.91, groundY + 2, 0.76);
  ctx.fillStyle = lc(0.42);
  for (const [x, rw, rh] of [[52, 30, 14], [88, 16, 8], [1028, 24, 12]]) {
    ctx.beginPath();
    ctx.moveTo(x - rw, groundY);
    ctx.lineTo(x - rw * 0.45, groundY - rh);
    ctx.lineTo(x + rw * 0.35, groundY - rh * 0.7);
    ctx.lineTo(x + rw, groundY);
    ctx.closePath();
    ctx.fill();
  }

  // 影窗下沿就是台口，不画透视地面。
  ctx.strokeStyle = lc(0.34);
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(0, groundY + 2);
  ctx.lineTo(w, groundY + 2);
  ctx.stroke();
}
