import * as THREE from 'three';
import { createLandscape } from './landscape.js';
import { createField, FIELD_W, FIELD_D, TOTAL, KG_PER_HILL } from './field.js';
import { createEffects } from './effects.js';
import { createFlowers } from './flowers.js';
import { createFarmwork } from './farmwork.js';
import { createStarSky } from './stars.js';
import { buzz } from './haptics.js';
import { createAudio } from './audio.js';
import { LANG, setLang, t as tr, msg, stageText, sekkiText, fmtDate, fmtMonthDay, applyStatic } from './i18n.js';
import {
  dateLabel, monthDay, sekki, stageOf, sunPosition, moonPosition, weatherOf, WEATHER_LABEL, doyOf,
  HARVEST_START, HARVEST_END, harvestQuality, grade, smooth, clamp, PLANT_START,
} from './calendar.js';

// ---------- 画質 ----------
const isMobile = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad/.test(navigator.userAgent);
const QUALITY = {
  high: { name: tr('quality.high'), shadow: 2048, reflect: 1024, blades: 10, bladeSegs: 3, ears: 4, earSegs: 5, trees: 26000, terrainSeg: 320, grass: 7000, pr: Math.min(devicePixelRatio, 2) },
  // スマートフォン・アプリ向け：木を減らし、遠くの地形を粗く、反射を小さく、解像度は等倍に
  low: { name: tr('quality.low'), shadow: 1024, reflect: 256, blades: 4, bladeSegs: 2, ears: 3, earSegs: 3, trees: 4500, terrainSeg: 150, grass: 0, pr: 1, light: true },
};
const qKey = localStorage.getItem('suiden365.quality') || (isMobile || (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ? 'low' : 'high');
const Q = QUALITY[qKey] || QUALITY.high;

// ---------- レンダラ ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !Q.light, powerPreference: 'high-performance' });
renderer.setPixelRatio(Q.pr);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = !Q.light; // 軽量画質（スマートフォン・アプリ）は影なしで軽く
renderer.shadowMap.type = Q.light ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.15, 60000);

const land = createLandscape(scene, renderer, Q);
const field = createField(scene, Q);
const fx = createEffects(scene, Q);
const farm = createFarmwork({ scene, field, fx, audio: { flutter: () => audio.flutter && audio.flutter(), crash: () => audio.crash && audio.crash(), thud: () => audio.thud && audio.thud(), sfx: (k, v) => audio.sfx && audio.sfx(k, v) } });
const flowers = createFlowers(scene);
const starSky = createStarSky(scene, 37.5);
const audio = createAudio();
window.GameSound = audio; // 広告の表示中に音を止めるため（js/ads.js から使う）
const Ads = window.Ads || { available: false, canReward: false, showing: false, initDone: Promise.resolve(), showInterstitial: async () => {}, showRewarded: async () => 'unavailable', setBanner() {}, showPrivacyOptions: async () => {}, privacyOptionsRequired: false };
const native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

// ---------- 状態 ----------
const SAVE_KEY = 'suiden365.save.v1';
const state = {
  year: 1, t: doyOf(4, 20) + 5 / 24, speed: 1, paused: false,
  harvestKg: 0, harvestQ: 0, finalized: false, records: [], view: 'aze', lastStage: '', started: false,
  harvestPrompted: false,
};
const SPEEDS = [1, 10, 60, 600];

function save() {
  if (!state.started) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      year: state.year, t: state.t, speed: state.speed, harvestKg: state.harvestKg, harvestQ: state.harvestQ,
      finalized: state.finalized, records: state.records, cut: field.serialize(), work: field.serializeWork(), harvestExtra: state.harvestExtra || 0, extendUsed: state.extendUsed || 0, rewardAsked: !!state.rewardAsked, farm: farm.serialize(), view: state.view, harvestPrompted: state.harvestPrompted,
      calYear: state.calYear,
    }));
  } catch (e) { /* 保存できない環境 */ }
}
function load() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; }
}

// ---------- カメラ ----------
const cam = {
  pos: new THREE.Vector3(), yaw: 0, pitch: 0, // yaw: 0 = 北(-z)
  tPos: new THREE.Vector3(), tYaw: 0, tPitch: 0, dragYaw: 0, dragPitch: 0, fov: 55, tFov: 55,
};
const VIEWS = {
  aze: { label: '畦道', pos: [7.5, 3.0, 36.5], yaw: 0, pitch: -0.005, fov: 24 }, // 真北を向く // 農道の奥の土手から望遠で
  drone: { label: '空から', orbit: true },
  yama: { label: '里山', pos: [-190, 62, 175], look: [0, 0, 0] },
  kominka: { label: '古民家', pos: [-14, 2.6, 7], look: [-62, 4.5, 4], fov: 40 },
  hoshi: { label: '星空', pos: [7.5, 1.6, 36.5], yaw: 0, pitch: 0.62, fov: 72 },
  north: { label: '水路', pos: [-14, 1.4, -28.2], yaw: Math.PI * 0.82, pitch: -0.04 },
};
const VIEW_ORDER = ['aze', 'hoshi', 'kominka', 'drone', 'yama', 'north'];
function lookFrom(p, target) {
  const dx = target[0] - p[0], dy = target[1] - p[1], dz = target[2] - p[2];
  return { yaw: Math.atan2(dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}
let droneAngle = 0.6;
function viewTarget(dt) {
  const v = VIEWS[state.view];
  // 視野角（縦）。縦長の画面では横の視野が狭くなりすぎないよう広げる
  const wantV = v.fov || 55, minH = v.fov ? 20 : 50;
  const needV = 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(minH / 2)) / camera.aspect));
  cam.tFov = Math.min(Math.max(wantV, needV), 75);
  if (v.orbit) {
    droneAngle += dt * 0.03;
    const a = droneAngle + cam.dragYaw;
    const R = 85, H = 38;
    cam.tPos.set(Math.sin(a) * R, H, Math.cos(a) * R);
    const l = lookFrom([cam.tPos.x, H, cam.tPos.z], [0, 0, 0]);
    cam.tYaw = l.yaw; cam.tPitch = l.pitch + cam.dragPitch;
  } else {
    cam.tPos.fromArray(v.pos);
    if (v.look) { const l = lookFrom(v.pos, v.look); cam.tYaw = l.yaw + cam.dragYaw; cam.tPitch = l.pitch + cam.dragPitch; }
    else { cam.tYaw = v.yaw + cam.dragYaw; cam.tPitch = v.pitch + cam.dragPitch; }
    // 人の目線の微かな揺れ
    if (state.view === 'aze' || state.view === 'north') cam.tPos.y += Math.sin(performance.now() / 2300) * 0.02;
  }
}
function setView(name, instant = false) {
  state.view = name;
  cam.dragYaw = 0; cam.dragPitch = 0;
  document.getElementById('btnView').textContent = msg.view(tr('view.' + name));
  viewTarget(0);
  if (instant) { cam.pos.copy(cam.tPos); cam.yaw = cam.tYaw; cam.pitch = cam.tPitch; cam.fov = cam.tFov; camera.fov = cam.fov; camera.updateProjectionMatrix(); }
}
let idleT = 0;
function updateCamera(dt) {
  // 見回したあと、しばらく触らなければ元のアングルにゆっくり戻る
  if (!pointer && !twoFinger) {
    idleT += dt;
    if (idleT > 4) { const d = Math.exp(-dt * 0.8); cam.dragYaw *= d; cam.dragPitch *= d; }
  } else idleT = 0;
  viewTarget(dt);
  const k = 1 - Math.exp(-dt * 2.2);
  cam.pos.lerp(cam.tPos, k);
  let dy = cam.tYaw - cam.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  cam.yaw += dy * k; cam.pitch += (cam.tPitch - cam.pitch) * k;
  cam.fov += (cam.tFov - cam.fov) * k;
  camera.position.copy(cam.pos);
  const dir = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), -Math.cos(cam.yaw) * Math.cos(cam.pitch));
  camera.lookAt(camera.position.clone().add(dir));
  if (Math.abs(camera.fov - cam.fov) > 0.01) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
}

// ---------- 天気（なめらかに移り変わる） ----------
const wx = { kind: 'clear', cover: 0.2, precip: 0, wind: 0.3, haze: 0.1 };
function weatherTarget(t) {
  const d = Math.floor(t) % 365;
  const w = state.started ? weatherOf(d, state.year) : { kind: 'clear', strength: 0.5 }; // タイトル画面は晴れ
  if (state.wxOverride) Object.assign(w, state.wxOverride);
  const hour = (t - Math.floor(t)) * 24;
  const T = { clear: [0.08, 0, 0.22, 0.05], cloudy: [0.72, 0, 0.35, 0.15], rain: [1, w.strength, 0.5, 0.35], snow: [0.95, w.strength, 0.3, 0.3] }[w.kind];
  // 朝霧（春と秋の晴れた朝）
  const { month } = monthDay(d);
  const mistSeason = (month >= 9 && month <= 11) || (month >= 4 && month <= 5) ? 1 : 0.3;
  const mist = w.kind === 'clear' || w.kind === 'cloudy' ? mistSeason * smooth(3, 4.5, hour) * (1 - smooth(6, 7.5, hour)) * 0.5 : 0;
  return { kind: w.kind, cover: T[0], precip: T[1], wind: T[2] * (0.7 + 0.6 * w.strength), haze: T[3] + mist };
}
function updateWeather(gdt, init = false) {
  const tg = weatherTarget(state.t);
  const k = init ? 1 : 1 - Math.exp(-gdt * 10);
  wx.cover += (tg.cover - wx.cover) * k;
  wx.precip += (tg.precip - wx.precip) * k;
  wx.wind += (tg.wind - wx.wind) * k;
  wx.haze += (tg.haze - wx.haze) * k;
  if (tg.kind === 'rain' || tg.kind === 'snow') wx.kind = tg.kind;
  else if (wx.precip < 0.05) wx.kind = tg.kind;
  return tg;
}

// ---------- UI ----------
const $ = (id) => document.getElementById(id);
const ui = {
  year: $('hudYear'), date: $('hudDate'), time: $('hudTime'), sub: $('hudSub'), stage: $('stageName'), note: $('stageNote'),
  bar: $('yearBar'), harvest: $('harvestPanel'), hPct: $('hPct'), hFill: $('hFill'), hKg: $('hKg'), hGrade: $('hGrade'),
  toast: $('toast'), pause: $('btnPause'), sound: $('btnSound'),
};
let toastTimer = 0;
function toast(html, sec = 6) {
  ui.toast.classList.remove('work');
  ui.toast.innerHTML = html;
  ui.toast.classList.add('show');
  toastTimer = sec;
}
function setSpeed(s) {
  // プレイ中は常に1倍速。動作確認用にだけ内部で変更できる
  state.speed = s;
}
function updateHUD(tg) {
  const d = Math.floor(state.t) % 365;
  const hour = (state.t - Math.floor(state.t)) * 24;
  const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60 / 10) * 10;
  ui.year.textContent = msg.yearDay(state.year, d + 1);
  { const md = monthDay(d); ui.date.textContent = fmtDate(md.month, md.day, new Date(state.calYear || 2026, md.month - 1, md.day).getDay()); }
  ui.time.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  ui.sub.textContent = `${sekkiText(sekki(d))} ・ ${tr('wx.' + tg.kind)}`;
  ui.bar.style.width = ((state.t % 365) / 365 * 100).toFixed(2) + '%';
  const st = stageText(stageOf(d));
  if (st.name !== state.lastStage) {
    const first = state.lastStage === '';
    state.lastStage = st.name;
    ui.stage.textContent = st.name;
    ui.note.textContent = st.note;
    // 季節の説明は左下のカードだけで静かに知らせる（読むだけ）
    if (!first) { const c = $('stageCard'); c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash'); }
  }
  // 作業パネル（稲刈り、またはその時期の農作業）
  const inHarvest = field.isHarvestable(state.t) && !state.finalized;
  const evs = state.started ? farm.active(state.t % 365) : [];
  const work = evs.filter(e => e.id !== 'bird');
  const bird = evs.find(e => e.id === 'bird');
  const show = inHarvest || evs.length > 0;
  ui.harvest.classList.toggle('show', show);
  document.body.classList.toggle('harvest-season', show);
  if (inHarvest) {
    const pct = field.countCutCached / TOTAL * 100;
    $('hLabel').textContent = tr('harvest.cut');
    ui.hPct.textContent = Math.floor(pct) + '%';
    ui.hFill.style.width = pct + '%';
    ui.hKg.textContent = msg.kg(state.harvestKg);
    ui.hGrade.textContent = msg.gradeNow(grade(harvestQuality(state.t) * farm.factors().bugQ)) + (bird ? '　' + msg.birdLine(farm.progress('bird')) : '');
    $('swipeHint').textContent = tr('harvest.hint');
  } else if (work.length || bird) {
    const ev = work[0] || bird;
    const p = farm.progress(ev.id, state.t % 365);
    const info = msg.work(ev.id, p, state.t % 365, ev);
    $('hLabel').textContent = info.label;
    ui.hPct.textContent = info.value;
    ui.hFill.style.width = (info.ratio * 100).toFixed(1) + '%';
    ui.hKg.textContent = info.right;
    ui.hGrade.textContent = info.sub;
    $('swipeHint').textContent = info.hint;
  }
}

// ---------- 刈り取り（スワイプ） ----------
const ray = new THREE.Raycaster();
const cutPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.45);
const trail = [];
let pointer = null;
function groundPoint(e) {
  const r = canvas.getBoundingClientRect();
  const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(v, camera);
  const p = new THREE.Vector3();
  return ray.ray.intersectPlane(cutPlane, p) ? p : null;
}
let lastSwish = 0;
// 遠くの稲ほど指の太さが広い範囲に当たる
const swipeRadius = (b) => clamp(camera.position.distanceTo(b) * 0.045, 0.9, 3);
function doWork(a, b) {
  const n = farm.swipe(a, b, swipeRadius(b), state.t % 365);
  const now = performance.now();
  if (n && now - lastSwish > 90) lastSwish = now; // 効果音と振動は作業ごとに farmwork 側で
}
function doCut(a, b) {
  if (!field.isHarvestable(state.t) || state.finalized) return;
  const r = swipeRadius(b);
  const ids = field.cutAlong(a.x, a.z, b.x, b.z, r);
  if (!ids.length) return;
  const F = farm.factors();
  const q = harvestQuality(state.t) * F.bugQ;
  state.harvestKg += ids.length * KG_PER_HILL * harvestQuality(state.t) * F.yieldF;
  state.harvestQ = (state.harvestQ * (field.countCutCached) + q * ids.length) / (field.countCutCached + ids.length);
  field.countCutCached += ids.length;
  for (let i = 0; i < ids.length; i += 3) fx.burst(field.hx[ids[i]], field.hz[ids[i]], 2);
  const now = performance.now();
  if (now - lastSwish > 70) { audio.swish(Math.min(1, ids.length / 20 + 0.4)); lastSwish = now; buzz('harvest'); }
  // ほぼ刈り終えたら（畦ぎわの取り残し数株は手刈りしたことにして）収穫完了
  if (field.countCutCached >= TOTAL * 0.995) {
    const rest = field.cutRemaining();
    if (rest) { const q2 = harvestQuality(state.t); state.harvestKg += rest * KG_PER_HILL * q2 * farm.factors().yieldF; field.countCutCached += rest; }
    finalizeHarvest(false);
  }
}
// 指の操作：1本指は田んぼの作業（なぞる）だけ。見回しは2本指（マウスはドラッグで見回し）
const touches = new Map();   // 画面に触れている指
let twoFinger = null;        // 2本指で見回し中のときの、前回の2本の中点
function lookBy(dx, dy) {
  const k = cam.fov / 55; // 望遠ほどゆっくり回す
  const tele = (VIEWS[state.view].fov || 55) < 30; // 望遠では足元をのぞき込みすぎないように
  cam.dragYaw -= dx * 0.004 * k;
  cam.dragPitch = clamp(cam.dragPitch + dy * 0.003 * k, tele ? -0.1 : -0.7, tele ? 0.3 : 0.7);
  cam.yaw -= dx * 0.004 * k; cam.pitch += dy * 0.003 * k; // すぐ反応させる
}
const midpoint = () => { let x = 0, y = 0; touches.forEach(p => { x += p.x; y += p.y; }); return { x: x / touches.size, y: y / touches.size }; };
canvas.addEventListener('pointerdown', (e) => {
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 端末によっては失敗する */ }
  if (e.pointerType === 'touch') {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size >= 2) { pointer = null; twoFinger = midpoint(); return; } // 2本目の指：作業をやめて見回しへ
  }
  const g = groundPoint(e);
  // 作業の期間に田んぼの上から始めたスワイプは「作業」、それ以外は（マウスなら）見回し
  const onField = g && Math.abs(g.x) < FIELD_W / 2 && Math.abs(g.z) < FIELD_D / 2;
  const harvesting = !!(field.isHarvestable(state.t) && !state.finalized);
  const working = state.started && farm.active(state.t % 365).length > 0;
  const onHouse = working && farm.rayTest(ray, state.t % 365); // ハウスの雪下ろしは屋根をなぞる
  const cutting = !!((onField || onHouse) && (harvesting || working));
  pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, g, cutting, touch: e.pointerType === 'touch' };
  if (cutting) trail.push({ x: e.clientX, y: e.clientY, t: performance.now() });
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (twoFinger && touches.size >= 2) {
      const m = midpoint();
      lookBy(m.x - twoFinger.x, m.y - twoFinger.y);
      twoFinger = m;
      return;
    }
  }
  if (!pointer || pointer.id !== e.pointerId) return;
  if (pointer.cutting) {
    const g = groundPoint(e);
    farm.rayHit(ray, state.t % 365);
    if (g && pointer.g) {
      // 細かく分割して取りこぼしを防ぐ
      const steps = Math.ceil(pointer.g.distanceTo(g) / 0.5);
      let prev = pointer.g;
      for (let s = 1; s <= steps; s++) { const p = pointer.g.clone().lerp(g, s / steps); doCut(prev, p); doWork(prev, p); prev = p; }
    }
    pointer.g = g;
    trail.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  } else if (!pointer.touch) {
    lookBy(e.clientX - pointer.x, e.clientY - pointer.y); // マウスのドラッグ
  }
  pointer.x = e.clientX; pointer.y = e.clientY;
});
const endPtr = (e) => {
  touches.delete(e.pointerId);
  if (touches.size < 2) twoFinger = null;
  if (pointer && pointer.id === e.pointerId) pointer = null;
};
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', endPtr);

const trailCv = $('trail'), tctx = trailCv.getContext('2d');
function drawTrail() {
  const now = performance.now();
  while (trail.length && now - trail[0].t > 280) trail.shift();
  tctx.clearRect(0, 0, trailCv.width, trailCv.height);
  if (trail.length < 2) return;
  const dpr = trailCv.width / innerWidth;
  tctx.lineCap = 'round'; tctx.lineJoin = 'round';
  for (let i = 1; i < trail.length; i++) {
    const a = 1 - (now - trail[i].t) / 280;
    tctx.strokeStyle = `rgba(255,248,220,${(a * 0.7).toFixed(3)})`;
    tctx.lineWidth = (2 + a * 7) * dpr;
    tctx.beginPath();
    tctx.moveTo(trail[i - 1].x * dpr, trail[i - 1].y * dpr);
    tctx.lineTo(trail[i].x * dpr, trail[i].y * dpr);
    tctx.stroke();
  }
}

let lastRec = null, rewardOpen = false;
// ---- リワード広告：稲刈りの期限が来たとき、広告を見ると3日延ばせる（1年に1回） ----
function offerHarvestReward(left) {
  state.rewardAsked = true;
  rewardOpen = true;
  state.paused = true;
  // 倒れかけた田んぼを見届けてから案内を出す
  setTimeout(() => {
    $('rewardText').textContent = msg.rewardText(Math.ceil(left * 100));
    $('rewardAsk').classList.add('show');
    let sec = 8;
    $('rewardCount').textContent = ` ${sec}`;
    const timer = setInterval(() => { sec--; $('rewardCount').textContent = ` ${sec}`; if (sec <= 0) done(false); }, 1000);
    async function done(watch) {
      clearInterval(timer);
      if (!$('rewardAsk').classList.contains('show')) return;
      $('rewardAsk').classList.remove('show');
      const r = watch ? await Ads.showRewarded() : 'skipped';
      rewardOpen = false;
      if (r === 'rewarded') {
        state.harvestExtra = (state.harvestExtra || 0) + 3;
        state.extendUsed = (state.extendUsed || 0) + 1;
        field.setHarvestExtra(state.harvestExtra);
        toast(msg.extended(state.extendUsed), 5);
      } else {
        finalizeHarvest(true);
      }
      state.paused = false;
      ui.pause.textContent = '❚❚';
    }
    $('btnRewardYes').onclick = () => done(true);
    $('btnRewardNo').onclick = () => done(false);
  }, 2500);
}

function finalizeHarvest(late) {
  if (state.finalized) return;
  state.finalized = true;
  let lost = 0;
  if (late) lost = field.lodgeRemaining();
  field.update(state.t, true);
  const birdLoss = Math.min(state.harvestKg * 0.5, farm.rec.bird.lostKg);
  state.harvestKg = Math.max(0, state.harvestKg - birdLoss);
  const kg = state.harvestKg;
  const rec = { year: state.year, kg: Math.round(kg), grade: kg > 0 ? grade(state.harvestQ) : '—', rate: Math.round(field.countCutCached / TOTAL * 100), ext: state.extendUsed || 0 };
  lastRec = rec;
  rec.work = msg.workSummary(farm.rec, farm.factors(), birdLoss, farm.WEEDS);
  state.records = state.records.filter(r => r.year !== state.year).concat(rec);
  audio.chime();
  showResult(rec, lost);
  save();
}
function showResult(rec, lost) {
  const bowls = Math.round(rec.kg * 0.9 * 1000 / 65); // 精米歩留まり90%、ごはん1杯=精米65g
  $('resultBody').innerHTML = msg.result(rec, bowls, lost ? Math.round(lost / TOTAL * 100) : 0) + (rec.ext ? `<p class="note">${msg.extended(rec.ext)}</p>` : '') + (rec.work || '');
  $('result').classList.add('show');
}

// ---------- 農作業イベントの開始カード：時間を止めて、やることをはっきり伝える ----------
let evPausedBefore = false;
function showEventCard(id, ev) {
  const c = msg.workCard(id, ev);
  $('evTitle').textContent = c.name;
  $('evTodo').textContent = c.todo;
  $('evEffect').textContent = c.eff;
  $('evWhen').textContent = c.when;
  const open = $('eventCard').classList.contains('show');
  if (!open) evPausedBefore = state.paused;   // 2枚続けて開いても、元の一時停止状態を覚えておく
  state.paused = true;
  ui.pause.textContent = '▶';
  $('eventCard').classList.add('show');
  buzz('start');
  ui.toast.classList.remove('show');
  audio.chime();
}
$('btnEvStart').onclick = () => {
  $('eventCard').classList.remove('show');
  state.paused = evPausedBefore;
  ui.pause.textContent = state.paused ? '▶' : '❚❚';
};

// 時間の進み方：日が出ている間はゆっくり（×0.5）、夜は速く（×2）。薄明でなめらかに切り替え
function dayRate(t) {
  const el = sunPosition(t % 365).el;
  return 2 + (0.5 - 2) * smooth(-0.1, 0.05, Math.sin(el));
}

// ---------- ループ ----------
let lastT = performance.now(), time = 0, seasonTimer = 0, lastSeasonDay = -1, lastLayoutQ = -1;
const windDir = new THREE.Vector2(0.8, 0.6);
let tg = weatherTarget(state.t);

function newYear() {
  state.t -= 365;
  state.year++;
  state.calYear = (state.calYear || 2026) + 1;
  state.harvestKg = 0; state.harvestQ = 0; state.finalized = false; state.harvestPrompted = false;
  state.harvestExtra = 0; state.extendUsed = 0; state.rewardAsked = false; field.setHarvestExtra(0);
  field.resetYear(); field.countCutCached = 0; farm.reset();
  field.update(state.t, true);
  const last = state.records[state.records.length - 1];
  toast(msg.newYear(state.year, last), 8);
}

// 動きが重いときは描画の解像度を少し下げ、余裕があれば戻す（スマートフォンでもなめらかに）
let perfT = 0, perfN = 0, curPR = Q.pr;
function adaptResolution(dt) {
  perfT += dt; perfN++;
  if (perfT < 2) return;
  const avg = perfT / perfN; perfT = 0; perfN = 0;
  let next = curPR;
  if (avg > 1 / 40 && curPR > 0.6) next = Math.max(0.6, curPR - 0.1);
  else if (avg < 1 / 55 && curPR < Q.pr) next = Math.min(Q.pr, curPR + 0.1);
  if (next !== curPR) { curPR = next; renderer.setPixelRatio(curPR); renderer.setSize(innerWidth, innerHeight); }
}
function frame(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  time += dt;
  let gdt = 0;
  if (state.started && !state.paused) {
    gdt = dt * state.speed / 60 * dayRate(state.t);
    const before = state.t;
    state.t += gdt;
    // 稲刈りの季節に入ったら等速に戻す
    if (before < HARVEST_START && state.t >= HARVEST_START && !state.finalized) {
      if (state.speed > 1) setSpeed(1);
      if (!state.harvestPrompted) {
        state.harvestPrompted = true;
        showEventCard('harvest', { start: HARVEST_START, end: HARVEST_END });
      }
    }
    const hEnd = HARVEST_END + (state.harvestExtra || 0);
    if (state.t >= hEnd && state.t < 365 && !state.finalized) {
      // 刈り残しがあれば、広告を見て期限を延ばすかをたずねる（1年に1回）
      const left = 1 - field.countCutCached / TOTAL;
      if (Ads.canReward && !state.rewardAsked && left > 0.005) offerHarvestReward(left);
      else if (!rewardOpen) finalizeHarvest(true);
    }
    // 保存データなどで刈り取りがほぼ終わっているのに完了していない場合
    if (!state.finalized && field.isHarvestable(state.t) && field.countCutCached >= TOTAL * 0.995) {
      const rest = field.cutRemaining();
      if (rest) { state.harvestKg += rest * KG_PER_HILL * harvestQuality(state.t); field.countCutCached += rest; }
      finalizeHarvest(false);
    }
    if (state.t >= 365) newYear();
  }
  const t = state.t;
  const day = Math.floor(t);
  tg = updateWeather(gdt);
  {
    const fr = farm.update(dt, t % 365, time, { running: state.started && !state.paused, harvestDone: state.finalized, wx, gdt, day: lastDay });
    if (state.started) for (const e of fr.events) { toast(msg.workEvent(e, farm.rec), 8); ui.toast.classList.add('work'); }
    if (state.started) for (const ev of fr.started) {
      if (ev.id === 'bird' && state.finalized) continue;
      if (state.speed > 1) setSpeed(1);
      showEventCard(ev.id, ev);
    }
  }

  // 季節更新（重いので間引く）
  seasonTimer -= dt;
  if (day !== lastSeasonDay && seasonTimer <= 0) {
    lastSeasonDay = day; seasonTimer = 0.35;
    land.updateSeason(t);
    flowers.update(t % 365);
  }
  const q = Math.floor(t * 8);
  if (q !== lastLayoutQ) { lastLayoutQ = q; field.update(t); }

  // 太陽・月・空
  const sp = sunPosition(t % 365), mp = moonPosition(t % 365, state.year + 2025);
  updateCamera(dt);
  const light = land.updateSky(sp, mp, wx, dt, time, camera);
  lastDay = light.day;
  // 本物の星空：日付と時刻から福島（北緯37.5°・東経139.9°）の空を計算
  {
    const se = Math.sin(sp.el);
    starSky.update({ year: state.calYear || new Date().getFullYear(), t: t % 365, lonDeg: 139.9, time, camera,
      dark: 1 - smooth(-0.2, -0.04, se), cover: wx.cover, moon: light.moonUp, px: renderer.getPixelRatio() });
  }

  // 風
  const wa = Math.sin(time * 0.05) * 0.6 + 0.6;
  windDir.set(Math.cos(wa), Math.sin(wa));
  const wind = wx.wind * (0.8 + 0.4 * Math.sin(time * 0.13));
  field.tick(time, wind, windDir, light.sunDir, camera, light.sunVis);
  land.railway.update(dt, (t % 1) * 24, light.day);
  {
    // 電車の音：カメラからの距離と左右の位置
    const rw = land.railway, dx = rw.x - camera.position.x, dz = rw.z - camera.position.z;
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const len = Math.hypot(dx, dz) || 1;
    audio.train(rw.x, len, (dx * right.x + dz * right.z) / len, rw.running && !state.paused, rw.SPEED);
  }
  // 夕方のチャイム（4〜9月は18時、それ以外は17時）
  if (state.started && !state.paused && state.speed <= 10) {
    const { month } = monthDay(Math.floor(t) % 365);
    const ch = (month >= 4 && month <= 9 ? 18 : 17) / 24;
    const prev = t - gdt;
    if (Math.floor(prev) === Math.floor(t) && (prev % 1) < ch && (t % 1) >= ch) audio.yuyake();
  }
  fx.update(dt, time, t % 365, wx, light, camera, windDir);
  audio.update(t % 365, (t % 1) * 24, wx, light);

  renderer.render(scene, camera);
  if (!MANUAL) adaptResolution(dt);
  drawTrail();
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) ui.toast.classList.remove('show'); }
  hudTimer -= dt;
  if (hudTimer <= 0) { hudTimer = 0.2; updateHUD(tg); }
  if (!MANUAL) requestAnimationFrame(frame);
}
let MANUAL = false;
// web-only:start
// 動作確認用：?manual で自動ループを止め、__suiden.step() で1フレームずつ進める（アプリには入れない）
MANUAL = new URLSearchParams(location.search).has('manual');
// web-only:end
let hudTimer = 0, lastDay = 1;

// ---------- 開始 ----------
function startGame(opt) {
  const saved = opt === 'continue' ? load() : null;
  const now = new Date();
  if (saved) {
    Object.assign(state, { year: saved.year, t: saved.t, harvestKg: saved.harvestKg, harvestQ: saved.harvestQ || 0, finalized: saved.finalized, records: saved.records || [], harvestPrompted: !!saved.harvestPrompted, calYear: saved.calYear || now.getFullYear() });
    Object.assign(state, { harvestExtra: saved.harvestExtra || 0, extendUsed: saved.extendUsed || 0, rewardAsked: !!saved.rewardAsked });
    field.setHarvestExtra(state.harvestExtra);
    field.deserialize(saved.cut); field.deserializeWork(saved.work); farm.reset(); farm.deserialize(saved.farm); farm.skipPast(saved.t % 365);
    setSpeed(1);
    setView(VIEWS[saved.view] ? saved.view : 'aze', true);
  } else {
    const starts = {
      today: doyOf(now.getMonth() + 1, Math.min(now.getDate(), 28 + (now.getMonth() === 1 ? 0 : 3))) + 6 / 24,
      spring: doyOf(4, 20) + 5 / 24, harvest: doyOf(9, 19) + 5 / 24, jan: 0 + 6 / 24,
    };
    state.t = starts[opt] ?? starts.today;
    state.calYear = now.getFullYear();
    state.year = 1; state.records = []; state.harvestKg = 0; state.harvestQ = 0;
    field.resetYear(); farm.reset(); farm.skipPast(state.t % 365);
    // 稲刈り期間を過ぎてから始めた場合は刈り取り済みの田んぼにする
    state.finalized = state.t >= HARVEST_END && state.t >= PLANT_START;
    state.harvestPrompted = state.t >= HARVEST_START;
    if (state.finalized) field.cut.fill(1);
    setSpeed(1);
    setView('aze', true);
  }
  field.countCutCached = field.countCut();
  updateWeather(0, true);
  field.update(state.t, true);
  land.updateSeason(state.t); flowers.update(state.t % 365);
  state.started = true;
  // 作業期間の途中から始めたときも、やることをはっきり見せる
  setTimeout(() => {
    const t0 = state.t % 365;
    if ($('eventCard').classList.contains('show')) return;
    if (field.isHarvestable(t0) && !state.finalized) showEventCard('harvest', { start: HARVEST_START, end: HARVEST_END });
    else { const act = farm.active(t0)[0]; if (act) showEventCard(act.id, act); }
  }, 600);
  state.lastStage = '';
  $('start').classList.remove('show');
  document.body.classList.remove('title');
  audio.init();
  ui.sound.textContent = tr('sound.on');
  updateHUD(weatherTarget(state.t));
  save();
}

// ボタン
// ---- 画面の切り替えと広告 ----
// バナー：タイトル・あそびかた・一時停止・結果の画面だけ。全画面広告：プレイ開始・タイトルに戻る・再開・結果から田んぼへ戻る、のたびに毎回
const shown = (id) => $(id).classList.contains('show');
function syncBanner() {
  const on = shown('start') || shown('howto') || shown('menu') || shown('result');
  Ads.setBanner(on);
  document.body.classList.toggle('has-banner', on && Ads.available);
}
new MutationObserver(syncBanner).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
let pausedBeforeMenu = false;
function openPause() {
  if (!state.started || shown('menu')) return;
  pausedBeforeMenu = state.paused;
  state.paused = true;
  ui.pause.textContent = '▶';
  renderRecords();
  $('menu').classList.add('show');
}
async function resumeFromPause() {
  $('menu').classList.remove('show');
  try { await Ads.showInterstitial(3000); } catch (e) { /* 続ける */ }
  state.paused = shown('eventCard') || shown('rewardAsk') ? true : false;
  ui.pause.textContent = state.paused ? '▶' : '❚❚';
}
async function backToTitle() {
  save();
  try { await Ads.showInterstitial(3000); } catch (e) { /* 続ける */ }
  location.reload(); // タイトル画面（「つづきから」）に戻る
}
async function playFromTitle(opt) {
  // ゲームはすぐに始め、全画面広告はそのあとに出す（広告の読み込みが遅くても、ボタンが効かないように見えないため）
  startGame(opt);
  const was = state.paused;
  state.paused = true;
  try { await Ads.showInterstitial(3000); } catch (e) { /* 広告が出せなくても続ける */ }
  if (!shown('eventCard') && !shown('rewardAsk') && !shown('menu')) state.paused = was;
}
let howtoFrom = 'start';
function openHowto(from) { howtoFrom = from; $('howto').classList.add('show'); }
$('btnHowto').onclick = () => openHowto('start');
$('btnPauseHowto').onclick = () => { $('menu').classList.remove('show'); openHowto('menu'); };
$('btnHowtoBack').onclick = async () => {
  $('howto').classList.remove('show');
  if (howtoFrom === 'menu') $('menu').classList.add('show');
  else await Ads.showInterstitial(3000); // あそびかた → タイトルに戻る
};
$('btnHowtoPlay').onclick = async () => {
  $('howto').classList.remove('show');
  if (howtoFrom === 'menu') { await resumeFromPause(); return; }
  playFromTitle(load() ? 'continue' : 'today');
};
$('btnToTitle').onclick = backToTitle;
$('btnResultTitle').onclick = () => { $('result').classList.remove('show'); backToTitle(); };
$('btnShare').onclick = () => shareResult(lastRec);
async function shareResult(rec) {
  if (!rec) return;
  const text = msg.shareText(rec);
  const share = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
  try {
    if (native && share) await share.share({ text, dialogTitle: tr('share') });
    else if (navigator.share) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); toast(LANG === 'ja' ? '結果をコピーしました' : 'Copied the result', 3); }
  } catch (e) { /* 共有をやめた */ }
}
$('btnPause').onclick = () => { if (shown('menu')) resumeFromPause(); else openPause(); };
// 再生スピードは常に等速（プレイ画面では変更できない）
$('btnView').onclick = () => {
  const order = VIEW_ORDER;
  const i = order.indexOf(state.view);
  setView(order[(i + 1) % order.length]);
};
$('btnSound').onclick = () => { const on = audio.toggle(); ui.sound.textContent = tr(on ? 'sound.on' : 'sound.off'); };
$('btnCloseMenu').onclick = resumeFromPause;
$('btnCloseResult').onclick = async () => { $('result').classList.remove('show'); await Ads.showInterstitial(3000); }; // 結果 → 田んぼへ（次の年へ）
$('btnQuality').textContent = msg.quality(Q.name);
$('btnLang').textContent = tr('menu.lang');
$('btnLang').onclick = () => { save(); setLang(LANG === 'ja' ? 'en' : 'ja'); };
$('btnQuality').onclick = () => { save(); localStorage.setItem('suiden365.quality', qKey === 'high' ? 'low' : 'high'); location.reload(); };
$('btnReset').onclick = () => {
  if (!confirm(msg.confirmReset())) return;
  localStorage.removeItem(SAVE_KEY); location.reload();
};
function renderRecords() {
  $('records').innerHTML = state.records.length
    ? state.records.map(msg.recordRow).join('')
    : `<tr><td colspan="4">${msg.noRecords()}</td></tr>`;
}
document.querySelectorAll('[data-start]').forEach(b => (b.onclick = () => {
  if (b.dataset.start === 'today' && load() && !confirm(msg.confirmNewGame())) return;
  playFromTitle(b.dataset.start);
}));
if (load()) {
  // 続きがあるときは「つづきから」を主ボタンに。今日から始め直すときは確認する
  $('btnContinue').hidden = false;
  $('btnToday').classList.remove('primary');
  const recs = (load().records || []).filter(r => r.kg > 0);
  if (recs.length) { const b = recs.reduce((a, r) => (r.kg > a.kg ? r : a)); $('bestRecord').textContent = msg.best(b); $('bestRecord').hidden = false; }
}
$('appVersion').textContent = window.APP_VERSION || 'dev';
Ads.initDone.then(() => { if (Ads.privacyOptionsRequired) $('adPrivacy').hidden = false; });
$('adPrivacyLink').addEventListener('click', (e) => { e.preventDefault(); Ads.showPrivacyOptions(); });
syncBanner();
{
  const now = new Date();
  $('todayLabel').textContent = fmtMonthDay(now.getMonth() + 1, now.getDate());
  applyStatic();
  $('btnPause').title = tr('btn.pause');
}
addEventListener('keydown', (e) => {
  if (e.key === ' ' && state.started) $('btnPause').click();
  if (e.key === 'v') $('btnView').click();
});
// 別のアプリに切り替えたら自動で一時停止し、音も止める
addEventListener('visibilitychange', () => {
  if (document.hidden) {
    save();
    if (state.started && !shown('menu') && !shown('result') && !shown('eventCard') && !shown('rewardAsk')) openPause();
    audio.suspend();
  } else audio.resume();
});
// Android の戻るボタン：プレイ中は一時停止、一時停止中は再開、タイトルではアプリを終了
if (native && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
  const App = window.Capacitor.Plugins.App;
  App.addListener('backButton', () => {
    if (Ads.showing) return;
    if (shown('howto')) { $('btnHowtoBack').click(); return; }
    if (shown('rewardAsk')) { $('btnRewardNo').click(); return; }
    if (shown('eventCard')) { $('btnEvStart').click(); return; }
    if (shown('result')) { $('btnCloseResult').click(); return; }
    if (shown('start') || !state.started) { App.exitApp(); return; }
    if (shown('menu')) resumeFromPause(); else openPause();
  });
}
setInterval(save, 5000);

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  trailCv.width = innerWidth * devicePixelRatio; trailCv.height = innerHeight * devicePixelRatio;
}
addEventListener('resize', resize);
resize();

// タイトル画面の背景として景色を流しておく
field.countCutCached = 0;
setView('aze', true);
setSpeed(1);
updateWeather(0, true);
field.update(state.t, true);
land.updateSeason(state.t); flowers.update(state.t % 365);
state.t = doyOf(5, 19) + 16.9 / 24; // 水鏡の夕方
if (!MANUAL) requestAnimationFrame(frame);
// 準備ができたら、タイトル画面のボタンを押せるようにする
document.body.classList.remove('loading');
// web-only:start
window.__suiden = {
  state, field, setView, setSpeed, startGame, wx, land, scene, camera, renderer, farm,
  step(n = 1, dtMs = 1000 / 30) { for (let i = 0; i < n; i++) frame(lastT + dtMs); },
  refresh() { land.updateSeason(state.t); flowers.update(state.t % 365); field.update(state.t, true); updateWeather(0, true); hudTimer = 0; lastSeasonDay = Math.floor(state.t); },
};
// web-only:end
