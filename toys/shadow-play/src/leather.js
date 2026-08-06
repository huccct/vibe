/**
 * 皮子怎么画 —— 全场只有这一套刻法。
 * 悟空、白骨精、村民、唐僧都从这里出图，
 * 所以不会出现"一半是皮影一半是简笔画"的分裂。
 *
 * 三步：填轮廓 → 挖镂空 → 刻线。挖和刻都是 destination-out，
 * 光是真的透过去的，不是画一道浅色假装。
 */

/** @typedef {import('./geometry.js').Pt} Pt */
/** @typedef {import('./geometry.js').Piece} Piece */

export const LEATHER = '58, 26, 10';
export const DARK_INK = '42, 16, 12';

/**
 * Catmull-Rom 转贝塞尔：曲线穿过每个点，点之间自然弯。
 * 鼻尖、靴头这种尖角不会被磨平。
 * @param {CanvasRenderingContext2D} ctx @param {Pt[]} pts @param {boolean} closed
 */
export function curve(ctx, pts, closed, k = 0.8) {
  const n = pts.length;
  if (n < 2) return;
  const at = (i) => (closed ? pts[((i % n) + n) % n] : pts[Math.min(n - 1, Math.max(0, i))]);

  ctx.moveTo(pts[0][0], pts[0][1]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    ctx.bezierCurveTo(
      p1[0] + ((p2[0] - p0[0]) * k) / 6,
      p1[1] + ((p2[1] - p0[1]) * k) / 6,
      p2[0] - ((p3[0] - p1[0]) * k) / 6,
      p2[1] - ((p3[1] - p1[1]) * k) / 6,
      p2[0],
      p2[1],
    );
  }
  if (closed) ctx.closePath();
}

/** 挖一组孔。调用方负责 alpha 和 save/restore。 */
function punchAll(ctx, shapes, k = 1) {
  ctx.globalCompositeOperation = 'destination-out';
  for (const s of shapes) {
    ctx.beginPath();
    curve(ctx, s, true, k);
    ctx.fill();
  }
}

/**
 * 画一块皮子。
 * @param {CanvasRenderingContext2D} ctx
 * @param {Piece} piece
 * @param {number} alpha
 * @param {number} [reveal] 0..1 —— 挖开 piece.bones，白骨从孔里透出来
 * @param {string} [tint] 透皮染色，格式为 "r, g, b"
 */
export function drawPiece(ctx, piece, alpha, reveal = 0, tint = LEATHER) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(${tint}, ${alpha})`;
  ctx.beginPath();
  curve(ctx, piece.outline, true);
  ctx.fill();
  ctx.strokeStyle = `rgba(${DARK_INK}, ${Math.min(1, alpha + 0.12)})`;
  ctx.lineWidth = 2.4;
  ctx.stroke();

  punchAll(ctx, piece.holes);

  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(${DARK_INK}, ${Math.min(1, alpha + 0.08)})`;
  for (const cut of piece.cuts) {
    ctx.beginPath();
    curve(ctx, cut, false);
    ctx.stroke();
  }

  // 看破：在已经画好的皮子上把骨头挖穿，越蓄越透。
  // 这是皮影自己的语法 —— 不另叠一层骨架图。
  if (reveal > 0.01 && piece.bones) {
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * reveal;
    punchAll(ctx, piece.bones);
    ctx.globalAlpha = a;
  }

  ctx.globalCompositeOperation = 'source-over';
}
