/**
 * 手写 GIF89a 编码器。出网被墙装不了 gifenc，就自己写一个。
 * 规格参考 GIF89a spec：header → 全局色表 → Netscape 循环扩展
 * → 每帧（图形控制扩展 + 图像描述符 + LZW 数据）→ trailer。
 */

/** 可增长的字节缓冲。 */
class ByteBuffer {
  constructor(cap = 1 << 16) {
    this.buf = new Uint8Array(cap);
    this.len = 0;
  }

  _ensure(n) {
    if (this.len + n <= this.buf.length) return;
    let cap = this.buf.length * 2;
    while (cap < this.len + n) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }

  byte(v) {
    this._ensure(1);
    this.buf[this.len++] = v & 0xff;
  }

  /** GIF 里的多字节整数都是小端。 */
  short(v) {
    this.byte(v);
    this.byte(v >> 8);
  }

  bytes(arr) {
    this._ensure(arr.length);
    this.buf.set(arr, this.len);
    this.len += arr.length;
  }

  ascii(s) {
    for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i));
  }

  view() {
    return this.buf.subarray(0, this.len);
  }
}

/**
 * LZW 压缩（GIF 变体）。码长从 minCodeSize+1 起，
 * 字典满 4096 就发 clear code 重来。位序是低位先出。
 * @param {Uint8Array} indices 每像素一个色表索引
 * @param {number} minCodeSize
 * @returns {Uint8Array} 未分块的原始 LZW 流
 */
function lzwCompress(indices, minCodeSize) {
  const out = new ByteBuffer(indices.length);
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;

  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  /** key = prefix * 4096 + pixel，避免字符串拼 key 的开销 */
  let dict = new Map();

  let acc = 0;
  let accBits = 0;
  const emit = (code) => {
    acc |= code << accBits;
    accBits += codeSize;
    while (accBits >= 8) {
      out.byte(acc);
      acc >>= 8;
      accBits -= 8;
    }
  };

  emit(clearCode);

  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = prefix * 4096 + k;
    const found = dict.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    emit(prefix);
    if (nextCode < 4096) {
      dict.set(key, nextCode++);
      // 码长在字典跨过 2^codeSize 时增加
      if (nextCode > 1 << codeSize && codeSize < 12) codeSize++;
    } else {
      emit(clearCode);
      dict = new Map();
      codeSize = minCodeSize + 1;
      nextCode = eoiCode + 1;
    }
    prefix = k;
  }

  emit(prefix);
  emit(eoiCode);
  if (accBits > 0) out.byte(acc);
  return out.view();
}

/** LZW 流切成 ≤255 字节的子块，每块前一个长度字节，0 收尾。 */
function writeSubBlocks(buf, data) {
  for (let i = 0; i < data.length; i += 255) {
    const chunk = data.subarray(i, Math.min(i + 255, data.length));
    buf.byte(chunk.length);
    buf.bytes(chunk);
  }
  buf.byte(0);
}

/** 透明索引。帧间差分要用它标"这个像素没变"，所以色板只能占 0..254。 */
export const TRANSPARENT = 255;

/**
 * 取色板。本场景色域很窄（暖黄布幕 + 深褐皮子），
 * 5 bit/通道量化后按出现频次取前 255 色就够，不用上 median-cut。
 * @param {Uint8ClampedArray} rgba
 * @returns {{ palette: Uint8Array, lookup: Map<number, number> }}
 */
export function buildPalette(rgba) {
  const counts = new Map();
  for (let i = 0; i < rgba.length; i += 4) {
    // >>3 是 5 bit 量化
    const key = ((rgba[i] >> 3) << 10) | ((rgba[i + 1] >> 3) << 5) | (rgba[i + 2] >> 3);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 255)
    .map(([key]) => key);

  const palette = new Uint8Array(256 * 3);
  const lookup = new Map();
  top.forEach((key, i) => {
    // 量化回中心值，避免整体偏暗
    const r = (((key >> 10) & 31) << 3) | 4;
    const g = (((key >> 5) & 31) << 3) | 4;
    const b = ((key & 31) << 3) | 4;
    palette[i * 3] = r;
    palette[i * 3 + 1] = g;
    palette[i * 3 + 2] = b;
    lookup.set(key, i);
  });

  return { palette, lookup, size: top.length };
}

/**
 * 像素映射到色表索引。量化键先查缓存，miss 了才找最近色。
 * @param {Uint8ClampedArray} rgba
 * @param {{ palette: Uint8Array, lookup: Map<number, number>, size: number }} pal
 * @returns {Uint8Array}
 */
export function applyPalette(rgba, pal) {
  const n = rgba.length / 4;
  const out = new Uint8Array(n);
  const { palette, lookup, size } = pal;

  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

    let idx = lookup.get(key);
    if (idx === undefined) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < size; c++) {
        const dr = r - palette[c * 3];
        const dg = g - palette[c * 3 + 1];
        const db = b - palette[c * 3 + 2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      idx = best;
      lookup.set(key, idx);
    }
    out[i] = idx;
  }
  return out;
}

/** 增量写 GIF。writeFrame 传已经映射好的索引数据。 */
export class GifWriter {
  /**
   * @param {number} w @param {number} h
   * @param {Uint8Array} palette 256*3 字节
   */
  constructor(w, h, palette) {
    this.w = w;
    this.h = h;
    this.buf = new ByteBuffer(1 << 20);
    /** @type {Uint8Array | null} 上一帧的完整索引，用来做差分 */
    this.prev = null;

    this.buf.ascii('GIF89a');
    this.buf.short(w);
    this.buf.short(h);
    // 全局色表标志(1) | 色深(3) | 排序(1) | 表大小(3)：256 色 → 7
    this.buf.byte(0xf7);
    this.buf.byte(0); // 背景色索引
    this.buf.byte(0); // 像素宽高比
    this.buf.bytes(palette);

    // Netscape 2.0 扩展：无限循环
    this.buf.bytes([0x21, 0xff, 0x0b]);
    this.buf.ascii('NETSCAPE2.0');
    this.buf.bytes([0x03, 0x01, 0x00, 0x00, 0x00]);
  }

  /**
   * 只写相对上一帧变化的部分：未变的像素填透明索引，
   * 并把图像描述符裁到变化区域的包围盒。布幕是静止的，
   * 全帧重编码的话 100 帧里有九成是同一片背景抄来抄去。
   * @param {Uint8Array} indices
   * @param {number} delayMs
   */
  writeFrame(indices, delayMs) {
    const { w, h, prev } = this;
    let x0 = 0;
    let y0 = 0;
    let fw = w;
    let fh = h;
    /** @type {Uint8Array} */
    let payload = indices;

    if (prev) {
      let minX = w;
      let minY = h;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
          if (indices[row + x] !== prev[row + x]) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (maxX < 0) {
        // 这帧和上一帧一模一样。仍要写一帧来占住时长，
        // 写个 1×1 的全透明就够，解码器会保留上一帧画面。
        x0 = 0;
        y0 = 0;
        fw = 1;
        fh = 1;
        payload = new Uint8Array([TRANSPARENT]);
      } else {
        x0 = minX;
        y0 = minY;
        fw = maxX - minX + 1;
        fh = maxY - minY + 1;
        payload = new Uint8Array(fw * fh);
        for (let y = 0; y < fh; y++) {
          const src = (y + y0) * w + x0;
          const dst = y * fw;
          for (let x = 0; x < fw; x++) {
            const v = indices[src + x];
            payload[dst + x] = v === prev[src + x] ? TRANSPARENT : v;
          }
        }
      }
    }

    // 图形控制扩展。packed = disposal 1（留住上一帧）| 透明色标志
    this.buf.bytes([0x21, 0xf9, 0x04, prev ? 0x05 : 0x04]);
    this.buf.short(Math.round(delayMs / 10)); // 单位是 1/100 秒
    this.buf.byte(TRANSPARENT);
    this.buf.byte(0); // 块结束

    // 图像描述符
    this.buf.byte(0x2c);
    this.buf.short(x0);
    this.buf.short(y0);
    this.buf.short(fw);
    this.buf.short(fh);
    this.buf.byte(0); // 无局部色表，非交错

    const minCodeSize = 8;
    this.buf.byte(minCodeSize);
    writeSubBlocks(this.buf, lzwCompress(payload, minCodeSize));

    this.prev = indices.slice();
  }

  finish() {
    this.buf.byte(0x3b);
    return new Blob([this.buf.view()], { type: 'image/gif' });
  }
}
