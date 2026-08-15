import { averageQuality, editionOutcome, impressionQuality, inkPass, layoutBlocks, normalizePhrase, seeded } from './printing.js';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('press'));
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('这个浏览器不支持 canvas 2d');

const form = document.getElementById('composer');
const phraseInput = /** @type {HTMLInputElement} */ (document.getElementById('phrase'));
const surpriseBtn = document.getElementById('surprise');
const reinkBtn = document.getElementById('reink');
const downloadBtn = document.getElementById('download');
const muteBtn = document.getElementById('mute');
const statusEl = document.getElementById('status');
const qualityEl = document.getElementById('quality');
const verdictEl = document.getElementById('verdict');
const editionNoEl = document.getElementById('edition-no');
const rarityEl = document.getElementById('rarity');
const accidentEl = document.getElementById('accident');
const stampEl = document.getElementById('stamp');
const collectionCountEl = document.getElementById('collection-count');

const W = canvas.width;
const H = canvas.height;
const BED = { x: 132, y: 125, width: 790, height: 260 };
const PAPER = { x: 174, y: 448, width: 760, height: 230 };
const LEVER = { x: 1042, top: 168, length: 282 };
const PRESETS = ['春风得意', '但行好事', '平安喜乐', '自在如风', '山高水长', '万事胜意'];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let phrase = normalizePhrase(phraseInput.value);
let blocks = layoutBlocks(phrase, BED);
let roller = { x: BED.x + 35, y: BED.y + BED.height / 2, ink: 1 };
let leverPressure = 0;
let leverPeak = 0;
let dragMode = null;
let dragOffsetX = 0;
let paperReveal = 0;
let printCanvas = null;
let printSeed = 1;
let presetIndex = 0;
let muted = false;
let currentOutcome = null;
let collectionCount = readCollectionCount();

function readCollectionCount() {
  try { return Number(localStorage.getItem('movable-type-collection')) || 0; }
  catch { return 0; }
}

function saveCollectionCount() {
  try { localStorage.setItem('movable-type-collection', String(collectionCount)); }
  catch { /* 私密模式下仍可继续印刷。 */ }
}

function updateCollectionLabel() {
  collectionCountEl.textContent = collectionCount ? `已入藏 ${collectionCount} 张` : '尚未入藏';
}

const woodNoise = Array.from({ length: 58 }, (_, index) => ({
  x: (index * 137.3) % W,
  y: 40 + ((index * 83.7) % (H - 80)),
  len: 30 + (index * 29) % 150,
  alpha: 0.018 + (index % 4) * 0.007,
}));

let audio = null;
function initAudio() {
  if (audio) return;
  const AC = window.AudioContext ?? window.webkitAudioContext;
  if (AC) audio = new AC();
}

function tone(freq, duration, gain = 0.08, type = 'sine', at = 0) {
  if (!audio || muted) return;
  const start = audio.currentTime + at;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp).connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration);
}

function typeClack() {
  Array.from(phrase).forEach((_, index) => tone(540 - index * 23, 0.045, 0.035, 'square', index * 0.035));
  tone(120, 0.12, 0.08, 'triangle', Array.from(phrase).length * 0.035);
}

function pressThump() {
  tone(78, 0.32, 0.22, 'sine');
  tone(132, 0.18, 0.12, 'triangle', 0.018);
  tone(930, 0.06, 0.035, 'square', 0.13);
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function compose(value) {
  phrase = normalizePhrase(value);
  phraseInput.value = phrase;
  blocks = layoutBlocks(phrase, BED);
  roller = { x: BED.x + 35, y: BED.y + BED.height / 2, ink: 1 };
  leverPressure = 0;
  leverPeak = 0;
  paperReveal = 0;
  printCanvas = null;
  currentOutcome = null;
  verdictEl.hidden = true;
  downloadBtn.disabled = true;
  statusEl.textContent = '字已反排入框 —— 拖住滚筒，在字面上来回滚';
  updateQuality();
  typeClack();
}

function inkDescription() {
  const amount = blocks.reduce((sum, block) => sum + block.coverage, 0) / Math.max(1, blocks.length);
  if (amount < 0.08) return '未上墨';
  if (amount < 0.3) return '太薄';
  if (amount < 0.58) return '斑驳';
  if (amount < 1.02) return '正好';
  return '偏厚';
}

function updateQuality() {
  qualityEl.textContent = `墨色：${inkDescription()} · 滚筒 ${Math.round(roller.ink * 100)}%`;
}

function glyphPrint(char, block, pressure, seedValue) {
  const size = 142;
  const glyph = document.createElement('canvas');
  glyph.width = size;
  glyph.height = size;
  const g = glyph.getContext('2d', { willReadFrequently: true });
  if (!g) return glyph;
  const quality = impressionQuality(block.coverage, pressure);
  const random = seeded(seedValue);

  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `900 112px "Songti SC", "SimSun", serif`;
  g.fillStyle = `rgba(24, 21, 18, ${0.2 + quality * 0.8})`;
  g.fillText(char, size / 2, size / 2 + 4);

  // 缺墨形成成片的小孔，不做均匀的数字噪点。
  g.globalCompositeOperation = 'destination-out';
  const holes = Math.round((1 - quality) * 34 + 2);
  for (let i = 0; i < holes; i++) {
    const x = 18 + random() * (size - 36);
    const y = 15 + random() * (size - 30);
    const r = 1.5 + random() * (2 + (1 - quality) * 8);
    g.globalAlpha = 0.45 + random() * 0.5;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';

  // 墨太厚会在受力方向上轻微洇开。
  if (block.coverage > 1.02) {
    g.globalAlpha = Math.min(0.2, (block.coverage - 1) * 0.35);
    g.filter = 'blur(2.4px)';
    g.fillStyle = '#171411';
    g.fillText(char, size / 2 + 2, size / 2 + 5);
  }
  return glyph;
}

function makePrint(pressure) {
  const paper = document.createElement('canvas');
  paper.width = PAPER.width;
  paper.height = PAPER.height;
  const p = paper.getContext('2d');
  if (!p) return;
  const seedValue = (printSeed++ * 2654435761) ^ Array.from(phrase).reduce((sum, char) => sum + char.codePointAt(0), 0);
  const random = seeded(seedValue);
  const score = averageQuality(blocks, pressure);
  const overInk = blocks.some((block) => block.coverage > 1.08);
  currentOutcome = editionOutcome(score, overInk, seedValue);
  collectionCount += 1;
  saveCollectionCount();
  updateCollectionLabel();

  p.fillStyle = '#eee2c7';
  p.fillRect(0, 0, paper.width, paper.height);
  for (let i = 0; i < 900; i++) {
    const shade = random() > 0.5 ? 75 : 255;
    p.fillStyle = `rgba(${shade}, ${shade * 0.9}, ${shade * 0.72}, ${0.012 + random() * 0.025})`;
    p.fillRect(random() * paper.width, random() * paper.height, 0.5 + random() * 1.5, 0.5 + random());
  }

  const inReadingOrder = blocks.slice().reverse();
  const gap = Math.min(108, 590 / Math.max(1, inReadingOrder.length));
  const total = gap * inReadingOrder.length;
  const start = (paper.width - total) / 2 + gap / 2;
  p.save();
  if (currentOutcome.effect === 'crooked') {
    p.translate(paper.width / 2, paper.height / 2);
    p.rotate(-0.018);
    p.translate(-paper.width / 2, -paper.height / 2);
  }
  inReadingOrder.forEach((block, index) => {
    const glyph = glyphPrint(block.char, block, pressure, printSeed * 97 + index * 131);
    const drawSize = Math.min(132, gap * 1.24);
    const x = start + index * gap - drawSize / 2;
    if (currentOutcome.effect === 'ghost') {
      p.globalAlpha = 0.2;
      p.drawImage(glyph, x + 5, 42, drawSize, drawSize);
      p.globalAlpha = 1;
    }
    p.drawImage(glyph, x, 38, drawSize, drawSize);
  });
  p.restore();

  if (currentOutcome.effect === 'streak') {
    p.save();
    p.strokeStyle = 'rgba(25, 22, 18, .42)';
    p.lineWidth = 2 + random() * 3;
    p.beginPath();
    p.moveTo(58, 172 + random() * 12);
    p.bezierCurveTo(210, 164, 430, 190, 645, 170);
    p.stroke();
    p.restore();
  }

  p.fillStyle = 'rgba(55, 48, 39, .48)';
  p.font = '10px "SFMono-Regular", monospace';
  p.textAlign = 'left';
  p.fillText(`PROOF ${String(collectionCount).padStart(3, '0')} / ${currentOutcome.rarity}`, 24, paper.height - 21);

  p.save();
  p.translate(28, 34);
  p.fillStyle = 'rgba(164, 59, 41, .68)';
  p.font = '12px "Songti SC", serif';
  p.textAlign = 'center';
  Array.from(currentOutcome.accident).forEach((char, index) => p.fillText(char, 0, index * 15));
  p.restore();

  p.save();
  p.translate(paper.width - 74, paper.height - 52);
  p.rotate((random() - 0.5) * 0.08);
  p.strokeStyle = 'rgba(166, 49, 32, 0.75)';
  p.lineWidth = 3;
  p.strokeRect(-25, -25, 50, 50);
  p.font = '700 13px "Songti SC", serif';
  p.textAlign = 'center';
  p.textBaseline = 'middle';
  p.fillStyle = 'rgba(166, 49, 32, 0.72)';
  const sealChars = Array.from(currentOutcome.stamp);
  p.fillText(sealChars.slice(0, 2).join(''), 0, -8);
  p.fillText(sealChars.slice(2, 4).join(''), 0, 9);
  p.restore();

  printCanvas = paper;
  paperReveal = 0;
  statusEl.textContent = score < 0.28
    ? '揭纸 —— 墨少或压力轻，像一页残卷'
    : overInk
      ? '揭纸 —— 墨有点厚，字口微微洇开了'
      : score < 0.7
        ? '揭纸 —— 斑驳得正像一张旧印'
        : `揭纸 —— ${currentOutcome.accident}，判作「${currentOutcome.rarity}」`;
  editionNoEl.textContent = `试印第 ${String(collectionCount).padStart(3, '0')} 张`;
  rarityEl.textContent = currentOutcome.rarity;
  accidentEl.textContent = currentOutcome.accident;
  stampEl.textContent = currentOutcome.stamp;
  verdictEl.dataset.tier = currentOutcome.tier;
  verdictEl.hidden = false;
  blocks = blocks.map((block) => ({ ...block, coverage: block.coverage * 0.42 }));
  downloadBtn.disabled = false;
  updateQuality();
  pressThump();
}

function drawTable() {
  const wood = ctx.createLinearGradient(0, 0, 0, H);
  wood.addColorStop(0, '#cfb07e');
  wood.addColorStop(0.52, '#c39d69');
  wood.addColorStop(1, '#b98d5b');
  ctx.fillStyle = wood;
  ctx.fillRect(0, 0, W, H);
  for (const line of woodNoise) {
    ctx.strokeStyle = `rgba(64, 43, 26, ${line.alpha * 1.7})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(line.x, line.y);
    ctx.bezierCurveTo(line.x + line.len * 0.35, line.y - 5, line.x + line.len * 0.7, line.y + 5, line.x + line.len, line.y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(63, 43, 27, .17)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 421);
  ctx.lineTo(W, 409);
  ctx.stroke();

  ctx.fillStyle = 'rgba(36, 31, 24, .7)';
  ctx.font = '10px "SFMono-Regular", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('PROOFING TABLE / No. 01', 38, 42);
  ctx.fillStyle = '#963624';
  ctx.fillRect(38, 54, 42, 3);
}

function drawBed() {
  ctx.save();
  ctx.shadowColor = 'rgba(43,32,21,.28)';
  ctx.shadowBlur = 7;
  ctx.shadowOffsetX = 7;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#262722';
  ctx.fillRect(BED.x - 25, BED.y - 25, BED.width + 50, BED.height + 50);
  ctx.restore();

  ctx.fillStyle = '#4a4a42';
  ctx.fillRect(BED.x - 16, BED.y - 16, BED.width + 32, BED.height + 32);
  ctx.strokeStyle = '#171814';
  ctx.lineWidth = 4;
  ctx.strokeRect(BED.x - 18, BED.y - 18, BED.width + 36, BED.height + 36);
  ctx.strokeStyle = 'rgba(243, 231, 205, .25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(BED.x - 11, BED.y - 11, BED.width + 22, BED.height + 22);
  ctx.fillStyle = '#24241f';
  ctx.fillRect(BED.x, BED.y, BED.width, BED.height);

  for (const block of blocks) drawBlock(block);

  ctx.fillStyle = '#392f24';
  ctx.font = '12px "Songti SC", serif';
  ctx.textAlign = 'left';
  ctx.fillText('壹 / 字面朝上，自右向左反排', BED.x - 1, BED.y - 41);
}

function drawBlock(block) {
  const { x, y, size, char, coverage } = block;
  const face = ctx.createLinearGradient(x, y, x + size, y + size);
  face.addColorStop(0, '#c99a5d');
  face.addColorStop(0.48, '#a76f38');
  face.addColorStop(1, '#80502b');
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.46)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = face;
  ctx.fillRect(x, y, size, size);
  ctx.restore();
  ctx.strokeStyle = 'rgba(250, 214, 151, .42)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 3, y + 3, size - 6, size - 6);

  ctx.save();
  ctx.translate(x + size / 2, y + size / 2 + size * 0.04);
  ctx.scale(-1, 1);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${size * 0.69}px "Songti SC", "SimSun", serif`;
  ctx.lineWidth = Math.max(2, size * 0.055);
  ctx.strokeStyle = 'rgba(45, 22, 12, 0.7)';
  ctx.strokeText(char, 0, 0);
  ctx.fillStyle = `rgba(18, 16, 14, ${Math.min(0.96, coverage * 0.88)})`;
  ctx.fillText(char, 0, 0);
  ctx.restore();

  if (coverage > 0.02) {
    ctx.fillStyle = `rgba(7, 7, 7, ${Math.min(0.22, coverage * 0.14)})`;
    ctx.fillRect(x + 5, y + 5, size - 10, size - 10);
  }
}

function drawRoller() {
  const x = roller.x;
  const y = roller.y;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.42)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 6;
  const body = ctx.createLinearGradient(x - 84, 0, x + 84, 0);
  body.addColorStop(0, '#11120f');
  body.addColorStop(0.14, '#3d3d36');
  body.addColorStop(0.5, roller.ink > 0.15 ? '#171814' : '#3b352e');
  body.addColorStop(0.86, '#090a08');
  body.addColorStop(1, '#292923');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(x - 86, y - 31, 172, 62, 25);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = '#494b45';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 65, y - 22);
  ctx.lineTo(x + 103, y - 78);
  ctx.stroke();
  ctx.strokeStyle = '#7f4f2d';
  ctx.lineWidth = 23;
  ctx.beginPath();
  ctx.moveTo(x + 103, y - 78);
  ctx.lineTo(x + 126, y - 112);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,.13)';
  ctx.fillRect(x - 59, y - 20, 70, 3);
}

function leverKnobY() {
  return LEVER.top + leverPressure * LEVER.length;
}

function drawPressAndLever() {
  ctx.save();
  ctx.shadowColor = 'rgba(47, 33, 20, .24)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 5;
  ctx.shadowOffsetY = 6;
  ctx.strokeStyle = '#343630';
  ctx.lineWidth = 32;
  ctx.lineCap = 'square';
  ctx.beginPath();
  ctx.moveTo(969, 108);
  ctx.lineTo(1088, 108);
  ctx.lineTo(1088, 495);
  ctx.stroke();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#171814';
  ctx.lineWidth = 3;
  ctx.strokeRect(952, 91, 153, 422);
  ctx.restore();

  ctx.strokeStyle = '#75766d';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(LEVER.x, LEVER.top);
  ctx.lineTo(LEVER.x, LEVER.top + LEVER.length);
  ctx.stroke();
  for (let i = 0; i <= 4; i++) {
    const y = LEVER.top + (LEVER.length / 4) * i;
    ctx.strokeStyle = 'rgba(239,225,197,.42)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(LEVER.x - 24, y);
    ctx.lineTo(LEVER.x + 24, y);
    ctx.stroke();
  }

  const knobY = leverKnobY();
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.32)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#a43b29';
  ctx.beginPath();
  ctx.arc(LEVER.x, knobY, 31, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#6f261d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(LEVER.x, knobY, 25, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#f0e5cd';
  ctx.font = '18px "Songti SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('压', LEVER.x, knobY + 1);

  ctx.fillStyle = '#392f24';
  ctx.font = '12px "Songti SC", serif';
  ctx.fillText('贰 / 向下压到底', LEVER.x, 540);
}

function drawOutputTray() {
  ctx.save();
  ctx.shadowColor = 'rgba(45,32,21,.25)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 6;
  ctx.shadowOffsetY = 7;
  ctx.fillStyle = '#4a4a42';
  ctx.fillRect(PAPER.x - 22, PAPER.y - 18, PAPER.width + 44, PAPER.height + 30);
  ctx.restore();
  ctx.strokeStyle = '#1b1c18';
  ctx.lineWidth = 3;
  ctx.strokeRect(PAPER.x - 16, PAPER.y - 12, PAPER.width + 32, PAPER.height + 20);

  if (!printCanvas) {
    ctx.fillStyle = '#eee3c9';
    ctx.fillRect(PAPER.x, PAPER.y, PAPER.width, PAPER.height);
    ctx.strokeStyle = 'rgba(70, 59, 44, .22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(PAPER.x + 9, PAPER.y + 9, PAPER.width - 18, PAPER.height - 18);
    ctx.fillStyle = 'rgba(58, 49, 38, .45)';
    ctx.font = '15px "Songti SC", serif';
    ctx.textAlign = 'center';
    ctx.fillText('叁 / 空白试印纸', PAPER.x + PAPER.width / 2, PAPER.y + PAPER.height / 2 + 4);
    return;
  }
  const eased = 1 - (1 - paperReveal) ** 3;
  const y = H + 12 - eased * (H + 12 - PAPER.y);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.24)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 5;
  ctx.drawImage(printCanvas, PAPER.x, y, PAPER.width, PAPER.height);
  ctx.restore();
}

function draw() {
  drawTable();
  drawBed();
  drawOutputTray();
  drawPressAndLever();
  drawRoller();
}

function point(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * W,
    y: ((event.clientY - rect.top) / rect.height) * H,
  };
}

function rollerHit(x, y) {
  return x > roller.x - 110 && x < roller.x + 150 && y > roller.y - 135 && y < roller.y + 58;
}

function leverHit(x, y) {
  return Math.abs(x - LEVER.x) < 58 && y > LEVER.top - 42 && y < LEVER.top + LEVER.length + 42;
}

canvas.addEventListener('pointerdown', (event) => {
  initAudio();
  const p = point(event);
  if (rollerHit(p.x, p.y)) {
    dragMode = 'roller';
    dragOffsetX = p.x - roller.x;
    canvas.classList.add('rolling');
    statusEl.textContent = '滚过去，再滚回来 —— 每块字都要吃到墨';
  } else if (leverHit(p.x, p.y)) {
    dragMode = 'lever';
    leverPeak = leverPressure;
    canvas.classList.add('levering');
    statusEl.textContent = '稳稳向下压 —— 压力会留在纸上';
  } else {
    return;
  }
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (!dragMode) return;
  const p = point(event);
  if (dragMode === 'roller') {
    const oldX = roller.x;
    const nextX = clamp(p.x - dragOffsetX, BED.x - 12, BED.x + BED.width + 12);
    blocks = inkPass(blocks, oldX, nextX, 172, roller.ink);
    const travel = Math.abs(nextX - oldX);
    roller.ink = Math.max(0.05, roller.ink - travel / 4400);
    roller.x = nextX;
    updateQuality();
  } else {
    leverPressure = clamp((p.y - LEVER.top) / LEVER.length, 0, 1);
    leverPeak = Math.max(leverPeak, leverPressure);
  }
});

function release() {
  if (dragMode === 'roller') {
    statusEl.textContent = inkDescription() === '未上墨'
      ? '滚筒还没碰到字面'
      : '墨上去了 —— 现在拉右边的压印杆';
  }
  if (dragMode === 'lever') {
    if (leverPeak > 0.56) makePrint(leverPeak);
    else statusEl.textContent = '压杆没到底，纸还没有咬住字面';
  }
  dragMode = null;
  canvas.classList.remove('rolling', 'levering');
}
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

canvas.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    const oldX = roller.x;
    roller.x = clamp(roller.x + (event.key === 'ArrowRight' ? 48 : -48), BED.x - 12, BED.x + BED.width + 12);
    blocks = inkPass(blocks, oldX, roller.x, 172, roller.ink);
    updateQuality();
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    leverPressure = 1;
    leverPeak = 1;
    makePrint(1);
  }
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  initAudio();
  compose(phraseInput.value);
});

surpriseBtn.addEventListener('click', () => {
  initAudio();
  presetIndex = (presetIndex + 1) % PRESETS.length;
  compose(PRESETS[presetIndex]);
});

reinkBtn.addEventListener('click', () => {
  initAudio();
  roller.ink = 1;
  statusEl.textContent = '滚筒重新蘸饱了墨';
  updateQuality();
  tone(210, 0.09, 0.06, 'triangle');
});

downloadBtn.addEventListener('click', () => {
  if (!printCanvas) return;
  printCanvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `活字印刷-${phrase}-${currentOutcome?.rarity ?? '试印'}-${Date.now()}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }, 'image/png');
});

muteBtn.addEventListener('click', () => {
  muted = !muted;
  muteBtn.textContent = muted ? '无声' : '声音';
  muteBtn.setAttribute('aria-label', muted ? '开声音' : '静音');
});

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (dragMode !== 'lever' && leverPressure > 0) leverPressure = Math.max(0, leverPressure - dt * (reducedMotion ? 20 : 2.8));
  if (printCanvas && paperReveal < 1) paperReveal = reducedMotion ? 1 : Math.min(1, paperReveal + dt * 1.75);
  draw();
  requestAnimationFrame(loop);
}

updateQuality();
updateCollectionLabel();
requestAnimationFrame(loop);
