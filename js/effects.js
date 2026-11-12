// 雨・雪・蛍・赤とんぼ・刈り取りのわらくず
import * as THREE from 'three';
import { makeNoise } from './noise.js';
import { smooth, doyOf } from './calendar.js';
import { FIELD_W, FIELD_D } from './field.js';
import { BASIN_LEVEL } from './landscape.js';

const N = makeNoise(4242);

export function createEffects(scene, quality = {}) {
  // ---------- 雨 ----------
  const RAIN = quality.light ? 2000 : 6000, BOX = 60, TOP = 30;
  const rp = new Float32Array(RAIN * 6);
  const rainSeed = new Float32Array(RAIN * 3);
  for (let i = 0; i < RAIN; i++) rainSeed.set([N.rnd() * BOX - BOX / 2, N.rnd() * TOP, N.rnd() * BOX - BOX / 2], i * 3);
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: 0xaab4c0, transparent: true, opacity: 0.35, depthWrite: false });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  scene.add(rain);

  // ---------- 雪 ----------
  const SNOW = quality.light ? 1800 : 5000;
  const snowSeed = new Float32Array(SNOW * 4);
  for (let i = 0; i < SNOW; i++) snowSeed.set([N.rnd() * BOX - BOX / 2, N.rnd() * TOP, N.rnd() * BOX - BOX / 2, N.rnd()], i * 4);
  const snp = new Float32Array(SNOW * 3);
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snp, 3));
  const snowMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.9, depthWrite: false, map: dotTexture() });
  const snow = new THREE.Points(snowGeo, snowMat);
  snow.frustumCulled = false;
  scene.add(snow);

  // ---------- 蛍 ----------
  const FF = 160;
  const ffSeed = new Float32Array(FF * 4);
  for (let i = 0; i < FF; i++) {
    const side = N.rnd();
    // 用水路と畦のまわり
    const x = (N.rnd() - 0.5) * (FIELD_W + 20);
    const z = side < 0.5 ? -FIELD_D / 2 - 1.3 + (N.rnd() - 0.5) * 5 : (N.rnd() - 0.5) * FIELD_D;
    ffSeed.set([x, z, N.rnd() * 100, 0.3 + N.rnd() * 1.6], i * 4);
  }
  const ffPos = new Float32Array(FF * 3), ffA = new Float32Array(FF);
  const ffGeo = new THREE.BufferGeometry();
  ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  ffGeo.setAttribute('alpha', new THREE.BufferAttribute(ffA, 1));
  const ffMat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: `attribute float alpha; varying float vA; void main(){ vA = alpha; vec4 mv = modelViewMatrix*vec4(position,1.0);
      gl_Position = projectionMatrix*mv; gl_PointSize = clamp(60.0/-mv.z, 2.0, 14.0); }`,
    fragmentShader: `uniform float uOpacity; varying float vA; void main(){ float d = length(gl_PointCoord-0.5);
      float a = smoothstep(0.5, 0.0, d); a = a*a; gl_FragColor = vec4(vec3(0.75,1.0,0.35)*a*vA*uOpacity*2.0, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const fireflies = new THREE.Points(ffGeo, ffMat);
  fireflies.frustumCulled = false;
  scene.add(fireflies);

  // ---------- 赤とんぼ ----------
  const DF = 40;
  const dfGeo = new THREE.BufferGeometry();
  {
    const body = new THREE.CylinderGeometry(0.008, 0.006, 0.07, 4).rotateX(Math.PI / 2).toNonIndexed();
    const wing = new THREE.PlaneGeometry(0.11, 0.022).rotateX(-Math.PI / 2).toNonIndexed();
    const parts = [body, wing.clone().translate(0, 0.004, -0.012), wing.clone().translate(0, 0.004, 0.0)];
    let n = 0; parts.forEach(p => (n += p.attributes.position.count));
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    let o = 0;
    parts.forEach((p, k) => {
      pos.set(p.attributes.position.array, o * 3);
      for (let i = 0; i < p.attributes.position.count; i++) col.set(k === 0 ? [0.55, 0.06, 0.02] : [0.8, 0.8, 0.85], (o + i) * 3);
      o += p.attributes.position.count;
    });
    dfGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    dfGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    dfGeo.computeVertexNormals();
  }
  const dragonflies = new THREE.InstancedMesh(dfGeo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }), DF);
  dragonflies.frustumCulled = false;
  scene.add(dragonflies);
  const dfSeed = Array.from({ length: DF }, () => ({ x: (N.rnd() - 0.5) * FIELD_W, z: (N.rnd() - 0.5) * FIELD_D + 10, p: N.rnd() * 100, h: 1 + N.rnd() * 3 }));

  // ---------- わらくず ----------
  const STRAW = 900;
  const sp = new Float32Array(STRAW * 3), sv = new Float32Array(STRAW * 3), sl = new Float32Array(STRAW);
  const strawGeo = new THREE.BufferGeometry();
  strawGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const strawMat = new THREE.PointsMaterial({ color: 0xd8b860, size: 0.07, transparent: true, opacity: 0.95, depthWrite: false, map: dotTexture() });
  const straw = new THREE.Points(strawGeo, strawMat);
  straw.frustumCulled = false;
  scene.add(straw);
  let strawHead = 0;
  for (let i = 0; i < STRAW; i++) sp[i * 3 + 1] = -100;

  function burst(x, z, n = 3) {
    for (let k = 0; k < n; k++) {
      const i = strawHead; strawHead = (strawHead + 1) % STRAW;
      sp.set([x + (N.rnd() - 0.5) * 0.3, 0.5 + N.rnd() * 0.4, z + (N.rnd() - 0.5) * 0.3], i * 3);
      sv.set([(N.rnd() - 0.5) * 2.5, 1.5 + N.rnd() * 2.5, (N.rnd() - 0.5) * 2.5], i * 3);
      sl[i] = 1.2 + N.rnd();
    }
  }

  const o = new THREE.Object3D();
  function update(dt, time, t, wx, light, camera, windDir) {
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    // 雨
    const rainOn = wx.kind === 'rain' ? wx.precip : 0;
    rain.visible = rainOn > 0.01;
    if (rain.visible) {
      const n = Math.floor(RAIN * rainOn);
      rainGeo.setDrawRange(0, n * 2);
      for (let i = 0; i < n; i++) {
        const fall = (time * 14 + rainSeed[i * 3 + 1]) % TOP;
        const x = cx + wrap(rainSeed[i * 3] + windDir.x * fall * 0.2 - cx, BOX);
        const z = cz + wrap(rainSeed[i * 3 + 2] + windDir.y * fall * 0.2 - cz, BOX);
        const y = cy + TOP * 0.6 - fall;
        rp.set([x, y, z, x + windDir.x * 0.08, y - 0.55, z + windDir.y * 0.08], i * 6);
      }
      rainGeo.attributes.position.needsUpdate = true;
      rainMat.opacity = 0.18 + 0.25 * light.day;
      rainMat.color.setRGB(0.6, 0.65, 0.72).multiplyScalar(0.25 + 0.75 * light.day);
    }
    // 雪
    const snowOn = wx.kind === 'snow' ? wx.precip : 0;
    snow.visible = snowOn > 0.01;
    if (snow.visible) {
      const n = Math.floor(SNOW * snowOn);
      snowGeo.setDrawRange(0, n);
      for (let i = 0; i < n; i++) {
        const s = snowSeed[i * 4 + 3];
        const fall = (time * (0.9 + s * 0.6) + snowSeed[i * 4 + 1]) % TOP;
        const x = cx + wrap(snowSeed[i * 4] + Math.sin(time * 0.7 + s * 30) * 0.6 + windDir.x * fall * 0.5 - cx, BOX);
        const z = cz + wrap(snowSeed[i * 4 + 2] + Math.cos(time * 0.5 + s * 20) * 0.6 + windDir.y * fall * 0.5 - cz, BOX);
        snp.set([x, cy + TOP * 0.6 - fall, z], i * 3);
      }
      snowGeo.attributes.position.needsUpdate = true;
      snowMat.color.setScalar(0.25 + 0.75 * light.day);
    }
    // 蛍：6月中旬〜7月中旬の夜
    const ffSeason = smooth(doyOf(6, 12), doyOf(6, 22), t) * (1 - smooth(doyOf(7, 12), doyOf(7, 22), t));
    const ffOn = ffSeason * (1 - light.day) * (wx.kind === 'rain' ? 0.2 : 1);
    fireflies.visible = ffOn > 0.01;
    if (fireflies.visible) {
      ffMat.uniforms.uOpacity.value = ffOn;
      for (let i = 0; i < FF; i++) {
        const p = ffSeed[i * 4 + 2], h = ffSeed[i * 4 + 3];
        ffPos.set([ffSeed[i * 4] + Math.sin(time * 0.3 + p) * 1.5, BASIN_LEVEL + h + Math.sin(time * 0.7 + p * 2) * 0.3, ffSeed[i * 4 + 1] + Math.cos(time * 0.25 + p) * 1.5], i * 3);
        const blink = Math.sin(time * 2.2 + p * 7);
        ffA[i] = Math.max(0, blink) ** 3;
      }
      ffGeo.attributes.position.needsUpdate = true;
      ffGeo.attributes.alpha.needsUpdate = true;
    }
    // 赤とんぼ：8月下旬〜10月中旬の昼
    const dfSeason = smooth(doyOf(8, 25), doyOf(9, 5), t) * (1 - smooth(doyOf(10, 10), doyOf(10, 22), t));
    const dfOn = dfSeason * light.day * (wx.kind === 'clear' || wx.kind === 'cloudy' ? 1 : 0);
    dragonflies.visible = dfOn > 0.2;
    if (dragonflies.visible) {
      dfSeed.forEach((d, i) => {
        const a = time * 0.4 + d.p;
        const x = d.x + Math.sin(a) * 6 + Math.sin(a * 2.7) * 1.5, z = d.z + Math.cos(a * 0.8) * 6;
        o.position.set(x, BASIN_LEVEL + d.h + Math.sin(a * 3) * 0.3, z);
        o.rotation.set(0, -a + Math.PI / 2, 0);
        o.scale.setScalar(1.6);
        o.updateMatrix();
        dragonflies.setMatrixAt(i, o.matrix);
      });
      dragonflies.instanceMatrix.needsUpdate = true;
    }
    // わらくず
    for (let i = 0; i < STRAW; i++) {
      if (sl[i] <= 0) continue;
      sl[i] -= dt;
      sv[i * 3 + 1] -= 9.8 * dt * 0.6;
      sp[i * 3] += (sv[i * 3] + windDir.x) * dt; sp[i * 3 + 1] += sv[i * 3 + 1] * dt; sp[i * 3 + 2] += (sv[i * 3 + 2] + windDir.y) * dt;
      if (sp[i * 3 + 1] < 0.1) { sp[i * 3 + 1] = 0.1; sv.fill(0, i * 3, i * 3 + 3); }
      if (sl[i] <= 0) sp[i * 3 + 1] = -100;
    }
    strawGeo.attributes.position.needsUpdate = true;
  }
  return { update, burst };
}

function wrap(v, box) { return ((v + box / 2) % box + box) % box - box / 2; }
function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
