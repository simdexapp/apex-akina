// Audio module for the 3D engine — ported from the canvas game's synth approach.
// Engine: dual oscillator + lowpass + tremolo LFO, frequency tracks speed/RPM.
// Tire: filtered noise with skrrrt LFO modulation.
// Music: arp + bass loop scheduled on the AudioContext timeline.

let ctx = null;
let master = null;
let osc1, osc2, engineGain, engineLowpass;
let pulseLfo, pulseLfoGain;
let tireNoise, tireGain, tireBandpass;
let musicGain, musicScheduler, musicBeatTime, musicBeatIdx;
let muted = false;

const PROFILE = {
  type1: "sawtooth", type2: "triangle",
  idleHz: 64, redlineHz: 320,
  detune2: 1200, gain2: 0.32,
  lpfBase: 360, lpfTop: 2200,
  pulseIdle: 6, pulseTop: 22, pulseDepth: 0.42,
  body: 0.14
};

const MUSIC_TEMPO = 96;
const MUSIC_BEAT_SEC = 60 / MUSIC_TEMPO / 2;
const ARP = [146.83, 174.61, 220, 261.63, 220, 261.63, 329.63, 220,
             146.83, 174.61, 220, 261.63, 174.61, 220, 261.63, 329.63];
const BASS = [73.42, 0, 87.31, 0, 73.42, 0, 87.31, 0];

export function ensureAudio() {
  if (ctx) {
    if (ctx.state === "suspended") ctx.resume();
    return;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  try {
    ctx = new Ctx();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.4;
    master.connect(ctx.destination);

    // Engine
    osc1 = ctx.createOscillator();
    osc1.type = PROFILE.type1;
    osc1.frequency.value = PROFILE.idleHz;
    osc1.detune.value = -8;
    osc2 = ctx.createOscillator();
    osc2.type = PROFILE.type2;
    osc2.frequency.value = PROFILE.idleHz;
    osc2.detune.value = PROFILE.detune2 + 8;
    const detune2Gain = ctx.createGain();
    detune2Gain.gain.value = PROFILE.gain2;

    engineLowpass = ctx.createBiquadFilter();
    engineLowpass.type = "lowpass";
    engineLowpass.frequency.value = PROFILE.lpfBase;
    engineLowpass.Q.value = 3;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;

    pulseLfo = ctx.createOscillator();
    pulseLfo.type = "sine";
    pulseLfo.frequency.value = PROFILE.pulseIdle;
    pulseLfoGain = ctx.createGain();
    pulseLfoGain.gain.value = 0;
    pulseLfo.connect(pulseLfoGain);
    pulseLfoGain.connect(engineGain.gain);

    osc1.connect(engineLowpass);
    osc2.connect(detune2Gain);
    detune2Gain.connect(engineLowpass);
    engineLowpass.connect(engineGain);
    engineGain.connect(master);
    osc1.start();
    osc2.start();
    pulseLfo.start();

    // Tire screech
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
    tireNoise = ctx.createBufferSource();
    tireNoise.buffer = buffer;
    tireNoise.loop = true;
    tireBandpass = ctx.createBiquadFilter();
    tireBandpass.type = "bandpass";
    tireBandpass.frequency.value = 1750;
    tireBandpass.Q.value = 11;
    tireGain = ctx.createGain();
    tireGain.gain.value = 0;
    tireNoise.connect(tireBandpass);
    tireBandpass.connect(tireGain);
    tireGain.connect(master);
    tireNoise.start();

    // Music bus
    musicGain = ctx.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(master);
    startMusic();
  } catch (e) {
    ctx = null;
  }
}

function playArpNote(freq, time, duration) {
  if (!ctx || freq <= 0) return;
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = freq;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2200;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(0.16, time + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  osc.connect(lp);
  lp.connect(g);
  g.connect(musicGain);
  osc.start(time);
  osc.stop(time + duration + 0.02);
}

function playBassNote(freq, time, duration) {
  if (!ctx || freq <= 0) return;
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = freq;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 380;
  lp.Q.value = 5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(0.34, time + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, time + duration);
  osc.connect(lp);
  lp.connect(g);
  g.connect(musicGain);
  osc.start(time);
  osc.stop(time + duration + 0.02);
}

function startMusic() {
  musicBeatTime = ctx.currentTime + 0.1;
  musicBeatIdx = 0;
  if (musicScheduler) clearInterval(musicScheduler);
  musicScheduler = setInterval(() => {
    if (!ctx) return;
    while (musicBeatTime < ctx.currentTime + 0.25) {
      playArpNote(ARP[musicBeatIdx % ARP.length], musicBeatTime, MUSIC_BEAT_SEC * 1.6);
      playBassNote(BASS[musicBeatIdx % BASS.length], musicBeatTime, MUSIC_BEAT_SEC * 2.2);
      musicBeatTime += MUSIC_BEAT_SEC;
      musicBeatIdx++;
    }
  }, 60);
}

export function updateAudio({ speed, maxSpeed, lateralSlip, throttle, brake, racing }) {
  if (!ctx) return;
  const sp = Math.max(0, Math.min(1, Math.abs(speed) / maxSpeed));
  const onThrottle = !!throttle;
  const onBrake = !!brake;
  const offThrottle = racing && !onThrottle && !onBrake;
  const range = PROFILE.redlineHz - PROFILE.idleHz;
  const freqMul = onThrottle ? 1.05 : onBrake ? 0.86 : offThrottle ? 0.92 : 1.0;
  const targetFreq = (PROFILE.idleHz + sp * range) * freqMul;
  osc1.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.022);
  osc2.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.022);

  const loadGain = onThrottle ? 1.0 : onBrake ? 0.34 : offThrottle ? 0.50 : 0.30;
  const baseGain = racing ? PROFILE.body * (0.30 + sp * 0.65) * loadGain : PROFILE.body * 0.14;
  engineGain.gain.setTargetAtTime(baseGain, ctx.currentTime, 0.025);

  const pulseHz = PROFILE.pulseIdle + sp * (PROFILE.pulseTop - PROFILE.pulseIdle);
  pulseLfo.frequency.setTargetAtTime(pulseHz * (onThrottle ? 1.0 : 0.78), ctx.currentTime, 0.05);
  pulseLfoGain.gain.setTargetAtTime(racing ? baseGain * PROFILE.pulseDepth : 0, ctx.currentTime, 0.05);

  const lpfTarget = (PROFILE.lpfBase + sp * (PROFILE.lpfTop - PROFILE.lpfBase)) *
    (onThrottle ? 1.0 : onBrake ? 0.42 : offThrottle ? 0.55 : 0.5);
  engineLowpass.frequency.setTargetAtTime(lpfTarget, ctx.currentTime, 0.06);

  // Tire screech with skrrrt pulse.
  const slipMag = Math.min(1, Math.abs(lateralSlip || 0));
  const skrrrt = 0.6 + 0.4 * Math.abs(Math.sin(ctx.currentTime * 28));
  const screechBase = racing && slipMag > 0.25 && sp > 0.3 ? Math.min(0.36, slipMag * 0.55) : 0;
  tireGain.gain.setTargetAtTime(screechBase * skrrrt, ctx.currentTime, 0.025);
  tireBandpass.frequency.setTargetAtTime(1500 + slipMag * 700, ctx.currentTime, 0.04);

  // Music level — quieter on the menu, fuller during the race.
  if (musicGain) {
    musicGain.gain.setTargetAtTime(racing ? 0.30 : 0.10, ctx.currentTime, 0.4);
  }
}

export function setAudioMuted(value) {
  muted = !!value;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.4, ctx.currentTime, 0.05);
}

export function isAudioMuted() {
  return muted;
}
