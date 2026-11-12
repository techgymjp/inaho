// 環境音（すべて WebAudio で合成）
import { smooth, doyOf } from './calendar.js';

export function createAudio() {
  let ctx = null, master, enabled = false;
  let wind, windGain, rainGain, cicadaGain, cicadaLfo;
  let nextFrog = 0, nextCricket = 0, nextBird = 0, nextUguisu = 0, nextMinmin = 0, nextHigu = 0;

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
    const rf = ctx.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 1800; rf.Q.value = 0.5; // 耳につかないやわらかい雨音
    rainGain = ctx.createGain(); rainGain.gain.value = 0;
    rn.connect(rf).connect(rainGain).connect(master);
    // 蝉（ミンミン系のうなり）
    const cn = loop(white);
    const cf = ctx.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 5200; cf.Q.value = 3;
    const am = ctx.createGain(); am.gain.value = 0.5;
    cicadaLfo = ctx.createOscillator(); cicadaLfo.frequency.value = 23; cicadaLfo.start();
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
  function bird(t0) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    const f0 = 2800 + Math.random() * 1800;
    o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f0 * 1.4, t0 + 0.08);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.9, t0 + 0.16);
    env(g, t0, 0.01, 0.15, 0.04);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + 0.2);
  }
  // 鈴虫「リーン、リーン」：澄んだ高音を細かく震わせる
  function suzumushi(t0) {
    const f = 4300 + Math.random() * 300;
    for (let k = 0; k < 2; k++) {
      const ts = t0 + k * 0.55;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const trem = ctx.createOscillator(); trem.frequency.value = 38;
      const tg = ctx.createGain(); tg.gain.value = 0.5; trem.connect(tg);
      const am = ctx.createGain(); am.gain.value = 0.5; tg.connect(am.gain);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, ts); g.gain.exponentialRampToValueAtTime(0.035, ts + 0.04);
      g.gain.setValueAtTime(0.035, ts + 0.32); g.gain.exponentialRampToValueAtTime(0.0001, ts + 0.42);
      o.connect(am).connect(g).connect(master);
      o.start(ts); trem.start(ts); o.stop(ts + 0.45); trem.stop(ts + 0.45);
    }
  }
  // ミンミンゼミ「ミーン ミンミンミンミン ミー…」
  function minmin(t0) {
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3600; bp.Q.value = 4;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    o.connect(bp).connect(g).connect(master);
    let t = t0;
    const syl = (dur, f0, f1, v) => {
      o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur * 0.25);
      g.gain.setValueAtTime(v, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      t += dur;
    };
    syl(0.9, 1500, 1750, 0.05);
    for (let i = 0; i < 6; i++) syl(0.24, 1700, 1500, 0.06);
    syl(0.8, 1650, 1450, 0.045);
    o.start(t0); o.stop(t + 0.05);
    return t - t0;
  }
  // ヒグラシ「カナカナカナ…」（夕方・明け方）
  function higurashi(t0) {
    const o = ctx.createOscillator(); o.type = 'triangle';
    const g = ctx.createGain(); g.gain.value = 0.0001;
    o.connect(g).connect(master);
    const n = 14;
    for (let i = 0; i < n; i++) {
      const ts = t0 + i * 0.13, v = 0.04 * (1 - i / n * 0.6);
      o.frequency.setValueAtTime(4800 - i * 40, ts); o.frequency.exponentialRampToValueAtTime(3900 - i * 40, ts + 0.1);
      g.gain.setValueAtTime(0.0001, ts); g.gain.exponentialRampToValueAtTime(v, ts + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ts + 0.11);
    }
    o.start(t0); o.stop(t0 + n * 0.13 + 0.1);
  }
  // ウグイス「ホーーー ホケキョ」
  function uguisu(t0) {
    const o = ctx.createOscillator(); o.type = 'sine';
    const o2 = ctx.createOscillator(); o2.type = 'sine'; // 倍音
    const g = ctx.createGain(), g2 = ctx.createGain(); g2.gain.value = 0.15;
    o.connect(g); o2.connect(g2).connect(g); g.connect(master);
    const F = (t, f) => { o.frequency.setValueAtTime(f, t); o2.frequency.setValueAtTime(f * 2, t); };
    const R = (t, f) => { o.frequency.linearRampToValueAtTime(f, t); o2.frequency.linearRampToValueAtTime(f * 2, t); };
    // ホーー：低めの長い音がゆっくり上がる
    F(t0, 1150); R(t0 + 1.4, 1320);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.3);
    g.gain.setValueAtTime(0.07, t0 + 1.25); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.45);
    // ホケ：短く高い二音
    const h = t0 + 1.62;
    F(h, 2350); R(h + 0.09, 2200);
    g.gain.setValueAtTime(0.0001, h); g.gain.exponentialRampToValueAtTime(0.08, h + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, h + 0.1);
    F(h + 0.13, 2600); R(h + 0.2, 2450);
    g.gain.setValueAtTime(0.0001, h + 0.13); g.gain.exponentialRampToValueAtTime(0.08, h + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, h + 0.21);
    // キョ：鋭く跳ね上がって下がる
    const k = h + 0.27;
    F(k, 2000); R(k + 0.08, 3300); R(k + 0.3, 2700);
    g.gain.setValueAtTime(0.0001, k); g.gain.exponentialRampToValueAtTime(0.09, k + 0.04);
    g.gain.setValueAtTime(0.09, k + 0.22); g.gain.exponentialRampToValueAtTime(0.0001, k + 0.36);
    o.start(t0); o2.start(t0); o.stop(k + 0.4); o2.stop(k + 0.4);
  }

  // 農作業の効果音は大きめに。音割れしないようコンプレッサーを通す
  let sfxBus = null;
  function sfxOut() {
    if (sfxBus) return sfxBus;
    sfxBus = ctx.createGain(); sfxBus.gain.value = 2.2;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.15;
    sfxBus.connect(comp).connect(master);
    return sfxBus;
  }
  function swish(strength = 1) {
    if (!enabled) return;
    const t0 = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = noiseBuffer(0.25);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(1800, t0); f.frequency.exponentialRampToValueAtTime(4500, t0 + 0.12); f.Q.value = 1.2;
    const g = ctx.createGain(); env(g, t0, 0.01, 0.16, 0.25 * strength);
    s.connect(f).connect(g).connect(sfxOut()); s.start(t0);
  }
  function chime() {
    if (!enabled) return;
    const t0 = ctx.currentTime;
    [523.3, 659.3, 784, 1046.5].forEach((fr, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fr;
      const g = ctx.createGain(); env(g, t0 + i * 0.12, 0.01, 1.2, 0.08);
      o.connect(g).connect(sfxOut()); o.start(t0 + i * 0.12); o.stop(t0 + i * 0.12 + 1.4);
    });
  }

  // ---- 夕方のチャイム：ドヴォルザーク「新世界より」第2楽章（家路）の冒頭ワンフレーズ ----
  // 防災行政無線のスピーカーから遠くに響く、鉄琴のような音色
  let echoIn = null;
  function echoBus() {
    if (echoIn) return echoIn;
    echoIn = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    const dl = ctx.createDelay(1.5); dl.delayTime.value = 0.32;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    echoIn.connect(lp); lp.connect(master); lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(master);
    return echoIn;
  }
  function chimeNote(t0, freq, dur, vol) {
    for (const [mul, amp] of [[1, 1], [2, 0.35], [3.01, 0.12], [4.2, 0.06]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq * mul;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol * amp, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.6, dur * 1.6) / (mul > 1 ? mul * 0.7 : 1));
      o.connect(g).connect(echoBus()); o.start(t0); o.stop(t0 + dur * 1.8 + 0.2);
    }
  }
  function yuyake() {
    if (!enabled) return;
    // 「ミ ソソ ミ レド レミソミ レ」（ハ長調に移調）
    const E4 = 329.63, G4 = 392.0, D4 = 293.66, C4 = 261.63;
    const beat = 0.62;
    const tune = [[E4, 0.75], [G4, 0.25], [G4, 2], [E4, 0.75], [D4, 0.25], [C4, 2], [D4, 1], [E4, 1], [G4, 1], [E4, 1], [D4, 3]];
    let t0 = ctx.currentTime + 0.1;
    for (const [f, b] of tune) { chimeNote(t0, f, b * beat, 0.09); t0 += b * beat; }
  }

  // ---- 電車の走行音（カタンコトン） ----
  let railGain = null, railPan = null, rumble = null;
  function railBus() {
    if (railGain) return;
    railPan = ctx.createStereoPanner();
    railGain = ctx.createGain(); railGain.gain.value = 0;
    railGain.connect(railPan).connect(master);
    // 低いうなり（エンジンと車輪）
    rumble = loop(noiseBuffer(3, true));
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
    const rg = ctx.createGain(); rg.gain.value = 0.5;
    rumble.connect(lp).connect(rg).connect(railGain);
  }
  function clack(t0, strong) {
    const s = ctx.createBufferSource(); s.buffer = clackBuf || (clackBuf = noiseBuffer(0.08));
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = strong ? 900 : 1300; bp.Q.value = 2.5;
    const g = ctx.createGain(); env(g, t0, 0.003, 0.07, strong ? 0.9 : 0.6);
    s.connect(bp).connect(g).connect(railGain); s.start(t0); s.stop(t0 + 0.1);
    const o = ctx.createOscillator(); o.frequency.value = 95; // ゴトッという低音
    const og = ctx.createGain(); env(og, t0, 0.004, 0.09, strong ? 0.5 : 0.3);
    o.connect(og).connect(railGain); o.start(t0); o.stop(t0 + 0.12);
  }
  let clackBuf = null, lastJoint = null;
  const sfxLast = {};
  // x: 列車の中心位置, dist: カメラからの距離, pan: -1..1, running: 走行中か, speed: m/s, dir: 進行方向
  function train(x, dist, pan, running, speed) {
    if (!enabled) return;
    railBus();
    const now = ctx.currentTime;
    const vol = running ? Math.min(1, 60 / Math.max(dist, 30)) * 0.55 : 0;
    railGain.gain.setTargetAtTime(vol, now, 0.3);
    railPan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), now, 0.2);
    if (!running) { lastJoint = null; return; }
    // レールの継ぎ目（25mごと）を車輪が越えるたびに「カタン、コトン」
    const joint = Math.floor(x / 25);
    if (lastJoint !== null && joint !== lastJoint) {
      const ax = 2.1 / speed, bog = 13.8 / speed, car = 20.8 / speed;
      for (const c of [0, car]) {
        clack(now + c, true); clack(now + c + ax, false);           // カタン
        clack(now + c + bog, true); clack(now + c + bog + ax, false); // コトン
      }
    }
    lastJoint = joint;
  }

  function update(t, hour, wx, light) {
    if (!enabled) return;
    const now = ctx.currentTime;
    const day = light.day;
    windGain.gain.setTargetAtTime(0.05 + wx.wind * 0.25, now, 0.5);
    rainGain.gain.setTargetAtTime(wx.kind === 'rain' ? wx.precip * 0.07 : 0, now, 0.5); // 雨音は控えめに
    const cicada = smooth(doyOf(7, 18), doyOf(7, 28), t) * (1 - smooth(doyOf(8, 25), doyOf(9, 5), t)) * day * (wx.kind === 'rain' ? 0 : 1);
    // アブラゼミの「ジー」は背景に、ミンミンゼミは時々はっきり鳴く
    cicadaGain.gain.setTargetAtTime(cicada * 0.03, now, 0.5);
    if (cicada > 0.3 && hour > 8 && hour < 17 && now > nextMinmin) nextMinmin = now + minmin(now) + 2 + Math.random() * 5;
    const higu = smooth(doyOf(7, 15), doyOf(7, 25), t) * (1 - smooth(doyOf(9, 1), doyOf(9, 15), t)) * (wx.kind === 'rain' ? 0 : 1);
    const dusk = (hour > 16.5 && hour < 19.2) || (hour > 3.8 && hour < 5.5);
    if (higu > 0.3 && dusk && now > nextHigu) { higurashi(now); nextHigu = now + 2.5 + Math.random() * 3; }
    // 蛙：5〜7月の夜（田んぼに水があるとき）
    const frogs = smooth(doyOf(5, 1), doyOf(5, 15), t) * (1 - smooth(doyOf(7, 25), doyOf(8, 10), t)) * (1 - day);
    if (frogs > 0.05 && now > nextFrog) { frog(now, 380 + Math.random() * 300); nextFrog = now + (0.1 + Math.random() * 0.5) / frogs; }
    const crickets = smooth(doyOf(8, 25), doyOf(9, 5), t) * (1 - smooth(doyOf(10, 20), doyOf(11, 5), t)) * (1 - day);
    if (crickets > 0.05 && now > nextCricket) { suzumushi(now); nextCricket = now + (1.3 + Math.random() * 0.8) / crickets; }
    const birds = (1 - smooth(doyOf(11, 20), doyOf(12, 1), t)) * smooth(doyOf(3, 1), doyOf(3, 20), t) * day * (hour < 10 ? 1 : 0.3);
    if (birds > 0.05 && now > nextBird && wx.kind !== 'rain') { bird(now); nextBird = now + (1 + Math.random() * 4) / birds; }
    const ug = smooth(doyOf(3, 20), doyOf(4, 5), t) * (1 - smooth(doyOf(7, 1), doyOf(7, 20), t)) * day;
    if (ug > 0.3 && now > nextUguisu && wx.kind !== 'rain' && hour > 5 && hour < 17) { uguisu(now); nextUguisu = now + 5 + Math.random() * 7; }
  }

  return {
    init, update, swish, chime, yuyake, train,
    // 農作業ごとのスワイプ音
    sfx(kind, strength = 1) {
      if (!enabled) return;
      const now = ctx.currentTime;
      sfxLast[kind] = sfxLast[kind] || 0;
      if (now - sfxLast[kind] < (kind === 'melt' ? 0.05 : 0.09)) return;
      sfxLast[kind] = now;
      const v = Math.min(1, 0.45 + strength * 0.5);
      const noise = (dur, type, f, q, peak, a = 0.004, brown = false, t0 = now) => {
        const src = ctx.createBufferSource(); src.buffer = noiseBuffer(dur + 0.05, brown);
        const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
        const g = ctx.createGain(); env(g, t0, a, dur, peak * v);
        src.connect(fl).connect(g).connect(sfxOut()); src.start(t0); src.stop(t0 + dur + 0.06);
        return fl;
      };
      const tone = (f0, f1, dur, peak, type = 'sine', t0 = now) => {
        const o = ctx.createOscillator(); o.type = type;
        o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
        const g = ctx.createGain(); env(g, t0, 0.004, dur, peak * v);
        o.connect(g).connect(sfxOut()); o.start(t0); o.stop(t0 + dur + 0.05);
      };
      if (kind === 'till') {            // ズシャッ（重たい土を鍬で掘り返す）
        tone(85, 42, 0.22, 0.55, 'sine');                                  // 土に刃が食い込む低い衝撃
        noise(0.28, 'lowpass', 320, 0.8, 0.6, 0.006, true);                // 湿った土の重いかたまり
        noise(0.2, 'bandpass', 520, 1.1, 0.28, 0.01, true, now + 0.04);    // 土がめくれる
        noise(0.12, 'bandpass', 1400, 1.0, 0.06, 0.004, false, now + 0.07); // 土くれがこぼれる（控えめ）
        noise(0.18, 'lowpass', 260, 0.7, 0.3, 0.01, true, now + 0.13);     // ドスッと落ちる余韻
      } else if (kind === 'level') {    // チャプッ（泥水をならす）
        const f = noise(0.22, 'bandpass', 900, 2.2, 0.25);
        f.frequency.setValueAtTime(600, now); f.frequency.exponentialRampToValueAtTime(1800, now + 0.15);
        tone(500, 1100, 0.07, 0.05, 'sine', now + 0.03);
      } else if (kind === 'plant') {    // プスッ（苗を泥にさす）
        noise(0.05, 'bandpass', 1500, 2, 0.18);
        tone(320, 140, 0.08, 0.12, 'sine', now + 0.01);
      } else if (kind === 'weed') {     // ブチッ（雑草を引き抜く）
        noise(0.04, 'highpass', 3000, 0.7, 0.3, 0.001);
        noise(0.14, 'bandpass', 500, 1, 0.25, 0.004, true, now + 0.03);
      } else if (kind === 'bug') {      // パシッ（カメムシを捕まえる）
        noise(0.035, 'bandpass', 2400, 1.5, 0.45, 0.001);
        tone(900, 300, 0.05, 0.06, 'triangle');
      } else if (kind === 'levee') {    // ペタッ（土をたたいてふさぐ）
        noise(0.08, 'lowpass', 900, 0.8, 0.45, 0.002, true);
        tone(180, 90, 0.07, 0.15, 'sine');
      } else if (kind === 'melt') {     // サラサラ（粉をまく）
        noise(0.18, 'highpass', 5000, 0.7, 0.12, 0.02);
      } else if (kind === 'snow') {     // ズザッ（屋根の雪をかく）
        noise(0.2, 'bandpass', 1800, 0.8, 0.22, 0.01);
      }
    },
    // 雪のかたまりが地面に落ちる「ドサッ」
    thud() {
      if (!enabled) return;
      const t0 = ctx.currentTime;
      const s2 = ctx.createBufferSource(); s2.buffer = noiseBuffer(0.3, true);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 350;
      const g = ctx.createGain(); env(g, t0, 0.008, 0.22, 0.5);
      s2.connect(lp).connect(g).connect(sfxOut()); s2.start(t0);
      const n2 = ctx.createBufferSource(); n2.buffer = noiseBuffer(0.25);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
      const g2 = ctx.createGain(); env(g2, t0 + 0.01, 0.01, 0.2, 0.05);   // 粉雪のサラサラ
      n2.connect(hp).connect(g2).connect(sfxOut()); n2.start(t0);
    },
    // ハウスがつぶれる音
    crash() {
      if (!enabled) return;
      const t0 = ctx.currentTime;
      const s2 = ctx.createBufferSource(); s2.buffer = noiseBuffer(1.2, true);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
      const g = ctx.createGain(); env(g, t0, 0.02, 1.1, 0.9);
      s2.connect(lp).connect(g).connect(sfxOut()); s2.start(t0);
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(180, t0); o.frequency.exponentialRampToValueAtTime(60, t0 + 0.6);
      const og = ctx.createGain(); env(og, t0, 0.01, 0.6, 0.12);
      o.connect(og).connect(sfxOut()); o.start(t0); o.stop(t0 + 0.7);
    },
    // スズメが飛び立つ羽音
    flutter() {
      if (!enabled) return;
      const t0 = ctx.currentTime;
      for (let k = 0; k < 10; k++) {
        const s2 = ctx.createBufferSource(); s2.buffer = noiseBuffer(0.06);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400 + Math.random() * 900; bp.Q.value = 1;
        const g = ctx.createGain(); env(g, t0 + k * 0.035 + Math.random() * 0.02, 0.005, 0.05, 0.12);
        s2.connect(bp).connect(g).connect(sfxOut()); s2.start(t0 + k * 0.035);
      }
      bird(t0 + 0.1); bird(t0 + 0.25);
    },
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
