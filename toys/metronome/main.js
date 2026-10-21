import { bounded, settingsFrom, tapTempo, createMetronome } from './engine.js';

const $ = (id) => document.getElementById(id);
const storageKey = 'vibe:metronome';
let settings;
try { settings = settingsFrom(JSON.parse(localStorage.getItem(storageKey))); }
catch { settings = settingsFrom(); }
let context, engine, running = false, starting = false, frame, queue = [], taps = [];
let elapsed = 0, startedAt = 0;
let wakeLock;
const beatNames = ['静音', '普通', '重音'];

function save() {
  try { localStorage.setItem(storageKey, JSON.stringify(settings)); } catch { /* Storage is optional in private browsing. */ }
}

function renderTempo() {
  $('bpm').value = $('tempo-slider').value = settings.bpm;
  $('tempo-slider').style.setProperty('--fill', `${(settings.bpm - 30) / 270 * 100}%`);
  $('tempo-word').textContent = settings.bpm < 65 ? '慢下来，练扎实' : settings.bpm < 100 ? '从容一点' : settings.bpm < 140 ? '找到你的律动' : '保持放松，稳住节拍';
  $('slower').disabled = settings.bpm === 30;
  $('faster').disabled = settings.bpm === 300;
  document.querySelectorAll('[data-bpm]').forEach((button) => button.setAttribute('aria-pressed', Number(button.dataset.bpm) === settings.bpm));
}

function renderBeats() {
  $('beats').style.setProperty('--beats', settings.accents.length);
  $('beats').replaceChildren(...settings.accents.map((accent, index) => {
    const button = document.createElement('button');
    button.className = 'beat';
    button.dataset.accent = accent;
    button.setAttribute('aria-label', `第 ${index + 1} 拍：${beatNames[accent]}，点击切换`);
    const number = document.createElement('strong');
    number.textContent = index + 1;
    const label = document.createElement('small');
    label.textContent = beatNames[accent];
    button.append(number, label);
    button.addEventListener('click', () => {
      settings.accents[index] = (settings.accents[index] + 1) % 3;
      button.dataset.accent = settings.accents[index];
      label.textContent = beatNames[settings.accents[index]];
      button.setAttribute('aria-label', `第 ${index + 1} 拍：${label.textContent}，点击切换`);
      save();
    });
    return button;
  }));
}

function renderDivision() {
  const isEighth = settings.meter.endsWith('/8');
  const labels = isEighth ? ['八分', '十六分', '三连音', '三十二分'] : ['四分', '八分', '三连音', '十六分'];
  document.querySelectorAll('[data-division]').forEach((button, i) => {
    button.setAttribute('aria-pressed', Number(button.dataset.division) === settings.division);
    button.querySelector('span').textContent = labels[i];
  });
  $('meter-label').textContent = `${settings.meter} 拍 · ${isEighth ? '八' : '四'}分音符为一拍`;
  $('division-note').textContent = `每拍 ${settings.division} 下${settings.division === 1 ? '，先把底拍练稳。' : '，细分音轻于底拍。'}`;
}

function setTempo(value) {
  settings.bpm = bounded(value, 30, 300, settings.bpm);
  renderTempo(); save();
}

async function releaseScreen() {
  const lock = wakeLock;
  wakeLock = null;
  try { await lock?.release(); } catch { /* A released screen lock needs no retry. */ }
}

async function keepScreen() {
  if (!navigator.wakeLock) return;
  try {
    const lock = await navigator.wakeLock.request('screen');
    if (running) wakeLock = lock;
    else await lock.release();
  } catch { /* Audio works even when the browser denies a screen lock. */ }
}

function showTransport() {
  $('play').setAttribute('aria-pressed', running);
  $('play').querySelector('span').textContent = running ? '暂停练习' : '开始练习';
  $('play').querySelector('path').setAttribute('d', running ? 'M8 5h3v14H8Zm7 0h3v14h-3Z' : 'm9 5 11 7-11 7Z');
  $('status').textContent = running ? '练习中' : '待开始';
  document.querySelector('.instrument').classList.toggle('running', running);
}

function drawTime() {
  const seconds = Math.floor((elapsed + (running ? performance.now() - startedAt : 0)) / 1000);
  $('elapsed').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function draw() {
  if (!running) return;
  let current;
  while (queue.length && queue[0].time <= context.currentTime) current = queue.shift();
  if (current) {
    [...$('beats').children].forEach((beat, i) => beat.classList.toggle('current', i === current.beat));
  }
  drawTime();
  frame = requestAnimationFrame(draw);
}

function stop(message = '待开始') {
  if (running) elapsed += performance.now() - startedAt;
  running = false;
  engine?.stop();
  cancelAnimationFrame(frame);
  queue = [];
  [...$('beats').children].forEach((beat) => beat.classList.remove('current'));
  releaseScreen();
  showTransport(); drawTime();
  $('status').textContent = message;
}

async function toggle() {
  if (starting) return;
  if (running) { stop(); return; }
  starting = true;
  $('play').disabled = true;
  $('error').hidden = true;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error('不支持音频');
    context ||= new Audio({ latencyHint: 'interactive' });
    await context.resume();
    if (context.state !== 'running' || document.hidden) throw new Error('音频未就绪');
    if (!engine) {
      engine = createMetronome(context, () => settings, (pulse) => queue.push(pulse));
      context.addEventListener('statechange', () => { if (running && context.state !== 'running') stop('音频已中断，点击继续'); });
    }
    running = true;
    startedAt = performance.now();
    engine.volume(settings.volume);
    engine.start();
    showTransport(); draw(); keepScreen();
  } catch {
    stop();
    $('error').textContent = '声音未能启动，请检查浏览器的声音权限，再点击开始。';
    $('error').hidden = false;
  } finally {
    starting = false;
    $('play').disabled = false;
  }
}

function restartPattern() {
  queue = [];
  if (running) engine.start();
  [...$('beats').children].forEach((beat) => beat.classList.remove('current'));
}

function tap() {
  const now = performance.now();
  if (taps.length && now - taps.at(-1) > 2200) taps = [];
  taps.push(now);
  taps = taps.slice(-6);
  const bpm = tapTempo(taps);
  if (bpm) setTempo(bpm);
  $('tap-note').textContent = bpm ? `${bpm} BPM / 继续敲击` : '再敲一下';
}

$('play').addEventListener('click', toggle);
$('slower').addEventListener('click', () => setTempo(settings.bpm - 1));
$('faster').addEventListener('click', () => setTempo(settings.bpm + 1));
$('bpm').addEventListener('change', (event) => setTempo(event.target.value));
$('bpm').addEventListener('input', (event) => {
  if (event.target.value !== '' && event.target.validity.valid) setTempo(event.target.value);
});
$('bpm').addEventListener('blur', (event) => setTempo(event.target.value));
$('bpm').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') { setTempo(event.target.value); event.target.blur(); }
});
$('tempo-slider').addEventListener('input', (event) => setTempo(event.target.value));
document.querySelectorAll('[data-bpm]').forEach((button) => {
  button.addEventListener('click', () => setTempo(button.dataset.bpm));
});
$('tap').addEventListener('click', tap);
$('meter').addEventListener('change', (event) => {
  settings = settingsFrom({ ...settings, meter: event.target.value, accents: undefined });
  restartPattern(); renderBeats(); renderDivision(); save();
});
$('subdivisions').addEventListener('click', (event) => {
  const button = event.target.closest('[data-division]');
  if (!button) return;
  settings.division = Number(button.dataset.division);
  restartPattern(); renderDivision(); save();
});
$('sound').addEventListener('change', (event) => { settings.sound = event.target.value; save(); });
$('volume').addEventListener('input', (event) => {
  settings.volume = Number(event.target.value);
  renderVolume(); engine?.volume(settings.volume); save();
});
$('reset-time').addEventListener('click', () => { elapsed = 0; startedAt = performance.now(); drawTime(); });
document.addEventListener('keydown', (event) => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input, select, textarea, [contenteditable]')) return;
  if (event.code === 'Space') {
    if (event.target.closest('button, a')) return;
    event.preventDefault(); toggle();
  } else if (event.code === 'KeyT') tap();
  else if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
    event.preventDefault(); setTempo(settings.bpm + (event.key === 'ArrowUp' ? 1 : -1));
  }
});
// ponytail: background timer throttling varies by browser; pause explicitly instead of promising hidden-tab playback.
document.addEventListener('visibilitychange', () => { if (document.hidden && running) stop('切到后台，已暂停'); });
window.addEventListener('pagehide', () => stop());

function renderVolume() {
  $('volume').value = settings.volume;
  $('volume-value').textContent = `${settings.volume}%`;
  $('volume').style.setProperty('--fill', `${settings.volume}%`);
}
$('meter').value = settings.meter;
$('sound').value = settings.sound;
renderTempo(); renderBeats(); renderDivision(); renderVolume();
