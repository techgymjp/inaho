import * as THREE from 'three';
import { createLandscape } from './landscape.js';
import { createField, FIELD_W, FIELD_D, TOTAL, KG_PER_HILL } from './field.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import {
  dateLabel, monthDay, sekki, stageOf, sunPosition, moonPosition, weatherOf, WEATHER_LABEL, doyOf,
  HARVEST_START, HARVEST_END, harvestQuality, grade, smooth, clamp, PLANT_START,
} from './calendar.js';

// ---------- 画質 ----------
const isMobile = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad/.test(navigator.userAgent);
const QUALITY = {
  high: { name: '高', shadow: 2048, reflect: 1024, blades: 10, bladeSegs: 3, ears: 4, earSegs: 5, trees: 14000, terrainSeg: 320, grass: 7000, pr: Math.min(devicePixelRatio, 2) },
  low: { name: '軽量', shadow: 1024, reflect: 384, blades: 5, bladeSegs: 2, ears: 3, earSegs: 3, trees: 6000, terrainSeg: 200, grass: 2500, pr: Math.min(devicePixelRatio, 1.25) },
};
const qKey = localStorage.getItem('suiden365.quality') || (isMobile ? 'low' : 'high');
const Q = QUALITY[qKey] || QUALITY.high;

// ---------- レンダラ ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Q.pr);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.15, 60000);

const land = createLandscape(scene, renderer, Q);
const field = createField(scene, Q);
const fx = createEffects(scene);
const audio = createAudio();

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
      finalized: state.finalized, records: state.records, cut: field.serialize(), view: state.view, harvestPrompted: state.harvestPrompted,
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
  aze: { label: '畦道', pos: [7.5, 1.55, 27.6], yaw: 0.02, pitch: -0.05 },
  drone: { label: '空から', orbit: true },
  yama: { label: '里山', pos: [-190, 62, 175], look: [0, 0, 0] },
  north: { label: '水路', pos: [-14, 1.4, -28.2], yaw: Math.PI * 0.82, pitch: -0.04 },
  harvest: { label: '稲刈り', harvest: true },
};
const VIEW_ORDER = ['aze', 'drone', 'yama', 'north'];
function lookFrom(p, target) {
  const dx = target[0] - p[0], dy = target[1] - p[1], dz = target[2] - p[2];
  return { yaw: Math.atan2(dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}
let droneAngle = 0.6;
function viewTarget(dt) {
  const v = VIEWS[state.view];
  cam.tFov = 55;
  if (v.orbit) {
    droneAngle += dt * 0.03;
    const a = droneAngle + cam.dragYaw;
    const R = 85, H = 38;
    cam.tPos.set(Math.sin(a) * R, H, Math.cos(a) * R);
    const l = lookFrom([cam.tPos.x, H, cam.tPos.z], [0, 0, 0]);
    cam.tYaw = l.yaw; cam.tPitch = l.pitch + cam.dragPitch;
  } else if (v.harvest) {
    const pitch = -0.95;
    cam.tFov = 50;
    const vf = THREE.MathUtils.degToRad(cam.tFov) / 2;
    const hf = Math.atan(Math.tan(vf) * camera.aspect);
    const dW = (FIELD_W * 0.5 + 1) / Math.tan(hf) + 4;
    const dD = (FIELD_D * 0.55) / Math.tan(vf) * Math.sin(-pitch) + 6;
    const D = Math.max(dW, dD, 30);
    cam.tPos.set(0, Math.sin(-pitch) * D, Math.cos(pitch) * D + 2);
    cam.tYaw = 0; cam.tPitch = pitch;
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
  document.getElementById('btnView').textContent = '視点：' + VIEWS[name].label;
  document.body.classList.toggle('harvest-view', name === 'harvest');
  viewTarget(0);
  if (instant) { cam.pos.copy(cam.tPos); cam.yaw = cam.tYaw; cam.pitch = cam.tPitch; }
}
function updateCamera(dt) {
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
  toast: $('toast'), speed: $('btnSpeed'), pause: $('btnPause'), sound: $('btnSound'),
};
let toastTimer = 0;
function toast(html, sec = 6) {
  ui.toast.innerHTML = html;
  ui.toast.classList.add('show');
  toastTimer = sec;
}
function setSpeed(s) {
  state.speed = s;
  ui.speed.textContent = '×' + s;
  ui.speed.title = s === 1 ? '1日＝1分' : `1日＝${(60 / s).toFixed(s >= 600 ? 1 : 0)}秒`;
}
function updateHUD(tg) {
  const d = Math.floor(state.t) % 365;
  const hour = (state.t - Math.floor(state.t)) * 24;
  const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60 / 10) * 10;
  ui.year.textContent = `${state.year}年目 ・ ${d + 1}日目`;
  ui.date.textContent = dateLabel(d, state.calYear || 2026);
  ui.time.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  ui.sub.textContent = `${sekki(d)} ・ ${WEATHER_LABEL[tg.kind]}`;
  ui.bar.style.width = ((state.t % 365) / 365 * 100).toFixed(2) + '%';
  const st = stageOf(d);
  if (st.name !== state.lastStage) {
    const first = state.lastStage === '';
    state.lastStage = st.name;
    ui.stage.textContent = st.name;
    ui.note.textContent = st.note;
    if (!first) toast(`<b>${st.name}</b><br>${st.note}`);
  }
  // 稲刈りパネル
  const inHarvest = field.isHarvestable(state.t) && !state.finalized;
  ui.harvest.classList.toggle('show', inHarvest || state.view === 'harvest');
  const n = field.countCutCached;
  const pct = n / TOTAL * 100;
  ui.hPct.textContent = pct.toFixed(0) + '%';
  ui.hFill.style.width = pct + '%';
  ui.hKg.textContent = `${Math.round(state.harvestKg).toLocaleString()} kg（${(state.harvestKg / 60).toFixed(1)}俵）`;
  const q = harvestQuality(state.t);
  ui.hGrade.textContent = inHarvest ? `いま刈ると：${grade(q)}` : '';
  document.body.classList.toggle('harvest-season', inHarvest);
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
function doCut(a, b) {
  if (!field.isHarvestable(state.t) || state.finalized) return;
  const ids = field.cutAlong(a.x, a.z, b.x, b.z, 0.75);
  if (!ids.length) return;
  const q = harvestQuality(state.t);
  state.harvestKg += ids.length * KG_PER_HILL * q;
  state.harvestQ = (state.harvestQ * (field.countCutCached) + q * ids.length) / (field.countCutCached + ids.length);
  field.countCutCached += ids.length;
  for (let i = 0; i < ids.length; i += 3) fx.burst(field.hx[ids[i]], field.hz[ids[i]], 2);
  const now = performance.now();
  if (now - lastSwish > 70) { audio.swish(Math.min(1, ids.length / 20 + 0.4)); lastSwish = now; if (navigator.vibrate) navigator.vibrate(8); }
  if (field.countCutCached >= TOTAL) finalizeHarvest(false);
}
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, g: groundPoint(e) };
  if (state.view === 'harvest') trail.push({ x: e.clientX, y: e.clientY, t: performance.now() });
});
canvas.addEventListener('pointermove', (e) => {
  if (!pointer || pointer.id !== e.pointerId) return;
  if (state.view === 'harvest') {
    const g = groundPoint(e);
    if (g && pointer.g) {
      // 細かく分割して取りこぼしを防ぐ
      const steps = Math.ceil(pointer.g.distanceTo(g) / 0.5);
      let prev = pointer.g;
      for (let s = 1; s <= steps; s++) { const p = pointer.g.clone().lerp(g, s / steps); doCut(prev, p); prev = p; }
    }
    pointer.g = g;
    trail.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  } else {
    const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
    cam.dragYaw -= dx * 0.004; cam.dragPitch = clamp(cam.dragPitch + dy * 0.003, -0.7, 0.7);
    cam.yaw -= dx * 0.004; cam.pitch += dy * 0.003; // すぐ反応させる
  }
  pointer.x = e.clientX; pointer.y = e.clientY;
});
const endPtr = (e) => { if (pointer && pointer.id === e.pointerId) pointer = null; };
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

function finalizeHarvest(late) {
  if (state.finalized) return;
  state.finalized = true;
  let lost = 0;
  if (late) lost = field.lodgeRemaining();
  field.update(state.t, true);
  const kg = state.harvestKg;
  const rec = { year: state.year, kg: Math.round(kg), grade: kg > 0 ? grade(state.harvestQ) : '—', rate: Math.round(field.countCutCached / TOTAL * 100) };
  state.records = state.records.filter(r => r.year !== state.year).concat(rec);
  audio.chime();
  showResult(rec, lost);
  if (state.view === 'harvest') setView('aze');
  save();
}
function showResult(rec, lost) {
  const bowls = Math.round(rec.kg * 0.9 * 1000 / 65); // 精米歩留まり90%、ごはん1杯=精米65g
  $('resultBody').innerHTML = `
    <div class="big">${rec.kg.toLocaleString()}<small> kg</small></div>
    <div class="row"><span>俵（60kg）</span><b>${(rec.kg / 60).toFixed(1)} 俵</b></div>
    <div class="row"><span>等級</span><b>${rec.grade}</b></div>
    <div class="row"><span>刈り取り率</span><b>${rec.rate}%</b></div>
    <div class="row"><span>ごはん換算</span><b>約 ${bowls.toLocaleString()} 杯</b></div>
    ${lost ? `<p class="warn">刈り遅れた稲 ${Math.round(lost / TOTAL * 100)}% は倒れてしまいました。</p>` : ''}
    <p class="note">刈った稲は「はざ掛け」で天日に干されます。</p>`;
  $('result').classList.add('show');
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
  field.resetYear(); field.countCutCached = 0;
  field.update(state.t, true);
  const last = state.records[state.records.length - 1];
  toast(`<b>${state.year}年目の春を迎えます</b><br>${last ? `昨年の収穫：${last.kg.toLocaleString()}kg（${last.grade}）` : '新しい一年のはじまり'}`, 8);
}

function frame(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  time += dt;
  let gdt = 0;
  if (state.started && !state.paused) {
    gdt = dt * state.speed / 60;
    const before = state.t;
    state.t += gdt;
    // 稲刈りの季節に入ったら等速に戻す
    if (before < HARVEST_START && state.t >= HARVEST_START && !state.finalized) {
      if (state.speed > 1) setSpeed(1);
      if (!state.harvestPrompted) {
        state.harvestPrompted = true;
        setView('harvest');
        toast('<b>稲刈りの季節です！</b><br>田んぼを指でなぞって（スワイプして）刈り取りましょう。<br>9月28日〜10月8日に刈ると一等米に。', 9);
      }
    }
    if (state.t >= HARVEST_END && state.t < 365 && !state.finalized) finalizeHarvest(true);
    if (state.t >= 365) newYear();
  }
  const t = state.t;
  const day = Math.floor(t);
  tg = updateWeather(gdt);

  // 季節更新（重いので間引く）
  seasonTimer -= dt;
  if (day !== lastSeasonDay && seasonTimer <= 0) {
    lastSeasonDay = day; seasonTimer = 0.35;
    land.updateSeason(t);
  }
  const q = Math.floor(t * 8);
  if (q !== lastLayoutQ) { lastLayoutQ = q; field.update(t); }

  // 太陽・月・空
  const sp = sunPosition(t % 365), mp = moonPosition(t % 365, state.year + 2025);
  updateCamera(dt);
  const light = land.updateSky(sp, mp, wx, dt, time, camera);

  // 風
  const wa = Math.sin(time * 0.05) * 0.6 + 0.6;
  windDir.set(Math.cos(wa), Math.sin(wa));
  const wind = wx.wind * (0.8 + 0.4 * Math.sin(time * 0.13));
  field.tick(time, wind, windDir, light.sunDir, camera);
  land.railway.update(dt, (t % 1) * 24, light.day);
  fx.update(dt, time, t % 365, wx, light, camera, windDir);
  audio.update(t % 365, (t % 1) * 24, wx, light);

  renderer.render(scene, camera);
  drawTrail();
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) ui.toast.classList.remove('show'); }
  hudTimer -= dt;
  if (hudTimer <= 0) { hudTimer = 0.2; updateHUD(tg); }
  if (!MANUAL) requestAnimationFrame(frame);
}
// 動作確認用：?manual で自動ループを止め、__suiden.step() で1フレームずつ進める
const MANUAL = new URLSearchParams(location.search).has('manual');
let hudTimer = 0;

// ---------- 開始 ----------
function startGame(opt) {
  const saved = opt === 'continue' ? load() : null;
  const now = new Date();
  if (saved) {
    Object.assign(state, { year: saved.year, t: saved.t, harvestKg: saved.harvestKg, harvestQ: saved.harvestQ || 0, finalized: saved.finalized, records: saved.records || [], harvestPrompted: !!saved.harvestPrompted, calYear: saved.calYear || now.getFullYear() });
    field.deserialize(saved.cut);
    setSpeed(saved.speed || 1);
    setView(saved.view === 'harvest' && !field.isHarvestable(saved.t) ? 'aze' : (saved.view || 'aze'), true);
  } else {
    const starts = {
      today: doyOf(now.getMonth() + 1, Math.min(now.getDate(), 28 + (now.getMonth() === 1 ? 0 : 3))) + 6 / 24,
      spring: doyOf(4, 20) + 5 / 24, harvest: doyOf(9, 19) + 5 / 24, jan: 0 + 6 / 24,
    };
    state.t = starts[opt] ?? starts.spring;
    state.calYear = now.getFullYear();
    state.year = 1; state.records = []; state.harvestKg = 0; state.harvestQ = 0;
    field.resetYear();
    // 稲刈り期間を過ぎてから始めた場合は刈り取り済みの田んぼにする
    state.finalized = state.t >= HARVEST_END && state.t >= PLANT_START;
    state.harvestPrompted = state.t >= HARVEST_START;
    if (state.finalized) field.cut.fill(1);
    setSpeed(1);
    setView(field.isHarvestable(state.t) ? 'harvest' : 'aze', true);
  }
  field.countCutCached = field.countCut();
  updateWeather(0, true);
  field.update(state.t, true);
  land.updateSeason(state.t);
  state.started = true;
  state.lastStage = '';
  $('start').classList.remove('show');
  document.body.classList.remove('title');
  audio.init();
  ui.sound.textContent = '音：オン';
  updateHUD(weatherTarget(state.t));
  toast(`<b>${stageOf(Math.floor(state.t) % 365).name}</b><br>${stageOf(Math.floor(state.t) % 365).note}`, 7);
  save();
}

// ボタン
$('btnPause').onclick = () => { state.paused = !state.paused; ui.pause.textContent = state.paused ? '▶' : '❚❚'; };
$('btnSpeed').onclick = () => {
  if (field.isHarvestable(state.t) && !state.finalized && state.speed === 1) {
    if (!confirm('稲刈りの期間中です。早送りすると刈り取りの時間が減ります。早送りしますか？')) return;
  }
  setSpeed(SPEEDS[(SPEEDS.indexOf(state.speed) + 1) % SPEEDS.length]);
};
$('btnView').onclick = () => {
  const order = field.isHarvestable(state.t) && !state.finalized ? ['harvest', ...VIEW_ORDER] : VIEW_ORDER;
  const i = order.indexOf(state.view);
  setView(order[(i + 1) % order.length]);
};
$('btnHarvestView').onclick = () => setView('harvest');
$('btnSound').onclick = () => { const on = audio.toggle(); ui.sound.textContent = on ? '音：オン' : '音：オフ'; };
$('btnMenu').onclick = () => { renderRecords(); $('menu').classList.add('show'); };
$('btnCloseMenu').onclick = () => $('menu').classList.remove('show');
$('btnCloseResult').onclick = () => $('result').classList.remove('show');
$('btnQuality').textContent = `画質：${Q.name}（切替）`;
$('btnQuality').onclick = () => { save(); localStorage.setItem('suiden365.quality', qKey === 'high' ? 'low' : 'high'); location.reload(); };
$('btnReset').onclick = () => {
  if (!confirm('記録を消して最初からやり直しますか？')) return;
  localStorage.removeItem(SAVE_KEY); location.reload();
};
function renderRecords() {
  $('records').innerHTML = state.records.length
    ? state.records.map(r => `<tr><td>${r.year}年目</td><td>${r.kg.toLocaleString()}kg</td><td>${(r.kg / 60).toFixed(1)}俵</td><td>${r.grade}</td></tr>`).join('')
    : '<tr><td colspan="4">まだ収穫の記録はありません</td></tr>';
}
document.querySelectorAll('[data-start]').forEach(b => (b.onclick = () => startGame(b.dataset.start)));
if (load()) $('btnContinue').hidden = false;
{
  const now = new Date();
  $('todayLabel').textContent = `${now.getMonth() + 1}月${now.getDate()}日`;
}
addEventListener('keydown', (e) => {
  if (e.key === ' ') $('btnPause').click();
  if (e.key === 'v') $('btnView').click();
  if (e.key === 'f') $('btnSpeed').click();
});
addEventListener('visibilitychange', save);
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
land.updateSeason(state.t);
state.t = doyOf(5, 19) + 16.9 / 24; // 水鏡の夕方
if (!MANUAL) requestAnimationFrame(frame);
window.__suiden = {
  state, field, setView, setSpeed, startGame, wx, land, scene, camera, renderer,
  step(n = 1, dtMs = 1000 / 30) { for (let i = 0; i < n; i++) frame(lastT + dtMs); },
  refresh() { land.updateSeason(state.t); field.update(state.t, true); updateWeather(0, true); hudTimer = 0; lastSeasonDay = Math.floor(state.t); },
};
