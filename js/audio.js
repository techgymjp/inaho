// 環境音（すべて WebAudio で合成）
import { smooth, doyOf } from './calendar.js';

export function createAudio() {
  let ctx = null, master, enabled = false;
  let wind, windGain, rainGain, cicadaGain, cicadaLfo;
  let nextFrog = 0, nextCricket = 0, nextBird = 0, nextUguisu = 0;

  function noiseBuffer(sec = 2, brown = false) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }
  function loop(buf) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; }

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    // 風
    const brown = noiseBuffer(4, true);
    wind = loop(brown);
    const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 500;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    wind.connect(wf).connect(windGain).connect(master);
    // 雨
    const white = noiseBuffer(3);
    const rn = loop(white);
    const rf = ctx.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 2500; rf.Q.value = 0.4;
    rainGain = ctx.createGain(); rainGain.gain.value = 0;
    rn.connect(rf).connect(rainGain).connect(master);
    // 蝉（ミンミン系のうなり）
    const cn = loop(white);
    const cf = ctx.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 4800; cf.Q.value = 6;
    const am = ctx.createGain(); am.gain.value = 0.5;
    cicadaLfo = ctx.createOscillator(); cicadaLfo.frequency.value = 7; cicadaLfo.start();
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.5; cicadaLfo.connect(lfoG).connect(am.gain);
    cicadaGain = ctx.createGain(); cicadaGain.gain.value = 0;
    cn.connect(cf).connect(am).connect(cicadaGain).connect(master);
    enabled = true;
  }

  function env(g, t0, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }
  function frog(t0, pitch) {
    // ケロケロ：短いパルスの連続
    for (let k = 0; k < 2 + Math.floor(Math.random() * 3); k++) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = pitch * (0.95 + Math.random() * 0.1);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = pitch * 2; f.Q.value = 3;
      const g = ctx.createGain(); const ts = t0 + k * 0.13;
      env(g, ts, 0.01, 0.07, 0.05);
      o.connect(f).connect(g).connect(master); o.start(ts); o.stop(ts + 0.12);
    }
  }
  function cricket(t0) {
    const o = ctx.createOscillator(); o.frequency.value = 4200 + Math.random() * 400;
    const g = ctx.createGain();
    for (let k = 0; k < 3; k++) env(g, t0 + k * 0.05, 0.005, 0.03, 0.03);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + 0.2);
  }
  function bird(t0) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    const f0 = 2800 + Math.random() * 1800;
    o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f0 * 1.4, t0 + 0.08);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.9, t0 + 0.16);
    env(g, t0, 0.01, 0.15, 0.04);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + 0.2);
  }
  function uguisu(t0) {
    // ホー…ホケキョ
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.setValueAtTime(1200, t0); o.frequency.linearRampToValueAtTime(1350, t0 + 0.9);
    o.frequency.setValueAtTime(2200, t0 + 1.05); o.frequency.linearRampToValueAtTime(2700, t0 + 1.2);
    o.frequency.setValueAtTime(1900, t0 + 1.3); o.frequency.linearRampToValueAtTime(2300, t0 + 1.55);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.2);
    g.gain.setValueAtTime(0.05, t0 + 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.0);
    g.gain.exponentialRampToValueAtTime(0.06, t0 + 1.08); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.62);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + 1.7);
  }

  function swish(strength = 1) {
    if (!enabled) return;
    const t0 = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = noiseBuffer(0.25);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(1800, t0); f.frequency.exponentialRampToValueAtTime(4500, t0 + 0.12); f.Q.value = 1.2;
    const g = ctx.createGain(); env(g, t0, 0.01, 0.16, 0.25 * strength);
    s.connect(f).connect(g).connect(master); s.start(t0);
  }
  function chime() {
    if (!enabled) return;
    const t0 = ctx.currentTime;
    [523.3, 659.3, 784, 1046.5].forEach((fr, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fr;
      const g = ctx.createGain(); env(g, t0 + i * 0.12, 0.01, 1.2, 0.08);
      o.connect(g).connect(master); o.start(t0 + i * 0.12); o.stop(t0 + i * 0.12 + 1.4);
    });
  }

  function update(t, hour, wx, light) {
    if (!enabled) return;
    const now = ctx.currentTime;
    const day = light.day;
    windGain.gain.setTargetAtTime(0.05 + wx.wind * 0.25, now, 0.5);
    rainGain.gain.setTargetAtTime(wx.kind === 'rain' ? wx.precip * 0.22 : 0, now, 0.5);
    const cicada = smooth(doyOf(7, 18), doyOf(7, 28), t) * (1 - smooth(doyOf(8, 25), doyOf(9, 5), t)) * day * (wx.kind === 'rain' ? 0 : 1);
    cicadaGain.gain.setTargetAtTime(cicada * 0.05, now, 0.5);
    // 蛙：5〜7月の夜（田んぼに水があるとき）
    const frogs = smooth(doyOf(5, 1), doyOf(5, 15), t) * (1 - smooth(doyOf(7, 25), doyOf(8, 10), t)) * (1 - day);
    if (frogs > 0.05 && now > nextFrog) { frog(now, 380 + Math.random() * 300); nextFrog = now + (0.1 + Math.random() * 0.5) / frogs; }
    const crickets = smooth(doyOf(8, 25), doyOf(9, 5), t) * (1 - smooth(doyOf(10, 20), doyOf(11, 5), t)) * (1 - day);
    if (crickets > 0.05 && now > nextCricket) { cricket(now); nextCricket = now + (0.2 + Math.random() * 0.4) / crickets; }
    const birds = (1 - smooth(doyOf(11, 20), doyOf(12, 1), t)) * smooth(doyOf(3, 1), doyOf(3, 20), t) * day * (hour < 10 ? 1 : 0.3);
    if (birds > 0.05 && now > nextBird && wx.kind !== 'rain') { bird(now); nextBird = now + (1 + Math.random() * 4) / birds; }
    const ug = smooth(doyOf(3, 20), doyOf(4, 5), t) * (1 - smooth(doyOf(7, 1), doyOf(7, 20), t)) * day;
    if (ug > 0.3 && now > nextUguisu && wx.kind !== 'rain') { uguisu(now); nextUguisu = now + 8 + Math.random() * 14; }
  }

  return {
    init, update, swish, chime,
    get enabled() { return enabled; },
    toggle() {
      if (!ctx) { init(); return true; }
      enabled = !enabled;
      master.gain.setTargetAtTime(enabled ? 0.8 : 0, ctx.currentTime, 0.1);
      if (enabled) ctx.resume();
      return enabled;
    },
  };
}
