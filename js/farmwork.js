// 農作業イベント：田起こし・代かき・田植え・除草・カメムシ防除・スズメ追い
// どれも「いつもの景色のまま、田んぼをなぞる」操作で行う
import * as THREE from 'three';
import { makeNoise } from './noise.js';
import { toon, hex } from './toon.js';
import { smooth, clamp, doyOf, waterLevel, snowCover, PLANT_START, PLANT_END, HARVEST_END, PLOW_DAY, riceGrowth } from './calendar.js';
import { TOTAL, FIELD_W, FIELD_D, COLS, ROWS, PW, PD, LEVEE } from './field.js';

const D = doyOf;
const R = makeNoise(9091).rnd;

export const EVENTS = [
  { id: 'till', start: D(4, 15), end: D(4, 27) },
  { id: 'level', start: D(4, 28), end: D(5, 12) },
  { id: 'plant', start: PLANT_START, end: PLANT_END },
  { id: 'weed', start: D(6, 1), end: D(6, 25) },
  { id: 'bug', start: D(8, 5), end: D(8, 26) },
  { id: 'bird', start: D(9, 8), end: HARVEST_END },
  // 冬の農作業
  { id: 'house', start: D(1, 8), end: D(2, 26) },   // ハウスの雪下ろし
  { id: 'melt', start: D(2, 28), end: D(3, 21) },   // 融雪剤まき
  { id: 'levee', start: D(11, 25), end: D(12, 8) }, // 畦の補修（来年の水もちに効く）
];
const EV = Object.fromEntries(EVENTS.map(e => [e.id, e]));

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
    bird: { lostKg: 0, shooed: 0, done: false }, house: { load: 0, cleared: 0, collapsed: false, warned: false }, melt: null,
    levee: { fixed: 0, done: false, leak: 0 }, carryLeak: 0, closed: {}, skipped: {},
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

  // ---------- ビニールハウス（育苗用）：冬は雪下ろしが必要 ----------
  const HX = 2, HZ = -50, HL = 22, HRAD = 3;
  const house = new THREE.Group();
  // 半円筒（軸は東西、上半分）
  const film = new THREE.Mesh(new THREE.CylinderGeometry(HRAD, HRAD, HL, 18, 1, true, Math.PI, Math.PI).rotateZ(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0xe4eef4, transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false }));
  const ends = new THREE.Mesh(new THREE.CircleGeometry(HRAD, 18, 0, Math.PI), film.material);
  const ends2 = ends.clone();
  ends.position.set(-HL / 2, 0, 0); ends.rotation.y = Math.PI / 2;
  ends2.position.set(HL / 2, 0, 0); ends2.rotation.y = -Math.PI / 2;
  house.add(film, ends, ends2);
  const pipeM = toon({ color: '#9aa0a6' });
  for (let k = 0; k <= 11; k++) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(HRAD + 0.02, 0.035, 4, 18, Math.PI), pipeM);
    hoop.rotation.y = Math.PI / 2; hoop.position.x = -HL / 2 + k * HL / 11;
    house.add(hoop);
  }
  // 中の苗箱（4〜5月）
  const trays = new THREE.Mesh(new THREE.BoxGeometry(HL - 2, 0.25, HRAD * 1.2), toon({ color: '#7cc246' }));
  trays.position.y = 0.6; house.add(trays);
  // 屋根の雪
  const snowCap = new THREE.Mesh(new THREE.CylinderGeometry(HRAD + 0.05, HRAD + 0.05, HL + 0.2, 18, 1, false, Math.PI * 1.5 - Math.PI / 3.2, Math.PI / 1.6).rotateZ(-Math.PI / 2),
    toon({ color: '#f4f8fc' }));
  house.add(snowCap);
  house.position.set(HX, 0.35, HZ);
  house.traverse(o => { if (o.isMesh) o.castShadow = true; });
  group.add(house);
  const houseBox = new THREE.Box3(new THREE.Vector3(HX - HL / 2 - 0.5, 0, HZ - HRAD - 0.5), new THREE.Vector3(HX + HL / 2 + 0.5, HRAD + 1.2, HZ + HRAD + 0.5));
  // ---- 雪下ろしの雪のかたまり：屋根をすべり落ちて、地面でドサッとくずれる ----
  const CH = 160;
  const chunkMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.32, 0), toon({ color: '#f6f9fc' }), CH);
  chunkMesh.frustumCulled = false;
  group.add(chunkMesh);
  const chunks = Array.from({ length: CH }, () => ({ live: false }));
  let chunkHead = 0, thudTimer = 0;
  // 粉雪のけむり
  const PUFF = 200;
  const puffPos = new Float32Array(PUFF * 3), puffVel = new Float32Array(PUFF * 3), puffLife = new Float32Array(PUFF);
  const puffGeo = new THREE.BufferGeometry();
  puffGeo.setAttribute('position', new THREE.BufferAttribute(puffPos, 3));
  const puffMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.85, depthWrite: false });
  const puffs = new THREE.Points(puffGeo, puffMat);
  puffs.frustumCulled = false;
  for (let i = 0; i < PUFF; i++) puffPos[i * 3 + 1] = -100;
  group.add(puffs);
  let puffHead = 0;
  function puff(x, y, z, n) {
    for (let k = 0; k < n; k++) {
      const i = puffHead; puffHead = (puffHead + 1) % PUFF;
      puffPos.set([x + (R() - 0.5) * 0.6, y + R() * 0.3, z + (R() - 0.5) * 0.6], i * 3);
      puffVel.set([(R() - 0.5) * 1.6, 0.4 + R() * 1.2, (R() - 0.5) * 1.6], i * 3);
      puffLife[i] = 0.6 + R() * 0.6;
    }
  }
  function spawnChunks(hit, n) {
    const side = hit.z >= HZ ? 1 : -1;            // カメラ側（南）の屋根から落ちることが多い
    for (let k = 0; k < n; k++) {
      const c = chunks[chunkHead]; chunkHead = (chunkHead + 1) % CH;
      // 屋根の上の位置（角度 a：0=てっぺん、π/2=軒）
      const a = 0.15 + R() * 0.6;
      c.live = true; c.phase = 'slide'; c.a = a; c.side = side;
      c.x = THREE.MathUtils.clamp(hit.x + (R() - 0.5) * 2.2, HX - HL / 2 + 0.5, HX + HL / 2 - 0.5);
      c.av = 0.2 + R() * 0.4;                          // 屋根をすべる角速度
      c.s = 0.6 + R() * 0.9; c.rot = R() * 6; c.spin = (R() - 0.5) * 6; c.life = 0;
    }
    puff(hit.x, HRAD + 0.6, HZ + side * 1.2, 6);
  }
  function updateChunks(dt) {
    let any = false;
    const ground = 0.35;
    for (let ci = 0; ci < CH; ci++) {
      const c = chunks[ci];
      if (!c.live) continue;
      any = true;
      if (c.phase === 'slide') {
        c.av += 2.4 * Math.sin(c.a) * dt + 0.6 * dt;     // 傾きが急になるほど速くすべる
        c.a += c.av * dt;
        c.y = 0.35 + (HRAD + 0.25) * Math.cos(c.a); c.z = HZ + c.side * (HRAD + 0.25) * Math.sin(c.a);
        if (c.a >= Math.PI / 2 - 0.05) {                // 軒から落ちる
          c.phase = 'fall';
          const sp = c.av * (HRAD + 0.25);
          c.vy = -sp * 0.2; c.vz = c.side * sp * 0.9; c.vx = (R() - 0.5) * 0.5;
        }
      } else if (c.phase === 'fall') {
        c.vy -= 9.8 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
        if (c.y <= ground + 0.15 * c.s) {
          c.y = ground + 0.12 * c.s; c.phase = 'land'; c.life = 0; c.s *= 1.25;
          puff(c.x, ground + 0.2, c.z, 4);
          if (thudTimer <= 0) { audio.thud && audio.thud(); thudTimer = 0.12; }
        }
      } else {
        c.life += dt;                                    // 地面でくずれて、雪の山にまぎれる
        if (c.life > 1.6) c.live = false;
      }
      c.rot += c.spin * dt * (c.phase === 'land' ? 0 : 1);
      const flat = c.phase === 'land' ? Math.max(0.15, 0.55 - c.life * 0.25) : 1;
      const sc = c.live ? c.s : 1e-4;
      m4.compose(v.set(c.x, c.y, c.z), q.setFromEuler(new THREE.Euler(c.rot, c.rot * 0.7, 0)), sv.set(sc * (c.phase === 'land' ? 1.3 : 1), sc * flat, sc));
      chunkMesh.setMatrixAt(ci, m4);
    }
    if (!any) return;
    chunkMesh.instanceMatrix.needsUpdate = true;
  }
  function updatePuffs(dt) {
    for (let i = 0; i < PUFF; i++) {
      if (puffLife[i] <= 0) continue;
      puffLife[i] -= dt;
      puffVel[i * 3 + 1] -= 1.5 * dt;
      for (let k = 0; k < 3; k++) puffPos[i * 3 + k] += puffVel[i * 3 + k] * dt;
      if (puffLife[i] <= 0) puffPos[i * 3 + 1] = -100;
    }
    puffGeo.attributes.position.needsUpdate = true;
  }
  for (let i = 0; i < CH; i++) { m4.compose(v.set(0, -100, 0), q.identity(), sv.setScalar(1e-4)); chunkMesh.setMatrixAt(i, m4); }
  // 下ろした雪がハウスの両脇に山になる
  const pileGeo = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(HL / 2 + 0.5, 1, 1);
  const piles = [-1, 1].map(side => { const m = new THREE.Mesh(pileGeo, toon({ color: '#f4f8fc' })); m.position.set(HX, 0.3, HZ + side * (HRAD + 1.1)); m.receiveShadow = true; group.add(m); return m; });

  function layoutHouse(t) {
    const h = rec.house, sc = snowCover(t);
    const inEv = t >= EV.house.start && t < EV.house.end && !rec.skipped.house;
    const load = inEv ? h.load : sc * 0.25;
    snowCap.visible = load > 0.02 && !h.collapsed;
    snowCap.scale.set(1, 1, 1);
    snowCap.position.y = load * 0.5;
    snowCap.scale.setScalar(1 + load * 0.12);
    // つぶれたハウス（4月まで）
    const broken = h.collapsed && t < D(4, 1);
    house.scale.set(1, broken ? 0.35 : 1, 1);
    house.rotation.z = broken ? 0.05 : 0;
    trays.visible = t >= D(4, 3) && t < D(5, 20);
  }

  // ---------- 畦の穴（モグラ穴・崩れ）：初冬に直す ----------
  const HOLES = 40;
  const holes = [];
  for (let i = 0; i < HOLES; i++) {
    let x, z;
    if (R() < 0.55) { // 南北の畦
      const c = Math.floor(R() * (COLS + 1));
      x = -FIELD_W / 2 + LEVEE / 2 + c * (PW + LEVEE); z = (R() - 0.5) * (FIELD_D - 2);
    } else {          // 東西の畦
      const r = Math.floor(R() * (ROWS + 1));
      z = -FIELD_D / 2 + LEVEE / 2 + r * (PD + LEVEE); x = (R() - 0.5) * (FIELD_W - 2);
    }
    holes.push({ x, z, at: R(), fixed: false });
  }
  const holeMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.4, 0.06, 9), toon({ color: '#24170c' }), HOLES);
  const rimMesh = new THREE.InstancedMesh(new THREE.TorusGeometry(0.56, 0.12, 4, 9).rotateX(Math.PI / 2), toon({ color: '#c9a46a' }), HOLES);
  holeMesh.frustumCulled = rimMesh.frustumCulled = false;
  group.add(holeMesh, rimMesh);
  function layoutHoles(t) {
    const prog = clamp((t - EV.levee.start) / (EV.levee.end - EV.levee.start - 2));
    const show = t >= EV.levee.start && t < EV.levee.end && !rec.skipped.levee;
    holes.forEach((h, i) => {
      const vis = show && !h.fixed && h.at <= prog + 1e-6;
      m4.compose(v.set(h.x, 0.37, h.z), q.identity(), sv.setScalar(vis ? 1 : 1e-4));
      holeMesh.setMatrixAt(i, m4); rimMesh.setMatrixAt(i, m4);
    });
    holeMesh.instanceMatrix.needsUpdate = rimMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------- 白鳥（冬の田んぼに落ち穂をついばみに来る） ----------
  const SWANS = 9;
  const swanGeo = (() => {
    const parts = [
      new THREE.SphereGeometry(0.42, 10, 8).scale(1, 0.62, 1.55).translate(0, 0.42, 0),
      new THREE.CylinderGeometry(0.06, 0.09, 0.75, 6).rotateX(-0.25).translate(0, 0.85, 0.55),
      new THREE.SphereGeometry(0.11, 8, 6).scale(1, 0.9, 1.4).translate(0, 1.22, 0.68),
      new THREE.ConeGeometry(0.05, 0.22, 5).rotateX(Math.PI / 2).translate(0, 1.2, 0.86),
    ].map(g => g.toNonIndexed());
    let n = 0; parts.forEach(g2 => (n += g2.attributes.position.count));
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    let o = 0;
    parts.forEach((g2, i) => {
      pos.set(g2.attributes.position.array, o * 3);
      const c = i === 3 ? [0.95, 0.75, 0.15] : [0.97, 0.97, 0.95];
      for (let k = 0; k < g2.attributes.position.count; k++) col.set(c, (o + k) * 3);
      o += g2.attributes.position.count;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  })();
  const swanMesh = new THREE.InstancedMesh(swanGeo, toon({ vertexColors: true }), SWANS);
  swanMesh.frustumCulled = false;
  group.add(swanMesh);
  const swans = Array.from({ length: SWANS }, (_, i) => ({ x: -8 + (R() - 0.5) * 22, z: -6 + (R() - 0.5) * 14, ph: R() * 10, dir: R() * 6 }));
  function layoutSwans(t, time, day) {
    const season = smooth(D(12, 12), D(12, 20), t) + (1 - smooth(D(3, 5), D(3, 12), t)) * (t < D(6, 1) ? 1 : 0);
    const on = Math.min(1, season) > 0.5 && day > 0.3 && snowCover(t) > 0.3;
    swanMesh.visible = on;
    if (!on) return;
    swans.forEach((w, i) => {
      w.dir += Math.sin(time * 0.2 + w.ph) * 0.004;
      const sp = 0.25 * Math.max(0, Math.sin(time * 0.15 + w.ph));
      w.x += Math.sin(w.dir) * sp * 0.016; w.z += Math.cos(w.dir) * sp * 0.016;
      if (Math.abs(w.x) > FIELD_W / 2 - 3 || Math.abs(w.z) > FIELD_D / 2 - 3) w.dir += Math.PI * 0.02;
      const peck = Math.max(0, Math.sin(time * 0.8 + w.ph * 3)) > 0.6 ? 0.55 : 0;  // 首を下げてついばむ
      m4.compose(v.set(w.x, 0.05, w.z), q.setFromEuler(new THREE.Euler(peck, w.dir, 0, 'YXZ')), sv.setScalar(1.1));
      swanMesh.setMatrixAt(i, m4);
    });
    swanMesh.instanceMatrix.needsUpdate = true;
  }

  const events = [];
  // ---------- 進行 ----------
  function close(ev) {
    if (rec.closed[ev.id]) return;
    rec.closed[ev.id] = true;
    if (ev.id === 'till') { rec.till = field.tillRatio(); field.fillTill(); }
    if (ev.id === 'level') { rec.level = field.levelRatio(); field.fillLevel(); }
    if (ev.id === 'plant') { const self = field.countPlanted(); rec.plant = { self, total: TOTAL }; }
    if (ev.id === 'weed') rec.weed.done = true;
    if (ev.id === 'bug') { rec.bug.done = true; bugs.forEach(b => group.remove(b.sp)); bugs.length = 0; }
    if (ev.id === 'melt') rec.melt = field.meltRatio();
    if (ev.id === 'house') rec.house.done = true;
    if (ev.id === 'levee') { rec.levee.done = true; rec.levee.leak = holes.filter(h => !h.fixed).length / HOLES; events.push('leveeDone'); }
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
    events.length = 0;
    if (lastT !== null && t > lastT) for (const ev of EVENTS) if (lastT < ev.start && t >= ev.start) started.push(ev);
    lastT = t;
    for (const ev of EVENTS) if (t >= ev.end && !rec.closed[ev.id] && t < ev.end + 30) close(ev);
    layoutWeeds(t);
    const run = opts.running;
    // ハウスの雪：雪の日に積もり、重くなりすぎるとつぶれる
    const houseOn = t >= EV.house.start && t < EV.house.end && !rec.closed.house;
    if (houseOn && run && !rec.house.collapsed) {
      const snowing = opts.wx.kind === 'snow' ? opts.wx.precip : 0;
      rec.house.load += snowing * opts.gdt * 0.16;
      if (rec.house.load >= 1) { rec.house.collapsed = true; events.push('collapse'); audio.crash && audio.crash(); }
      else if (rec.house.load > 0.7 && !rec.house.warned) { rec.house.warned = true; events.push('houseWarn'); }
      if (rec.house.load < 0.5) rec.house.warned = false;
    }
    layoutHouse(t);
    thudTimer -= dt;
    updateChunks(dt); updatePuffs(dt);
    {
      const sc = snowCover(t), cl = Math.min(1, rec.house.cleared / 40);
      const h = 0.15 + 0.6 * sc + 0.9 * cl * sc;
      piles.forEach((m, i) => { m.visible = sc > 0.1; m.scale.set(1, h * (i ? 1 : 0.8), 0.9 + 0.5 * cl); });
    }
    layoutHoles(t);
    layoutSwans(t, time, opts.day);

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
    return { started, events: events.slice() };
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
    if (has('melt') && snowCover(t) > 0.2) n += field.meltAlong(a.x, a.z, b.x, b.z, r * 1.4);
    if (has('levee')) {
      const prog = clamp((t - EV.levee.start) / (EV.levee.end - EV.levee.start - 2));
      holes.forEach(h => { if (!h.fixed && h.at <= prog && near(h.x, h.z, r + 0.5)) { h.fixed = true; rec.levee.fixed++; n++; fx.burst(h.x, h.z, 3); } });
    }
    for (let i = bugs.length - 1; i >= 0; i--) if (near(bugs[i].x, bugs[i].z, r + 0.6)) { group.remove(bugs[i].sp); bugs.splice(i, 1); rec.bug.caught++; n++; }
    flocks.forEach(f => { if (f.state === 'in' && f.birds.some(bd => near(bd.sp.position.x, bd.sp.position.z, r + 1.5))) { shooFlock(f); n++; } });
    return n;
  }

  // 画面の光線でハウスをなぞる（雪下ろし）
  const hitP = new THREE.Vector3();
  function rayTest(ray, t) { return active(t).some(e => e.id === 'house') && !rec.house.collapsed && !!ray.ray.intersectBox(houseBox, hitP); }
  function rayHit(ray, t) {
    if (!rayTest(ray, t)) return 0;
    if (rec.house.load <= 0.001) return 0;
    rec.house.load = Math.max(0, rec.house.load - 0.035);
    rec.house.cleared++;
    spawnChunks(hitP, 2 + Math.round(R() * 2));
    return 1;
  }

  // ---------- 成績 ----------
  function weedRemaining() { return weeds.filter(w => !w.pulled && w.at <= 1).length; }
  function factors() {
    const tillF = rec.till == null ? 1 : 0.9 + 0.1 * rec.till;
    const levelF = rec.level == null ? 1 : 0.94 + 0.06 * rec.level;
    const plantF = rec.plant == null ? 1 : (rec.plant.self + 0.85 * (rec.plant.total - rec.plant.self)) / rec.plant.total;
    const weedF = !rec.skipped.weed && (rec.weed.done || rec.weed.pulled) ? 1 - 0.12 * weedRemaining() / WEEDS : 1;
    const bugQ = rec.bug.spawned ? 1 - 0.1 * (1 - rec.bug.caught / rec.bug.spawned) : 1;
    const houseF = rec.house.collapsed ? 0.9 : 1;                       // 苗が足りず、買い苗で遅れる
    const meltF = rec.melt == null ? 1 : 0.98 + 0.05 * rec.melt;          // 雪どけが早いと春の作業が順調
    const leakF = 1 - 0.06 * (rec.carryLeak || 0);                         // 去年の畦の穴から水がもれる
    return { tillF, levelF, plantF, weedF, bugQ, houseF, meltF, leakF, yieldF: tillF * levelF * plantF * weedF * houseF * meltF * leakF };
  }
  function progress(id, t) {
    if (id === 'till') return field.tillRatio();
    if (id === 'level') return field.levelRatio();
    if (id === 'plant') return field.countPlanted() / TOTAL;
    if (id === 'weed') { const prog = clamp((t - EVENTS[3].start) / (EVENTS[3].end - EVENTS[3].start - 3)); const sp = weeds.filter(w => w.at <= prog).length; return { pulled: rec.weed.pulled, shown: sp }; }
    if (id === 'bug') return { caught: rec.bug.caught, live: bugs.length };
    if (id === 'house') return { load: rec.house.load, collapsed: rec.house.collapsed };
    if (id === 'melt') return field.meltRatio();
    if (id === 'levee') { const prog = clamp((t - EV.levee.start) / (EV.levee.end - EV.levee.start - 2)); const shown = holes.filter(h => h.at <= prog).length; return { fixed: rec.levee.fixed, shown }; }
    if (id === 'bird') return { lost: rec.bird.lostKg, shooed: rec.bird.shooed, live: flocks.filter(f => f.state === 'in').length };
    return 0;
  }

  function reset() {
    const carry = rec.levee && rec.levee.done ? rec.levee.leak : 0;
    rec = fresh(); rec.carryLeak = carry;
    holes.forEach(h => (h.fixed = false)); weeds.forEach(w => (w.pulled = false));
    bugs.forEach(b => group.remove(b.sp)); bugs.length = 0;
    flocks.forEach(f => f.birds.forEach(b => group.remove(b.sp))); flocks.length = 0;
    lastT = null;
  }
  function serialize() { return { rec, weeds: weeds.map(w => (w.pulled ? 1 : 0)).join(''), holes: holes.map(h => (h.fixed ? 1 : 0)).join('') }; }
  function deserialize(d) {
    if (!d) return;
    rec = Object.assign(fresh(), d.rec || {});
    rec.skipped = rec.skipped || {};
    if (d.weeds) weeds.forEach((w, i) => (w.pulled = d.weeds[i] === '1'));
    if (d.holes) holes.forEach((h, i) => (h.fixed = d.holes[i] === '1'));
    rec.house = Object.assign({ load: 0, cleared: 0, collapsed: false, warned: false }, rec.house || {});
    rec.levee = Object.assign({ fixed: 0, done: false, leak: 0 }, rec.levee || {});
  }
  return { HOLES, update, swipe, rayTest, rayHit, active, factors, progress, reset, serialize, deserialize, skipPast, get rec() { return rec; }, WEEDS };
}
