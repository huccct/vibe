const sheet = new Image();
// 相对本模块解析，不受文档位置影响（img.src 默认按文档 URL 算，会踩坑）
sheet.src = new URL('../public/assets/wukong-parts.png', import.meta.url).href;

const crops = {
  head: [25, 40, 600, 480],
  torso: [660, 35, 290, 505],
  upperArm: [1015, 105, 230, 430],
  foreArm: [75, 625, 500, 250],
  thigh: [600, 580, 390, 375],
  shin: [1060, 565, 275, 365],
};

export const wukongSpritesReady = () => sheet.complete && sheet.naturalWidth > 0;

function image(ctx, crop, x, y, w, h) {
  ctx.drawImage(sheet, ...crop, x, y, w, h);
}

/**
 * 六张真皮分件接到现有骨架。头身原图竖放，四肢按关节轴横放。
 * @returns {boolean} 图片尚未载入时返回 false，让渲染层画旧轮廓兜底。
 */
export function drawWukongSprite(ctx, name) {
  if (!wukongSpritesReady()) return false;

  if (name === 'head') {
    ctx.rotate(Math.PI / 2);
    image(ctx, crops.head, -130, -112, 196, 160);
    return true;
  }
  if (name === 'torso') {
    ctx.rotate(Math.PI / 2);
    image(ctx, crops.torso, -30, -166, 124, 185);
    return true;
  }
  if (name.includes('UpperArm')) {
    ctx.rotate(-Math.PI / 2 + 0.26);
    image(ctx, crops.upperArm, -19, -15, 60, 96);
    return true;
  }
  if (name.includes('ForeArm')) {
    image(ctx, crops.foreArm, -12, -21, 112, 55);
    return true;
  }
  if (name.includes('Thigh')) {
    ctx.rotate(-0.36);
    image(ctx, crops.thigh, -28, -31, 152, 134);
    return true;
  }

  ctx.rotate(-Math.PI / 2);
  image(ctx, crops.shin, -18, -18, 70, 118);
  return true;
}
