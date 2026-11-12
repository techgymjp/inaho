// 農作業イベント：田起こし・代かき・田植え・除草・カメムシ防除・スズメ追い
// どれも「いつもの景色のまま、田んぼをなぞる」操作で行う
import * as THREE from 'three';
import { makeNoise } from './noise.js';
import { toon } from './toon.js';
import { smooth, clamp, doyOf, waterLevel, PLANT_START, PLANT_END, HARVEST_END, PLOW_DAY, riceGrowth } from './calendar.js';
import { TOTAL, FIELD_W, FIELD_D } from './field.js';

const D = doyOf;
const R = makeNoise(9091).rnd;

export const EVENTS = [
  { id: 'till', start: D(4, 15), end: D(4, 27) },
  { id: 'level', start: D(4, 28), end: D(5, 12) },
  { id: 'plant', start: PLANT_START, end: PLANT_END },
  { id: 'weed', start: D(6, 1), end: D(6, 25) },
  { id: 'bug', start: D(8, 5), end: D(8, 26) },
  { id: 'bird', start: D(9, 8), end: HARVEST_END },
];

function spriteTex(draw, w = 128, h = 128) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// カメムシ（緑の盾形）
const bugTex = () => spriteTex((g, w, h) => {
  g.strokeStyle = '#2a3a1c'; g.lineWidth = 5; g.lineCap = 'round';
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(w / 2 + s * 18, 52 + k * 16); g.lineTo(w / 2 + s * 44, 44 + k * 22); g.stroke(); }
  g.beginPath(); g.moveTo(w / 2 - 8, 30); g.lineTo(w / 2 - 22, 8); g.moveTo(w / 2 + 8, 30); g.lineTo(w / 2 + 22, 8); g.stroke();
  g.fillStyle = '#5f8a2a'; g.strokeStyle = '#2f4a16'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(w / 2 - 34, 40); g.lineTo(w / 2 + 34, 40); g.lineTo(w / 2 + 26, 78); g.lineTo(w / 2, 112); g.lineTo(w / 2 - 26, 78); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#86b040'; g.beginPath(); g.moveTo(w / 2 - 16, 46); g.lineTo(w / 2 + 16, 46); g.lineTo(w / 2, 82); g.closePath(); g.fill();
  g.fillStyle = '#4b6e22'; g.beginPath(); g.ellipse(w / 2, 34, 14, 9, 0, 0, Math.PI * 2); g.fill();
});
// スズメ（とまっている姿／羽ばたき）
const birdTex = (wingsUp) => spriteTex((g, w, h) => {
  g.fillStyle = '#7a5434';
  if (wingsUp !== null) { // 飛んでいる
    g.beginPath(); g.moveTo(64, 70); g.quadraticCurveTo(30, wingsUp ? 18 : 92, 6, wingsUp ? 30 : 96); g.quadraticCurveTo(36, 66, 64, 78); g.fill();
    g.beginPath(); g.moveTo(64, 70); g.quadraticCurveTo(98, wingsUp ? 18 : 92, 122, wingsUp ? 30 : 96); g.quadraticCurveTo(92, 66, 64, 78); g.fill();
  }
  g.fillStyle = '#8a6440'; g.beginPath(); g.ellipse(64, 76, 26, 18, 0, 0, Math.PI * 2); g.fill();      // 胴
  g.fillStyle = '#e8dcc4'; g.beginPath(); g.ellipse(68, 84, 18, 10, 0, 0, Math.PI * 2); g.fill();      // 腹
  g.fillStyle = '#6b3f22'; g.beginPath(); g.arc(88, 60, 14, 0, Math.PI * 2); g.fill();                  // 頭（茶色の帽子）
  g.fillStyle = '#f2ece0'; g.beginPath(); g.ellipse(90, 66, 9, 6, 0, 0, Math.PI * 2); g.fill();        // ほお
  g.fillStyle = '#1b1b1b'; g.beginPath(); g.arc(91, 66, 3.2, 0, Math.PI * 2); g.fill();                // ほおの黒斑
  g.beginPath(); g.arc(93, 57, 2.6, 0, Math.PI * 2); g.fill();                                       // 目
  g.fillStyle = '#3a2a1a'; g.beginPath(); g.moveTo(101, 60); g.lineTo(110, 63); g.lineTo(101, 66); g.fill(); // くちばし
  g.fillStyle = '#5a3a22'; g.beginPath(); g.moveTo(40, 72); g.lineTo(14, 66); g.lineTo(18, 80); g.closePath(); g.fill(); // 尾
});

export function createFarmwork({ scene, field, fx, audio }) {
  const group = new THREE.Group();
  scene.add(group);

  // ---------- 年ごとの記録 ----------
  const fresh = () => ({
    till: null, level: null, plant: null, weed: { spawned: 0, pulled: 0, done: false }, bug: { spawned: 0, caught: 0, done: false },
    bird: { lostKg: 0, shooed: 0, done: false }, closed: {}, skipped: {},
  });
  let rec = fresh();
  let lastT = null;

  // ---------- 雑草（ヒエ） ----------
  const WEEDS = 140;
  const weedGeo = (() => {
    const parts = [];
    for (let b = 0; b < 6; b++) {
      const a = b / 6 * Math.PI * 2;
      const g = new THREE.PlaneGeometry(0.05, 1.25, 1, 3);
      const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) { const y = p.getY(k) + 0.62; p.setXYZ(k, p.getX(k) + Math.cos(a) * y * y * 0.18, y, Math.sin(a) * y * y * 0.18); }
      g.rotateY(-a);
      parts.push(g.toNonIndexed());
    }
    const head = new THREE.ConeGeometry(0.07, 0.35, 5).translate(0, 1.42, 0).toNonIndexed();
    parts.push(head);
    let n = 0; parts.forEach(q => (n += q.attributes.position.count));
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    let o = 0;
    parts.forEach((q, i) => {
      pos.set(q.attributes.position.array, o * 3);
      const c = i === parts.length - 1 ? [0.85, 0.72, 0.3] : [0.78, 0.92, 0.32];
      for (let k = 0; k < q.attributes.position.count; k++) col.set(c, (o + k) * 3);
      o += q.attributes.position.count;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  })();
  const weedMesh = new THREE.InstancedMesh(weedGeo, toon({ vertexColors: true, side: THREE.DoubleSide }), WEEDS);
  weedMesh.frustumCulled = false;
  group.add(weedMesh);
  const weeds = [];
  for (let i = 0; i < WEEDS; i++) {
    let x, z;
    do { x = (R() - 0.5) * (FIELD_W - 4); z = (R() - 0.5) * (FIELD_D - 4); } while (!field.inPaddy(x, z));
    weeds.push({ x, z, at: R(), pulled: false, s: 0.85 + R() * 0.35, rot: R() * 6 });
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sv = new THREE.Vector3();
  function layoutWeeds(t) {
    const prog = clamp((t - EVENTS[3].start) / (EVENTS[3].end - EVENTS[3].start - 3));
    const grow = smooth(EVENTS[3].start, D(8, 10), t);
    const show = !rec.skipped.weed && t >= EVENTS[3].start && t < Math.min(HARVEST_END, PLOW_DAY);
    let n = 0;
    weeds.forEach((w, i) => {
      const vis = show && !w.pulled && w.at <= prog + 1e-6;
      if (vis) n++;
      const s = vis ? w.s * (0.75 + 0.6 * grow) : 1e-4; // ヒエは稲より高く伸びて目立つ
      m4.compose(v.set(w.x, 0, w.z), q.setFromAxisAngle(sv.set(0, 1, 0), w.rot), sv.set(s, s, s));
      weedMesh.setMatrixAt(i, m4);
    });
    weedMesh.instanceMatrix.needsUpdate = true;
    return n;
  }

  // ---------- カメムシ ----------
  const bugMat = new THREE.SpriteMaterial({ map: bugTex(), transparent: true, depthWrite: false });
  const bugs = [];
  const MAX_BUGS = 16;
  let bugTimer = 0;
  function spawnBug() {
    let x, z;
    do { x = (R() - 0.5) * (FIELD_W - 4); z = (R() - 0.5) * (FIELD_D - 4); } while (!field.inPaddy(x, z));
    const sp = new THREE.Sprite(bugMat);
    sp.scale.setScalar(1.15);
    group.add(sp);
    bugs.push({ sp, x, z, ph: R() * 10, age: 0 });
    rec.bug.spawned++;
  }

  // ---------- スズメ ----------
  const birdTexs = [birdTex(null), birdTex(true), birdTex(false)];
  const flocks = [];
  let birdTimer = 6;
  function spawnFlock() {
    // まだ刈っていない稲の上に降りる
    let x = 0, z = 0;
    for (let tries = 0; tries < 30; tries++) {
      const i = Math.floor(R() * TOTAL);
      if (!field.cut[i]) { x = field.hx[i]; z = field.hz[i]; break; }
    }
    const n = 6 + Math.floor(R() * 6);
    const from = new THREE.Vector3((R() < 0.5 ? -1 : 1) * 50, 12 + R() * 6, -40 - R() * 30);
    const birds = [];
    for (let k = 0; k < n; k++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: birdTexs[1], transparent: true, depthWrite: false }));
      sp.scale.setScalar(0.95);
      sp.position.copy(from).add(new THREE.Vector3((R() - 0.5) * 6, (R() - 0.5) * 3, (R() - 0.5) * 6));
      group.add(sp);
      birds.push({ sp, tx: x + (R() - 0.5) * 3.5, tz: z + (R() - 0.5) * 3.5, ph: R() * 10, flip: R() < 0.5 });
    }
    flocks.push({ birds, x, z, state: 'in', time: 0, away: null });
  }
  function shooFlock(f) {
    if (f.state === 'out') return;
    f.state = 'out'; f.time = 0;
    f.away = new THREE.Vector3((R() < 0.5 ? -1 : 1) * 120, 30, -150);
    rec.bird.shooed++;
    audio.flutter && audio.flutter();
  }

  // ---------- 進行 ----------
  function close(ev) {
    if (rec.closed[ev.id]) return;
    rec.closed[ev.id] = true;
    if (ev.id === 'till') { rec.till = field.tillRatio(); field.fillTill(); }
    if (ev.id === 'level') { rec.level = field.levelRatio(); field.fillLevel(); }
    if (ev.id === 'plant') { const self = field.countPlanted(); rec.plant = { self, total: TOTAL }; }
    if (ev.id === 'weed') rec.weed.done = true;
    if (ev.id === 'bug') { rec.bug.done = true; bugs.forEach(b => group.remove(b.sp)); bugs.length = 0; }
    if (ev.id === 'bird') { rec.bird.done = true; flocks.forEach(f => f.birds.forEach(b => group.remove(b.sp))); flocks.length = 0; }
  }
  // 途中から始めたときは、もう過ぎた作業を「影響なし」で閉じる
  function skipPast(t) {
    for (const ev of EVENTS) if (t >= ev.end && !rec.closed[ev.id]) {
      rec.closed[ev.id] = true; rec.skipped[ev.id] = true;
      if (ev.id === 'till') field.fillTill();
      if (ev.id === 'level') field.fillLevel();
    }
  }

  function active(t) { return EVENTS.filter(ev => t >= ev.start && t < ev.end && !rec.closed[ev.id]); }

  function update(dt, t, time, opts) {
    const started = [];
    if (lastT !== null && t > lastT) for (const ev of EVENTS) if (lastT < ev.start && t >= ev.start) started.push(ev);
    lastT = t;
    for (const ev of EVENTS) if (t >= ev.end && !rec.closed[ev.id] && t < ev.end + 30) close(ev);
    layoutWeeds(t);
    const run = opts.running;

    // カメムシ：稲の穂の上をふらふら飛ぶ
    const bugOn = t >= EVENTS[4].start && t < EVENTS[4].end && !rec.closed.bug;
    if (bugOn && run) {
      bugTimer -= dt;
      if (bugTimer <= 0 && bugs.length < MAX_BUGS) { spawnBug(); if (bugs.length < 4) spawnBug(); bugTimer = 1.0 + R() * 1.4; }
    }
    const g = riceGrowth(t), top = g ? g.h + 0.15 : 1;
    bugs.forEach(b => {
      b.age += dt;
      b.x += Math.sin(time * 1.3 + b.ph) * dt * 0.8; b.z += Math.cos(time * 1.1 + b.ph * 2) * dt * 0.8;
      b.sp.position.set(b.x, top + 0.25 + Math.sin(time * 3 + b.ph) * 0.18, b.z);
    });

    // スズメ：飛んできて実った稲をついばむ
    const birdOn = t >= EVENTS[5].start && t < EVENTS[5].end && !rec.closed.bird && !opts.harvestDone;
    if (birdOn && run) {
      birdTimer -= dt;
      if (birdTimer <= 0 && flocks.filter(f => f.state !== 'out').length < 2) { spawnFlock(); birdTimer = 10 + R() * 14; }
    }
    for (let fi = flocks.length - 1; fi >= 0; fi--) {
      const f = flocks[fi];
      f.time += dt;
      let landed = 0;
      f.birds.forEach((b, k) => {
        if (f.state === 'in') {
          const target = v.set(b.tx, top + 0.1, b.tz);
          b.sp.position.lerp(target, 1 - Math.exp(-dt * 2.2));
          const near = b.sp.position.distanceTo(target) < 0.3;
          if (near) landed++;
          const flap = Math.floor((time * 14 + b.ph) % 2);
          b.sp.material.map = near ? birdTexs[0] : birdTexs[1 + flap];
          if (near) b.sp.position.y += Math.max(0, Math.sin(time * 9 + b.ph)) * 0.08; // ついばむ
        } else {
          b.sp.position.lerp(v.copy(f.away).add(sv.set(k * 2, k, 0)), 1 - Math.exp(-dt * 0.9));
          b.sp.material.map = birdTexs[1 + Math.floor((time * 16 + b.ph) % 2)];
        }
        b.sp.material.rotation = 0;
        b.sp.scale.x = (b.flip ? -1 : 1) * 0.95;
      });
      if (f.state === 'in' && landed > 0 && run) rec.bird.lostKg += landed * 0.02 * dt;
      if (f.state === 'out' && f.time > 4) { f.birds.forEach(b => group.remove(b.sp)); flocks.splice(fi, 1); }
      // 稲刈りが終わったら帰る
      if (f.state === 'in' && opts.harvestDone) shooFlock(f);
    }
    return { started };
  }

  // なぞった線の近くを処理。処理した数を返す
  function swipe(a, b, r, t) {
    let n = 0;
    const ev = active(t);
    const has = (id) => ev.some(e => e.id === id);
    if (has('till')) n += field.tillAlong(a.x, a.z, b.x, b.z, r * 1.4);
    if (has('level') && waterLevel(t) > 0.5) n += field.levelAlong(a.x, a.z, b.x, b.z, r * 1.4);
    if (has('plant')) { const ids = field.plantAlong(a.x, a.z, b.x, b.z, r, t); n += ids.length; for (let i = 0; i < ids.length; i += 6) fx.burst(field.hx[ids[i]], field.hz[ids[i]], 1); }
    const near = (x, z, rr) => {
      const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1e-6;
      const s2 = clamp(((x - a.x) * dx + (z - a.z) * dz) / L2), ex = x - a.x - dx * s2, ez = z - a.z - dz * s2;
      return ex * ex + ez * ez <= rr * rr;
    };
    if (!rec.skipped.weed && t >= EVENTS[3].start && t < Math.min(HARVEST_END, PLOW_DAY)) {
      const prog = clamp((t - EVENTS[3].start) / (EVENTS[3].end - EVENTS[3].start - 3));
      weeds.forEach(w => { if (!w.pulled && w.at <= prog && near(w.x, w.z, r + 0.4)) { w.pulled = true; rec.weed.pulled++; n++; fx.burst(w.x, w.z, 4); } });
    }
    for (let i = bugs.length - 1; i >= 0; i--) if (near(bugs[i].x, bugs[i].z, r + 0.6)) { group.remove(bugs[i].sp); bugs.splice(i, 1); rec.bug.caught++; n++; }
    flocks.forEach(f => { if (f.state === 'in' && f.birds.some(bd => near(bd.sp.position.x, bd.sp.position.z, r + 1.5))) { shooFlock(f); n++; } });
    return n;
  }

  // ---------- 成績 ----------
  function weedRemaining() { return weeds.filter(w => !w.pulled && w.at <= 1).length; }
  function factors() {
    const tillF = rec.till == null ? 1 : 0.9 + 0.1 * rec.till;
    const levelF = rec.level == null ? 1 : 0.94 + 0.06 * rec.level;
    const plantF = rec.plant == null ? 1 : (rec.plant.self + 0.85 * (rec.plant.total - rec.plant.self)) / rec.plant.total;
    const weedF = !rec.skipped.weed && (rec.weed.done || rec.weed.pulled) ? 1 - 0.12 * weedRemaining() / WEEDS : 1;
    const bugQ = rec.bug.spawned ? 1 - 0.1 * (1 - rec.bug.caught / rec.bug.spawned) : 1;
    return { tillF, levelF, plantF, weedF, bugQ, yieldF: tillF * levelF * plantF * weedF };
  }
  function progress(id, t) {
    if (id === 'till') return field.tillRatio();
    if (id === 'level') return field.levelRatio();
    if (id === 'plant') return field.countPlanted() / TOTAL;
    if (id === 'weed') { const prog = clamp((t - EVENTS[3].start) / (EVENTS[3].end - EVENTS[3].start - 3)); const sp = weeds.filter(w => w.at <= prog).length; return { pulled: rec.weed.pulled, shown: sp }; }
    if (id === 'bug') return { caught: rec.bug.caught, live: bugs.length };
    if (id === 'bird') return { lost: rec.bird.lostKg, shooed: rec.bird.shooed, live: flocks.filter(f => f.state === 'in').length };
    return 0;
  }

  function reset() {
    rec = fresh(); weeds.forEach(w => (w.pulled = false));
    bugs.forEach(b => group.remove(b.sp)); bugs.length = 0;
    flocks.forEach(f => f.birds.forEach(b => group.remove(b.sp))); flocks.length = 0;
    lastT = null;
  }
  function serialize() { return { rec, weeds: weeds.map(w => (w.pulled ? 1 : 0)).join('') }; }
  function deserialize(d) {
    if (!d) return;
    rec = Object.assign(fresh(), d.rec || {});
    rec.skipped = rec.skipped || {};
    if (d.weeds) weeds.forEach((w, i) => (w.pulled = d.weeds[i] === '1'));
  }
  return { update, swipe, active, factors, progress, reset, serialize, deserialize, skipPast, get rec() { return rec; }, WEEDS };
}
