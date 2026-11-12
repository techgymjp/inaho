// 田んぼ：区画・畦・水・稲・はざ掛け・刈り取り
import * as THREE from 'three';
import { Water } from 'three/addons/Water.js';
import { makeNoise, GLSL_NOISE } from './noise.js';
import { toon, hex } from './toon.js';
import { grassTexture } from './textures.js';
export const GRASS_TEX = grassTexture();
import { mergeGeos, BASIN_LEVEL } from './landscape.js';
import {
  clamp, smooth, riceGrowth, waterLevel, snowCover, foliage, PLANT_START, PLANT_END,
  HARVEST_START, HARVEST_END, HAZA_START, HAZA_END, PLOW_DAY, doyOf,
} from './calendar.js';

const N = makeNoise(777);

// 区画：3列×2段、1枚 20m×24m（約4.8アール）
export const COLS = 3, ROWS = 2, PW = 20, PD = 24, LEVEE = 0.9;
export const FIELD_W = COLS * PW + (COLS + 1) * LEVEE;
export const FIELD_D = ROWS * PD + (ROWS + 1) * LEVEE;
const X0 = -FIELD_W / 2, Z0 = -FIELD_D / 2;
const HILL_X = 0.4, ROW_Z = 0.5; // 株間・条間
const NX = Math.floor((PW - 0.4) / HILL_X), NZ = Math.floor((PD - 0.5) / ROW_Z);
export const PER_PADDY = NX * NZ;
export const TOTAL = PER_PADDY * COLS * ROWS;
export const KG_PER_HILL = (COLS * ROWS * PW * PD / 1000) * 540 / TOTAL; // 10a 当たり 540kg

export function paddyRect(p) {
  const c = p % COLS, r = Math.floor(p / COLS);
  const x = X0 + LEVEE + c * (PW + LEVEE), z = Z0 + LEVEE + r * (PD + LEVEE);
  return { x, z, w: PW, d: PD };
}

// ---------- テクスチャ（泥） ----------
function mudTextures() {
  const S = 512;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(S, S);
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    // タイル可能にするため周期的に
    const n = tileFbm(u, v);
    h[y * S + x] = n;
  }
  for (let i = 0; i < S * S; i++) {
    const n = h[i];
    const c = 205 + n * 45 + (N.rnd() - 0.5) * 16;
    img.data[i * 4] = c; img.data[i * 4 + 1] = c; img.data[i * 4 + 2] = c; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(cv);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  // 法線マップ
  const nv = document.createElement('canvas'); nv.width = nv.height = S;
  const nctx = nv.getContext('2d');
  const nimg = nctx.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const hx = h[y * S + ((x + 1) % S)] - h[y * S + ((x - 1 + S) % S)];
    const hy = h[((y + 1) % S) * S + x] - h[((y - 1 + S) % S) * S + x];
    const nx = -hx * 6, ny = -hy * 6, nz = 1;
    const l = Math.hypot(nx, ny, nz);
    const i = (y * S + x) * 4;
    nimg.data[i] = (nx / l * 0.5 + 0.5) * 255; nimg.data[i + 1] = (ny / l * 0.5 + 0.5) * 255;
    nimg.data[i + 2] = (nz / l * 0.5 + 0.5) * 255; nimg.data[i + 3] = 255;
  }
  nctx.putImageData(nimg, 0, 0);
  const nmap = new THREE.CanvasTexture(nv);
  nmap.wrapS = nmap.wrapT = THREE.RepeatWrapping;
  return { map, nmap };
}
// 周期的な値ノイズ（タイル可能）
function tileFbm(u, v) {
  let s = 0, amp = 0.5, P = 8;
  for (let o = 0; o < 5; o++) {
    s += amp * (pvn(u * P, v * P, P, o) * 2 - 1);
    amp *= 0.5; P *= 2;
  }
  return s;
}
function lat(i, j, P, o) { i = ((i % P) + P) % P; j = ((j % P) + P) % P; let n = i * 374761393 + j * 668265263 + o * 2147483647; n = (n ^ (n >> 13)) * 1274126177; return ((n ^ (n >> 16)) >>> 0) / 4294967295; }
function pvn(x, y, P, o) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = lat(i, j, P, o), b = lat(i + 1, j, P, o), c = lat(i, j + 1, P, o), d = lat(i + 1, j + 1, P, o);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function waterNormals() {
  const S = 256;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(S, S);
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) h[y * S + x] = tileFbm(x / S + 0.37, y / S + 0.11);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const hx = h[y * S + ((x + 1) % S)] - h[y * S + ((x - 1 + S) % S)];
    const hy = h[((y + 1) % S) * S + x] - h[((y - 1 + S) % S) * S + x];
    const nx = -hx * 3, ny = -hy * 3, nz = 1, l = Math.hypot(nx, ny, nz);
    const i = (y * S + x) * 4;
    img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255;
    img.data[i + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---------- 稲の形 ----------
function bladeClump(blades, segs) {
  const pos = [], nor = [];
  for (let b = 0; b < blades; b++) {
    const a = b / blades * Math.PI * 2 + N.rnd() * 0.6;
    const lean = 0.12 + N.rnd() * 0.32;           // 外への傾き
    const len = 0.75 + N.rnd() * 0.3;
    const w0 = 0.02 + N.rnd() * 0.01;
    const dx = Math.cos(a), dz = Math.sin(a);
    const px = -dz, pz = dx;                      // 幅方向
    const ox = (N.rnd() - 0.5) * 0.03, oz = (N.rnd() - 0.5) * 0.03;
    const pts = [];
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const out = lean * t * t * len;
      const y = len * (t - 0.25 * lean * t * t);
      const w = w0 * (1 - t * 0.92);
      const cx = ox + dx * out, cz = oz + dz * out;
      pts.push([cx - px * w, y, cz - pz * w], [cx + px * w, y, cz + pz * w]);
    }
    for (let s = 0; s < segs; s++) {
      const a0 = pts[s * 2], a1 = pts[s * 2 + 1], b0 = pts[s * 2 + 2], b1 = pts[s * 2 + 3];
      pos.push(...a0, ...a1, ...b1, ...a0, ...b1, ...b0);
      const nx = dx * 0.6, nz = dz * 0.6;
      for (let k = 0; k < 6; k++) nor.push(nx, 0.8, nz);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}
function earClump(count, segs, droop) {
  // 穂：茎の先から弧を描いて垂れる細長い帯（粒の凹凸つき）
  const pos = [], nor = [];
  const rnd = makeNoise(31).rnd;
  for (let e = 0; e < count; e++) {
    const a = e / count * Math.PI * 2 + rnd() * 0.8;
    const dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
    const baseOut = 0.06 + rnd() * 0.05;
    const baseY = 0.86 + rnd() * 0.14;
    const L = 0.2 + rnd() * 0.06;
    const pts = [];
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const ang = (0.15 + droop * 1.9) * t + 0.12;    // 垂れ角
      const out = baseOut + Math.sin(ang) * L * t;
      const y = baseY + Math.cos(ang) * L * t * (1 - droop * 0.2) - droop * 0.1 * t * t;
      const w = 0.022 * (1 - Math.pow(Math.abs(t - 0.45) * 1.6, 2) * 0.5) * (t < 0.08 ? 0.4 : 1);
      const cx = dx * out, cz = dz * out;
      pts.push([cx - px * w, y, cz - pz * w], [cx + px * w, y, cz + pz * w]);
    }
    for (let s = 0; s < segs; s++) {
      const a0 = pts[s * 2], a1 = pts[s * 2 + 1], b0 = pts[s * 2 + 2], b1 = pts[s * 2 + 3];
      pos.push(...a0, ...a1, ...b1, ...a0, ...b1, ...b0);
      for (let k = 0; k < 6; k++) nor.push(dx * 0.5, 0.85, dz * 0.5);
    }
    // 茎（穂の付け根まで）
    const sw = 0.005;
    const s0 = [dx * 0.0 - px * sw, 0.5, dz * 0.0 - pz * sw], s1 = [dx * 0.0 + px * sw, 0.5, dz * 0.0 + pz * sw];
    const t0 = [dx * baseOut - px * sw, baseY, dz * baseOut - pz * sw], t1 = [dx * baseOut + px * sw, baseY, dz * baseOut + pz * sw];
    pos.push(...s0, ...s1, ...t1, ...s0, ...t1, ...t0);
    for (let k = 0; k < 6; k++) nor.push(dx * 0.5, 0.85, dz * 0.5);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

// 風で揺れる植物マテリアル
function windMaterial(params, uniforms, stiffness = 1) {
  const m = toon(params);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.uniforms.uWind = uniforms.uWind;
    sh.uniforms.uWindDir = uniforms.uWindDir;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uWind; uniform vec2 uWindDir;
        varying float vH;` + GLSL_NOISE)
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        mvPosition = modelMatrix * mvPosition;
        vH = transformed.y;
        {
          vec2 ip = mvPosition.xz;
          // 田んぼを渡る風の波（稲穂の波）
          float wave = fbm2(ip*0.06 - uWindDir*uTime*0.55);
          float gust = smoothstep(0.35, 0.75, wave);
          float flutter = sin(uTime*3.1 + ip.x*1.9 + ip.y*1.3)*0.25 + sin(uTime*5.3 + ip.x*3.1)*0.1;
          float h = max(mvPosition.y - ${BASIN_LEVEL.toFixed(2)} + 0.35, 0.0);
          float k = pow(h, 1.5) * ${(0.42 / stiffness).toFixed(3)};
          float w = uWind * (0.25 + 1.1*gust + flutter*0.4);
          mvPosition.xz += uWindDir * w * k;
          mvPosition.y -= abs(w) * k * 0.35;
        }
        vec4 windWorld = mvPosition;
        mvPosition = viewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`)
      .replace('#include <worldpos_vertex>', `
        #if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
          vec4 worldPosition = windWorld;
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vH;')
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize(vNormal);')
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= mix(0.62, 1.1, smoothstep(0.0, 0.9, vH));`);
  };
  return m;
}

export function createField(scene, quality) {
  const group = new THREE.Group();
  scene.add(group);
  const uniforms = { uTime: { value: 0 }, uWind: { value: 0.3 }, uWindDir: { value: new THREE.Vector2(0.8, 0.6) } };

  // ---------- 田面 ----------
  const { map, nmap } = mudTextures();
  map.repeat.set(5, 6); nmap.repeat.set(5, 6);
  const mudMat = toon({ map, normalMap: nmap, normalScale: new THREE.Vector2(0.6, 0.6) });
  const floors = [];
  for (let p = 0; p < COLS * ROWS; p++) {
    const r = paddyRect(p);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.d).rotateX(-Math.PI / 2), mudMat);
    m.position.set(r.x + r.w / 2, 0, r.z + r.d / 2);
    m.receiveShadow = true;
    group.add(m); floors.push(m);
  }

  // ---------- 畦（台形断面） ----------
  const leveeGeos = [];
  const leveeProfile = (len, horiz) => {
    const shape = new THREE.Shape();
    const bw = LEVEE + 0.5, tw = LEVEE - 0.25, h = BASIN_LEVEL + 0.02;
    shape.moveTo(-bw / 2, -0.05); shape.lineTo(-tw / 2, h); shape.quadraticCurveTo(0, h + 0.05, tw / 2, h); shape.lineTo(bw / 2, -0.05);
    const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false, curveSegments: 3 });
    g.translate(0, 0, -len / 2);
    if (horiz) g.rotateY(Math.PI / 2);
    return g;
  };
  for (let c = 0; c <= COLS; c++) {
    const g = leveeProfile(FIELD_D, false);
    g.translate(X0 + LEVEE / 2 + c * (PW + LEVEE), 0, 0);
    leveeGeos.push(g);
  }
  for (let r = 0; r <= ROWS; r++) {
    const g = leveeProfile(FIELD_W, true);
    g.translate(0, 0, Z0 + LEVEE / 2 + r * (PD + LEVEE));
    leveeGeos.push(g);
  }
  const leveeMat = toon({ color: 0x6cb83f });
  const leveeTexAmt = { value: 1 };
  leveeMat.onBeforeCompile = (sh) => {
    sh.uniforms.uGrass = { value: GRASS_TEX };
    sh.uniforms.uTexAmt = leveeTexAmt;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp2;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp2 = (modelMatrix*vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp2; uniform sampler2D uGrass; uniform float uTexAmt;\n' + GLSL_NOISE)
      .replace('#include <color_fragment>', `#include <color_fragment>
        // 草はテクスチャで表現（上面は xz、斜面は xy/zy で投影）
        vec3 an = abs(normalize(cross(dFdx(vWp2), dFdy(vWp2))));
        float gt = an.y > 0.6 ? texture2D(uGrass, vWp2.xz*0.45).r : (an.x > an.z ? texture2D(uGrass, vWp2.zy*vec2(0.45,0.9)).r : texture2D(uGrass, vWp2.xy*vec2(0.45,0.9)).r);
        diffuseColor.rgb *= mix(1.0, 0.45 + 0.75*gt, uTexAmt);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.32,0.24,0.15), smoothstep(0.12, 0.0, vWp2.y)*0.6);`);
  };
  const levees = new THREE.Mesh(mergeGeos(leveeGeos), leveeMat);
  levees.receiveShadow = true; levees.castShadow = true;
  group.add(levees);

  // 用水路（コンクリートU字溝）北側
  const chanMat = toon({ color: 0xb9b6ad });
  const chanZ = Z0 - 1.3;
  for (const dz of [-0.45, 0.45]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(FIELD_W + 40, 0.5, 0.12), chanMat);
    wall.position.set(0, BASIN_LEVEL - 0.15, chanZ + dz);
    wall.receiveShadow = true;
    group.add(wall);
  }
  const chanWater = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W + 40, 0.8).rotateX(-Math.PI / 2),
    toon({ color: 0x5f8fb8 }));
  chanWater.position.set(0, BASIN_LEVEL - 0.28, chanZ);
  group.add(chanWater);

  // ---------- 水面 ----------
  const wn = waterNormals();
  const water = new Water(new THREE.PlaneGeometry(FIELD_W, FIELD_D), {
    textureWidth: quality.reflect, textureHeight: quality.reflect,
    waterNormals: wn, sunDirection: new THREE.Vector3(0, 1, 0), sunColor: 0xffffff,
    waterColor: 0x4a6a7a, distortionScale: 0.6, fog: true, alpha: 1,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.06;
  water.material.uniforms.size.value = 6;
  group.add(water);

  // ---------- 稲 ----------
  const bladeGeo = bladeClump(quality.blades, quality.bladeSegs);
  const riceMat = windMaterial({ color: 0x4d8a2a, side: THREE.DoubleSide }, uniforms);
  const rice = new THREE.InstancedMesh(bladeGeo, riceMat, TOTAL);
  rice.frustumCulled = false;
  let earGeo = earClump(quality.ears, quality.earSegs, 0);
  const earMat = windMaterial({ color: 0xc9a54a, side: THREE.DoubleSide }, uniforms);
  const ears = new THREE.InstancedMesh(earGeo, earMat, TOTAL);
  ears.frustumCulled = false;
  rice.receiveShadow = true; ears.receiveShadow = true;
  group.add(rice, ears);

  // ---------- 稲の群落面（株のすき間を埋めて、密な田んぼに見せる） ----------
  const canopyMask = new Uint8Array(NX * NZ * COLS * ROWS).fill(255);
  const maskTex = new THREE.DataTexture(canopyMask, NX * COLS, NZ * ROWS, THREE.RedFormat);
  maskTex.minFilter = maskTex.magFilter = THREE.LinearFilter;
  maskTex.needsUpdate = true;
  const canopyMat = toon({ color: 0x4d8a2a });
  canopyMat.onBeforeCompile = (sh) => {
    sh.uniforms.uMask = { value: maskTex };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCw;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvCw = (modelMatrix*vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uMask; varying vec3 vCw;\n' + GLSL_NOISE)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        vec2 muv = vec2((vCw.x - ${X0.toFixed(3)}) / ${FIELD_W.toFixed(3)}, (vCw.z - ${Z0.toFixed(3)}) / ${FIELD_D.toFixed(3)});
        if (texture2D(uMask, muv).r < 0.5) discard;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float fine = vnoise(vCw.xz*vec2(9.0, 14.0))*0.6 + vnoise(vCw.xz*2.5)*0.4;
        float rows = 0.9 + 0.1*sin(vCw.z*${(2 * Math.PI / ROW_Z).toFixed(4)});
        diffuseColor.rgb *= (0.78 + 0.32*fine) * rows;`);
  };
  const canopy = new THREE.Group();
  for (let p = 0; p < COLS * ROWS; p++) {
    const r = paddyRect(p);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r.w - 0.2, r.d - 0.25).rotateX(-Math.PI / 2), canopyMat);
    m.position.set(r.x + r.w / 2, 0, r.z + r.d / 2);
    m.receiveShadow = true;
    canopy.add(m);
  }
  group.add(canopy);
  // マスクの画素：区画をタイル状に並べた (x: 列×NX + j, y: 段×NZ + i)
  const maskIndex = (idx) => {
    const p = Math.floor(idx / PER_PADDY), k = idx % PER_PADDY, i = Math.floor(k / NX), j = k % NX;
    const c = p % COLS, rr = Math.floor(p / COLS);
    // 区画の間の畦の分だけずれるが、田面だけを描くので近似で十分
    const u = Math.floor(((paddyRect(p).x - X0) + 0.2 + j * HILL_X) / FIELD_W * NX * COLS);
    const v = Math.floor(((paddyRect(p).z - Z0) + 0.25 + i * ROW_Z) / FIELD_D * NZ * ROWS);
    void c; void rr;
    return Math.min(NZ * ROWS - 1, v) * NX * COLS + Math.min(NX * COLS - 1, u);
  };

  const hx = new Float32Array(TOTAL), hz = new Float32Array(TOTAL), hrot = new Float32Array(TOTAL), hs = new Float32Array(TOTAL), plantOrder = new Float32Array(TOTAL);
  let k = 0;
  for (let p = 0; p < COLS * ROWS; p++) {
    const r = paddyRect(p);
    for (let i = 0; i < NZ; i++) for (let j = 0; j < NX; j++) {
      hx[k] = r.x + 0.2 + j * HILL_X + (N.rnd() - 0.5) * 0.05;
      hz[k] = r.z + 0.25 + i * ROW_Z + (N.rnd() - 0.5) * 0.04;
      hrot[k] = N.rnd() * Math.PI * 2;
      hs[k] = 0.85 + N.rnd() * 0.3;
      // 田植えは区画ごと・往復しながら進む
      plantOrder[k] = (p + (i % 2 ? (NZ - 1 - i) : i) / NZ * 0 + i / NZ) / (COLS * ROWS);
      const v = 0.86 + N.rnd() * 0.28;
      rice.setColorAt(k, new THREE.Color(v, v * (0.95 + N.rnd() * 0.1), v));
      ears.setColorAt(k, new THREE.Color(v, v, v * (0.9 + N.rnd() * 0.2)));
      k++;
    }
  }

  // 状態: 0=未刈 1=刈った 2=倒伏
  const cut = new Uint8Array(TOTAL);
  const o = new THREE.Object3D();

  // ---------- はざ掛け ----------
  const haza = new THREE.Group();
  const woodMat = toon({ color: 0x7a5f45 });
  const RACKS = 3, RACK_LEN = 14, TIERS = 3;
  const bundlePos = [];
  for (let r = 0; r < RACKS; r++) {
    const x0 = -FIELD_W / 2 + 4 + r * (RACK_LEN + 4), z = 29.5;
    for (let i = 0; i <= 7; i++) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.9, 5), woodMat);
      pole.position.set(x0 + i * RACK_LEN / 7, BASIN_LEVEL + 1.4, z);
      pole.rotation.z = (i % 2 ? 0.1 : -0.1);
      pole.castShadow = true;
      haza.add(pole);
    }
    for (let t = 0; t < TIERS; t++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, RACK_LEN + 0.6, 5), woodMat);
      bar.rotation.z = Math.PI / 2;
      const y = BASIN_LEVEL + 0.85 + t * 0.75;
      bar.position.set(x0 + RACK_LEN / 2, y, z);
      haza.add(bar);
      for (let b = 0; b < RACK_LEN / 0.24; b++) bundlePos.push([x0 + 0.15 + b * 0.24, y, z]);
    }
  }
  // 稲束：竿にまたがる2つの房
  const bundleGeo = mergeGeos([
    new THREE.ConeGeometry(0.11, 0.65, 6, 1, true).rotateX(Math.PI).translate(0, -0.3, 0.07).rotateX(-0.18),
    new THREE.ConeGeometry(0.11, 0.65, 6, 1, true).rotateX(Math.PI).translate(0, -0.3, -0.07).rotateX(0.18),
  ]);
  const bundleMat = toon({ color: 0xd9b35a, side: THREE.DoubleSide });
  const bundles = new THREE.InstancedMesh(bundleGeo, bundleMat, bundlePos.length);
  bundlePos.forEach(([x, y, z], i) => {
    o.position.set(x, y, z); o.rotation.set(0, (N.rnd() - 0.5) * 0.3, 0); o.scale.set(1, 0.9 + N.rnd() * 0.2, 1);
    o.updateMatrix(); bundles.setMatrixAt(i, o.matrix);
  });
  bundles.castShadow = true;
  bundles.count = 0;
  haza.add(bundles);
  // 田んぼの東側の空き地に並べる（畦道からの眺めをさえぎらない）
  haza.rotation.y = Math.PI / 2;
  haza.position.set(6.5, 0, -2);
  group.add(haza);

  // ---------- 季節・日ごとの更新 ----------
  const C = (r, g, b) => new THREE.Color(r, g, b);
  const riceCol = { young: hex('#8fd14a'), deep: hex('#3f9a2e'), ripe: hex('#d9c23a'), late: hex('#b98f3c'), straw: hex('#cdb378') };
  const earCol = { green: hex('#6aa83a'), flower: hex('#9fc070'), gold: hex('#f2cf3c') };
  const mudCol = { wet: hex('#6e5a44'), dry: hex('#b39a78'), tilled: hex('#8a6a4a'), snow: hex('#ffffff').multiplyScalar(1.4), stubble: hex('#c7b088') };
  const leveeCol = { summer: hex('#5fae3a'), spring: hex('#8cca4c'), dry: hex('#bba468'), snow: hex('#f2f6fb') };
  const tmp = new THREE.Color();
  let lastDroop = -1, lastLayoutKey = '';

  function layout(t, force) {
    const g = riceGrowth(t);
    const plowed = t >= PLOW_DAY || t < PLANT_START;
    const plantProg = clamp((t - PLANT_START) / (PLANT_END - PLANT_START));
    const key = `${Math.floor(t * 4)}|${plowed}`;
    if (!force && key === lastLayoutKey) return;
    lastLayoutKey = key;
    let visibleEars = 0;
    for (let i = 0; i < TOTAL; i++) {
      let sx = 0, sy = 0, tilt = 0, ex = 0;
      if (g && !plowed && plantOrder[i] <= plantProg + 1e-6) {
        if (cut[i] === 1) { sx = 1; sy = 0.13; }
        else if (cut[i] === 2) { sx = 1.15; sy = g.h * 0.9 * hs[i]; tilt = 1.2; ex = 1; }
        else {
          const tiller = 0.45 + 0.55 * smooth(PLANT_START, doyOf(6, 30), t); // 分げつで株が広がる
          sx = tiller * (0.9 + hs[i] * 0.2); sy = g.h * hs[i]; ex = g.ear;
        }
      }
      o.position.set(hx[i], 0.0, hz[i]);
      o.rotation.set(0, hrot[i], 0);
      if (tilt) { o.rotation.set(tilt * Math.cos(hrot[i] * 3), hrot[i], tilt * Math.sin(hrot[i] * 3) * 0.6); }
      o.scale.set(sx || 1e-4, sy || 1e-4, sx || 1e-4);
      o.updateMatrix();
      rice.setMatrixAt(i, o.matrix);
      if (ex > 0.01 && sy > 0.2) {
        o.scale.set(sx, sy, sx);
        o.updateMatrix();
        ears.setMatrixAt(i, o.matrix);
        visibleEars++;
      } else {
        o.scale.setScalar(1e-4); o.updateMatrix(); ears.setMatrixAt(i, o.matrix);
      }
    }
    rice.instanceMatrix.needsUpdate = true;
    ears.instanceMatrix.needsUpdate = true;
    ears.visible = visibleEars > 0;
    rice.visible = !!g && !plowed;
    // 群落面：株が茂って田面が見えなくなる6月下旬から
    const close = g && !plowed ? smooth(doyOf(6, 10), doyOf(7, 5), t) : 0;
    canopy.visible = close > 0.02;
    canopy.position.y = g ? g.h * (0.15 + 0.62 * close) : 0;
    for (let i = 0; i < TOTAL; i++) canopyMask[maskIndex(i)] = cut[i] ? 0 : 255;
    maskTex.needsUpdate = true;
  }

  function update(t, force = false) {
    const g = riceGrowth(t);
    const wl = waterLevel(t), sc = snowCover(t), f = foliage(t);
    // 田面の色
    if (sc > 0.01) tmp.copy(mudCol.stubble).lerp(mudCol.snow, sc);
    else if (t >= PLOW_DAY || t < doyOf(4, 15)) tmp.copy(mudCol.stubble).lerp(mudCol.tilled, smooth(PLOW_DAY, PLOW_DAY + 4, t));
    else if (t < doyOf(4, 27)) tmp.copy(mudCol.tilled);
    else if (t < doyOf(9, 8)) tmp.copy(mudCol.tilled).lerp(mudCol.wet, wl).lerp(mudCol.dry, (1 - wl) * smooth(doyOf(6, 25), doyOf(7, 5), t) * 0.6);
    else tmp.copy(mudCol.wet).lerp(mudCol.dry, smooth(doyOf(9, 8), doyOf(9, 28), t) * 0.8);
    mudMat.color.copy(tmp);
    mudMat.normalScale.setScalar(0.6 * (1 - sc * 0.9));
    // 水面
    water.visible = wl > 0.02;
    water.position.y = 0.015 + 0.07 * wl;
    // 畦の色
    tmp.copy(leveeCol.dry).lerp(leveeCol.summer, f.green).lerp(leveeCol.spring, f.fresh).lerp(leveeCol.snow, sc);
    leveeMat.color.copy(tmp).multiplyScalar(1.12);
    leveeTexAmt.value = 1 - sc * 0.8;
    // 稲の色
    if (g) {
      tmp.copy(riceCol.young).lerp(riceCol.deep, smooth(PLANT_START + 10, doyOf(7, 10), t))
        .lerp(riceCol.ripe, g.ripe).lerp(riceCol.late, g.late);
      if (t >= HARVEST_END) tmp.lerp(riceCol.straw, smooth(HARVEST_END, HARVEST_END + 10, t));
      riceMat.color.copy(tmp);
      canopyMat.color.copy(tmp).multiplyScalar(0.82);
      tmp.copy(earCol.green).lerp(earCol.flower, smooth(doyOf(7, 30), doyOf(8, 6), t) * (1 - g.ripe)).lerp(earCol.gold, g.ripe);
      earMat.color.copy(tmp);
      const droop = Math.round(g.droop * 10) / 10;
      if (droop !== lastDroop) {
        lastDroop = droop;
        const ng = earClump(quality.ears, quality.earSegs, droop);
        ears.geometry.dispose();
        ears.geometry = ng;
      }
    }
    layout(t, force);
    // はざ掛け
    const harvested = countCut();
    const hzOn = t >= HAZA_START && t < HAZA_END;
    haza.visible = t >= HAZA_START - 3 && t < HAZA_END + 2;
    bundles.count = hzOn ? Math.round(bundlePos.length * Math.min(1, harvested / TOTAL)) : 0;
    tmp.set('#e2bd55').lerp(hex('#c7a564'), smooth(HAZA_START, HAZA_END, t));
    bundleMat.color.copy(tmp);
  }

  function countCut() { let n = 0; for (let i = 0; i < TOTAL; i++) if (cut[i] === 1) n++; return n; }

  // ---------- 刈り取り ----------
  // 線分 a→b（地面上）の半径 r 以内の株を刈る。刈った株の位置を返す
  function cutAlong(ax, az, bx, bz, r) {
    const out = [];
    const minX = Math.min(ax, bx) - r, maxX = Math.max(ax, bx) + r, minZ = Math.min(az, bz) - r, maxZ = Math.max(az, bz) + r;
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-6;
    for (let p = 0; p < COLS * ROWS; p++) {
      const R = paddyRect(p);
      if (maxX < R.x || minX > R.x + R.w || maxZ < R.z || minZ > R.z + R.d) continue;
      const j0 = Math.max(0, Math.floor((minX - R.x - 0.2) / HILL_X)), j1 = Math.min(NX - 1, Math.ceil((maxX - R.x - 0.2) / HILL_X));
      const i0 = Math.max(0, Math.floor((minZ - R.z - 0.25) / ROW_Z)), i1 = Math.min(NZ - 1, Math.ceil((maxZ - R.z - 0.25) / ROW_Z));
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const idx = p * PER_PADDY + i * NX + j;
        if (cut[idx]) continue;
        const px = hx[idx] - ax, pz = hz[idx] - az;
        const s = clamp((px * dx + pz * dz) / L2);
        const ex = px - dx * s, ez = pz - dz * s;
        if (ex * ex + ez * ez <= r * r) { cut[idx] = 1; out.push(idx); }
      }
    }
    if (out.length) {
      for (const idx of out) {
        o.position.set(hx[idx], 0, hz[idx]); o.rotation.set(0, hrot[idx], 0); o.scale.set(1, 0.13, 1); o.updateMatrix();
        rice.setMatrixAt(idx, o.matrix);
        o.scale.setScalar(1e-4); o.updateMatrix(); ears.setMatrixAt(idx, o.matrix);
      }
      rice.instanceMatrix.needsUpdate = true; ears.instanceMatrix.needsUpdate = true;
      for (const idx of out) canopyMask[maskIndex(idx)] = 0;
      maskTex.needsUpdate = true;
    }
    return out;
  }
  function lodgeRemaining() { let n = 0; for (let i = 0; i < TOTAL; i++) if (!cut[i]) { cut[i] = 2; n++; } lastLayoutKey = ''; return n; }
  function resetYear() { cut.fill(0); lastLayoutKey = ''; }
  function serialize() {
    let s = ''; for (let i = 0; i < TOTAL; i += 4) s += String.fromCharCode(65 + (cut[i] | ((cut[i + 1] || 0) << 2)), 65 + ((cut[i + 2] || 0) | ((cut[i + 3] || 0) << 2)));
    return s;
  }
  function deserialize(s) {
    if (!s || s.length !== Math.ceil(TOTAL / 4) * 2) return;
    for (let i = 0, c = 0; i < TOTAL; i += 4, c += 2) {
      const a = s.charCodeAt(c) - 65, b = s.charCodeAt(c + 1) - 65;
      cut[i] = a & 3; if (i + 1 < TOTAL) cut[i + 1] = (a >> 2) & 3;
      if (i + 2 < TOTAL) cut[i + 2] = b & 3; if (i + 3 < TOTAL) cut[i + 3] = (b >> 2) & 3;
    }
    lastLayoutKey = '';
  }

  function tick(time, wind, windDir, sunDir, camera) {
    uniforms.uTime.value = time;
    uniforms.uWind.value = wind;
    uniforms.uWindDir.value.copy(windDir);
    water.material.uniforms.time.value = time * 0.25 * (0.3 + wind);
    water.material.uniforms.sunDirection.value.copy(sunDir);
    water.material.uniforms.distortionScale.value = 0.3 + wind * 1.6;
    water.material.uniforms.eye.value.copy(camera.position);
  }

  function setQualityGeo(q) {
    rice.geometry.dispose();
    rice.geometry = bladeClump(q.blades, q.bladeSegs);
    quality = q; lastDroop = -1;
  }

  return {
    group, update, tick, cutAlong, lodgeRemaining, resetYear, countCut, serialize, deserialize, setQualityGeo,
    water, cut, hx, hz, isHarvestable: (t) => t >= HARVEST_START && t < HARVEST_END,
  };
}
