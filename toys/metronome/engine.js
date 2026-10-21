export const METERS = ['2/4', '3/4', '4/4', '5/4', '6/8', '7/8'];
export const DEFAULTS = { bpm: 80, meter: '4/4', division: 1, volume: 70, sound: 'wood', accents: [2, 1, 1, 1] };

export function bounded(value, min, max, fallback) {
  const number = Number(value);
  return value === '' || !Number.isFinite(number) ? fallback : Math.min(max, Math.max(min, Math.round(number)));
}

export function settingsFrom(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const meter = METERS.includes(source.meter) ? source.meter : DEFAULTS.meter;
  const beats = Number(meter.split('/')[0]);
  return {
    bpm: bounded(source.bpm, 30, 300, DEFAULTS.bpm), meter,
    division: [1, 2, 3, 4].includes(source.division) ? source.division : 1,
    volume: bounded(source.volume, 0, 100, DEFAULTS.volume),
    sound: ['wood', 'click', 'hat'].includes(source.sound) ? source.sound : 'wood',
    accents: Array.from({ length: beats }, (_, i) => [0, 1, 2].includes(source.accents?.[i]) ? source.accents[i] : i === 0 ? 2 : 1),
  };
}

export function tapTempo(taps) {
  if (taps.length < 2) return null;
  return bounded(60000 * (taps.length - 1) / (taps.at(-1) - taps[0]), 30, 300, 80);
}

export function nextPulse(pulse, settings) {
  const subdivision = pulse.subdivision + 1;
  const beat = pulse.beat + Math.floor(subdivision / settings.division);
  return { beat: beat % settings.accents.length, subdivision: subdivision % settings.division };
}

// ponytail: schedule against the audio clock; a JS timer only fills the next 100 ms.
export function createMetronome(context, getSettings, onPulse) {
  const master = context.createGain();
  master.connect(context.destination);
  const voices = new Map();
  let timer, nextTime = 0, pulse = { beat: 0, subdivision: 0 };
  const noise = context.createBuffer(1, Math.ceil(context.sampleRate * .04), context.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

  function tick() {
    // A throttled timer skips missed beats; never burst-play a stale backlog.
    if (nextTime < context.currentTime - .1) nextTime = context.currentTime + .02;
    while (nextTime < context.currentTime + .1) {
      const settings = getSettings();
      const accent = settings.accents[pulse.beat];
      const isSub = pulse.subdivision > 0;
      if (accent && settings.volume) click(nextTime, accent, isSub, settings.sound);
      onPulse({ ...pulse, time: nextTime });
      nextTime += 60 / settings.bpm / settings.division;
      pulse = nextPulse(pulse, settings);
    }
  }

  function click(time, accent, isSub, sound) {
    const voice = sound === 'hat' ? context.createBufferSource() : context.createOscillator();
    const envelope = context.createGain();
    const level = isSub ? .14 : accent === 2 ? .55 : .32;
    if (sound === 'hat') voice.buffer = noise;
    else {
      voice.type = sound === 'wood' ? 'sine' : 'square';
      const frequency = (isSub ? 900 : accent === 2 ? 1700 : 1150) * (sound === 'wood' ? .8 : 1);
      voice.frequency.setValueAtTime(frequency, time);
      if (sound === 'wood') voice.frequency.exponentialRampToValueAtTime(frequency * .45, time + .035);
    }
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(level * (sound === 'click' ? .5 : 1), time + .001);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + .04);
    voice.connect(envelope).connect(master);
    voices.set(voice, envelope);
    voice.onended = () => { voices.delete(voice); voice.disconnect(); envelope.disconnect(); };
    voice.start(time);
    voice.stop(time + .045);
  }

  return {
    start() { this.stop(); nextTime = context.currentTime + .05; pulse = { beat: 0, subdivision: 0 }; tick(); timer = setInterval(tick, 25); },
    stop() { clearInterval(timer); for (const [voice, envelope] of voices) { voice.onended = null; voice.stop(); voice.disconnect(); envelope.disconnect(); } voices.clear(); },
    volume(value) { master.gain.setValueAtTime(value / 100, context.currentTime); },
  };
}
