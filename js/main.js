import * as THREE from 'three';
import { createLandscape } from './landscape.js';
import { createField, FIELD_W, FIELD_D, TOTAL, KG_PER_HILL } from './field.js';
import { createEffects } from './effects.js';
import { createFlowers } from './flowers.js';
import { createFarmwork } from './farmwork.js';
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
  low: { name: tr('quality.low'), shadow: 1024, reflect: 384, blades: 5, bladeSegs: 2, ears: 3, earSegs: 3, trees: 11000, terrainSeg: 200, grass: 2500, pr: Math.min(devicePixelRatio, 1.25) },
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
const farm = createFarmwork({ scene, field, fx, audio: { flutter: () => audio.flutter && audio.flutter() } });
const flowers = createFlowers(scene);
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
      finalized: state.finalized, records: state.records, cut: field.serialize(), work: field.serializeWork(), farm: farm.serialize(), view: state.view, harvestPrompted: state.harvestPrompted,
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
  aze: { label: '畦道', pos: [7.5, 3.0, 36.5], yaw: 0.06, pitch: -0.005, fov: 24 }, // 農道の奥の土手から望遠で
  drone: { label: '空から', orbit: true },
  yama: { label: '里山', pos: [-190, 62, 175], look: [0, 0, 0] },
  kominka: { label: '古民家', pos: [-14, 2.6, 7], look: [-62, 4.5, 4], fov: 40 },
  north: { label: '水路', pos: [-14, 1.4, -28.2], yaw: Math.PI * 0.82, pitch: -0.04 },
};
const VIEW_ORDER = ['aze', 'kominka', 'drone', 'yama', 'north'];
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
  if (!pointer) {
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
  ui.speed.title = msg.speedTitle(s);
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
    if (!first) toast(`<b>${st.name}</b><br>${st.note}`);
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
  if (n && now - lastSwish > 90) { audio.swish(Math.min(0.8, n / 25 + 0.3)); lastSwish = now; if (navigator.vibrate) navigator.vibrate(6); }
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
  if (now - lastSwish > 70) { audio.swish(Math.min(1, ids.length / 20 + 0.4)); lastSwish = now; if (navigator.vibrate) navigator.vibrate(8); }
  // ほぼ刈り終えたら（畦ぎわの取り残し数株は手刈りしたことにして）収穫完了
  if (field.countCutCached >= TOTAL * 0.995) {
    const rest = field.cutRemaining();
    if (rest) { const q2 = harvestQuality(state.t); state.harvestKg += rest * KG_PER_HILL * q2 * farm.factors().yieldF; field.countCutCached += rest; }
    finalizeHarvest(false);
  }
}
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  const g = groundPoint(e);
  // 稲刈りの期間に田んぼの上から始めたスワイプは「刈り取り」、それ以外は見回し
  const onField = g && Math.abs(g.x) < FIELD_W / 2 && Math.abs(g.z) < FIELD_D / 2;
  const harvesting = !!(field.isHarvestable(state.t) && !state.finalized);
  const working = state.started && farm.active(state.t % 365).length > 0;
  const cutting = !!(onField && (harvesting || working));
  pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, g, cutting };
  if (cutting) trail.push({ x: e.clientX, y: e.clientY, t: performance.now() });
});
canvas.addEventListener('pointermove', (e) => {
  if (!pointer || pointer.id !== e.pointerId) return;
  if (pointer.cutting) {
    const g = groundPoint(e);
    if (g && pointer.g) {
      // 細かく分割して取りこぼしを防ぐ
      const steps = Math.ceil(pointer.g.distanceTo(g) / 0.5);
      let prev = pointer.g;
      for (let s = 1; s <= steps; s++) { const p = pointer.g.clone().lerp(g, s / steps); doCut(prev, p); doWork(prev, p); prev = p; }
    }
    pointer.g = g;
    trail.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  } else {
    const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
    const k = cam.fov / 55; // 望遠ほどゆっくり回す
    cam.dragYaw -= dx * 0.004 * k; const tele = !!VIEWS[state.view].fov; // 望遠では足元をのぞき込みすぎないように
    cam.dragPitch = clamp(cam.dragPitch + dy * 0.003 * k, tele ? -0.1 : -0.7, tele ? 0.3 : 0.7);
    cam.yaw -= dx * 0.004 * k; cam.pitch += dy * 0.003 * k; // すぐ反応させる
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
  const birdLoss = Math.min(state.harvestKg * 0.5, farm.rec.bird.lostKg);
  state.harvestKg = Math.max(0, state.harvestKg - birdLoss);
  const kg = state.harvestKg;
  const rec = { year: state.year, kg: Math.round(kg), grade: kg > 0 ? grade(state.harvestQ) : '—', rate: Math.round(field.countCutCached / TOTAL * 100) };
  rec.work = msg.workSummary(farm.rec, farm.factors(), birdLoss, farm.WEEDS);
  state.records = state.records.filter(r => r.year !== state.year).concat(rec);
  audio.chime();
  showResult(rec, lost);
  save();
}
function showResult(rec, lost) {
  const bowls = Math.round(rec.kg * 0.9 * 1000 / 65); // 精米歩留まり90%、ごはん1杯=精米65g
  $('resultBody').innerHTML = msg.result(rec, bowls, lost ? Math.round(lost / TOTAL * 100) : 0) + (rec.work || '');
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
  field.resetYear(); field.countCutCached = 0; farm.reset();
  field.update(state.t, true);
  const last = state.records[state.records.length - 1];
  toast(msg.newYear(state.year, last), 8);
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
        toast(msg.harvestStart(), 9);
      }
    }
    if (state.t >= HARVEST_END && state.t < 365 && !state.finalized) finalizeHarvest(true);
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
    const fr = farm.update(dt, t % 365, time, { running: state.started && !state.paused, harvestDone: state.finalized });
    if (state.started) for (const ev of fr.started) {
      if (ev.id === 'bird' && state.finalized) continue;
      if (state.speed > 1) setSpeed(1);
      toast(msg.workStart(ev.id), 9);
      audio.chime();
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

  // 風
  const wa = Math.sin(time * 0.05) * 0.6 + 0.6;
  windDir.set(Math.cos(wa), Math.sin(wa));
  const wind = wx.wind * (0.8 + 0.4 * Math.sin(time * 0.13));
  field.tick(time, wind, windDir, light.sunDir, camera);
  land.railway.update(dt, (t % 1) * 24, light.day);
  {
    // 電車の音：カメラからの距離と左右の位置
    const rw = land.railway, dx = rw.x - camera.position.x, dz = rw.z - camera.position.z;
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const len = Math.hypot(dx, dz) || 1;
    audio.train(rw.x, len, (dx * right.x + dz * right.z) / len, rw.running && !state.paused, rw.SPEED);
  }
  // 夕方のチャイム（4〜9月は18時、それ以外は17時）。早送りが速いときは鳴らさない
  if (state.started && !state.paused && state.speed <= 10) {
    const { month } = monthDay(Math.floor(t) % 365);
    const ch = (month >= 4 && month <= 9 ? 18 : 17) / 24;
    const prev = t - gdt;
    if (Math.floor(prev) === Math.floor(t) && (prev % 1) < ch && (t % 1) >= ch) audio.yuyake();
  }
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
    field.deserialize(saved.cut); field.deserializeWork(saved.work); farm.reset(); farm.deserialize(saved.farm); farm.skipPast(saved.t % 365);
    setSpeed(saved.speed || 1);
    setView(VIEWS[saved.view] ? saved.view : 'aze', true);
  } else {
    const starts = {
      today: doyOf(now.getMonth() + 1, Math.min(now.getDate(), 28 + (now.getMonth() === 1 ? 0 : 3))) + 6 / 24,
      spring: doyOf(4, 20) + 5 / 24, harvest: doyOf(9, 19) + 5 / 24, jan: 0 + 6 / 24,
    };
    state.t = starts[opt] ?? starts.spring;
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
  state.lastStage = '';
  $('start').classList.remove('show');
  document.body.classList.remove('title');
  audio.init();
  ui.sound.textContent = tr('sound.on');
  updateHUD(weatherTarget(state.t));
  { const st = stageText(stageOf(Math.floor(state.t) % 365)); toast(`<b>${st.name}</b><br>${st.note}`, 7); }
  save();
}

// ボタン
$('btnPause').onclick = () => { state.paused = !state.paused; ui.pause.textContent = state.paused ? '▶' : '❚❚'; };
$('btnSpeed').onclick = () => {
  if (field.isHarvestable(state.t) && !state.finalized && state.speed === 1) {
    if (!confirm(msg.confirmFast())) return;
  }
  setSpeed(SPEEDS[(SPEEDS.indexOf(state.speed) + 1) % SPEEDS.length]);
};
$('btnView').onclick = () => {
  const order = VIEW_ORDER;
  const i = order.indexOf(state.view);
  setView(order[(i + 1) % order.length]);
};
$('btnSound').onclick = () => { const on = audio.toggle(); ui.sound.textContent = tr(on ? 'sound.on' : 'sound.off'); };
$('btnMenu').onclick = () => { renderRecords(); $('menu').classList.add('show'); };
$('btnCloseMenu').onclick = () => $('menu').classList.remove('show');
$('btnCloseResult').onclick = () => $('result').classList.remove('show');
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
document.querySelectorAll('[data-start]').forEach(b => (b.onclick = () => startGame(b.dataset.start)));
if (load()) $('btnContinue').hidden = false;
{
  const now = new Date();
  $('todayLabel').textContent = fmtMonthDay(now.getMonth() + 1, now.getDate());
  $('lblSpring').textContent = fmtMonthDay(4, 20); $('lblHarvest').textContent = fmtMonthDay(9, 19); $('lblJan').textContent = fmtMonthDay(1, 1);
  applyStatic();
  $('btnPause').title = tr('btn.pause');
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
land.updateSeason(state.t); flowers.update(state.t % 365);
state.t = doyOf(5, 19) + 16.9 / 24; // 水鏡の夕方
if (!MANUAL) requestAnimationFrame(frame);
window.__suiden = {
  state, field, setView, setSpeed, startGame, wx, land, scene, camera, renderer, farm,
  step(n = 1, dtMs = 1000 / 30) { for (let i = 0; i < n; i++) frame(lastT + dtMs); },
  refresh() { land.updateSeason(state.t); flowers.update(state.t % 365); field.update(state.t, true); updateWeather(0, true); hudTimer = 0; lastSeasonDay = Math.floor(state.t); },
};
