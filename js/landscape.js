// 山・空・雲・光・森・家などの風景
import * as THREE from 'three';
import { toon, hex } from './toon.js';
import { makeNoise, GLSL_NOISE } from './noise.js';
import { clamp, smooth, foliage, snowLine, snowCover, sakura } from './calendar.js';

const N = makeNoise(20111);
export const BASIN_LEVEL = 0.35;
// 田んぼ全体の半幅（field.js と同じ値：3×20m + 畦4本、2×24m + 畦3本）
const FIELD_HALF_W = (3 * 20 + 4 * 0.9) / 2, FIELD_HALF_D = (2 * 24 + 3 * 0.9) / 2;

// ---------- 地形の高さ ----------
export function terrainHeight(x, z) {
  // 盆地（やや東西に長い）
  const r = Math.hypot(x * 0.8, z);
  const warp = N.fbm(x / 600, z / 600, 3) * 160;
  const rr = r + warp * smooth(120, 500, r);
  const rise = smooth(380, 1900, rr);
  let h = BASIN_LEVEL;
  // 盆地の微起伏（田んぼの周りは平ら）
  const nearFlat = smooth(60, 160, r);
  h += nearFlat * (1.5 + N.fbm(x / 90, z / 90, 3) * 2.5) * (1 - rise);
  // 低い里山（丸みのある丘）
  const northH = smooth(0.3, 0.8, -z / Math.max(r, 1));
  const hills = Math.max(0, N.fbm(x / 380 + 5, z / 380, 3) + 0.15) * 110 * smooth(160, 420, r) * smooth(160, 420, rr) * (1 - 0.85 * northH)
    // 北の中景：森におおわれた低い丘の連なり（線路と集落の奥）
    + northH * smooth(1100, 1600, r) * (1 - smooth(3600, 5000, r)) * (22 + 40 * (N.fbm(x / 420 + 2, z / 420, 3) * 0.5 + 0.5));
  // 奥山（なだらかな山並み）。北側は低くして名峰を引き立てる
  const m = N.fbm(x / 1100, z / 1100, 3) * 0.5 + 0.5;
  const north = smooth(0.35, 0.85, -z / Math.max(r, 1));
  const mountain = smooth(250, 500, r) * Math.pow(rise, 1.2) * (200 + 650 * Math.pow(m, 1.6)) * (1 - 0.97 * north);
  const base = h + hills + mountain + bandai(x, z) * smooth(200, 900, r);
  // 鉄道の通り道は平らにならす（切通し）。遠くの山にはトンネルで入る
  const corridor = smooth(34, 10, Math.abs(z - RAIL_Z)) * smooth(1500, 1000, Math.abs(x));
  return base + (Math.min(base, BASIN_LEVEL + 1.2) - base) * corridor;
}
export const RAIL_Z = -150;

// 北にそびえる名峰（参考写真の磐梯山の姿）：とがった主峰と、右へ延びる稜線の先の副峰
const P1 = [-500, -9000], P2 = [2300, -9400];
function bandai(x, z) {
  const d1 = Math.hypot(x - P1[0], z - P1[1]);
  const d2 = Math.hypot(x - P2[0], z - P2[1]);
  // 稜線（主峰と副峰を結ぶ線分までの距離）
  const vx = P2[0] - P1[0], vz = P2[1] - P1[1];
  const tt = clamp(((x - P1[0]) * vx + (z - P1[1]) * vz) / (vx * vx + vz * vz));
  const ds = Math.hypot(x - P1[0] - vx * tt, z - P1[1] - vz * tt);
  const main = 1350 * Math.exp(-Math.pow(d1 / 2100, 1.15));
  const sub = 900 * Math.exp(-Math.pow(d2 / 1800, 1.35));
  const ridge = (760 - 120 * Math.sin(tt * Math.PI)) * Math.exp(-Math.pow(ds / 1550, 1.5)) * smooth(0, 0.15, tt) * smooth(1, 0.85, tt);
  const skirt = 320 * Math.exp(-Math.pow(Math.hypot((x - 900) / 1.6, z + 8800) / 4800, 2)); // 広い裾野
  const bumps = 1 + 0.06 * N.fbm(x / 500, z / 500, 3);
  return (Math.max(main, sub, ridge) + skirt) * bumps;
}

// 半径 u (−1..1) を中心が細かくなるように引き延ばす
function warpCoord(u, ext) { return Math.sign(u) * ext * Math.pow(Math.abs(u), 1.9); }

export function createLandscape(scene, renderer, quality) {
  const group = new THREE.Group();
  scene.add(group);

  // ---------- 空（イラスト調のグラデーション） ----------
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGround: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize((modelMatrix*vec4(position,1.0)).xyz - cameraPosition);
      vec4 p = projectionMatrix*viewMatrix*vec4((modelMatrix*vec4(position,1.0)).xyz,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 uZenith, uHorizon, uGround, uSunDir, uSunCol, uGlow; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.55));
        col = mix(col, uGround, smoothstep(0.0, -0.08, h));
        float sd = max(dot(d, uSunDir), 0.0);
        col += uGlow * pow(sd, 6.0) * (1.0 - clamp(h, 0.0, 1.0)*0.6);
        col = mix(col, uSunCol, smoothstep(0.9993, 0.9996, sd));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(40000, 32, 16), skyMat);
  sky.renderOrder = -2;
  sky.frustumCulled = false;
  scene.add(sky);

  // ---------- 星と月 ----------
  const starGeo = new THREE.BufferGeometry();
  const starCount = 2600;
  const sp = new Float32Array(starCount * 3), sc = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const u = N.rnd(), v = N.rnd();
    const th = 2 * Math.PI * u, ph = Math.acos(1 - v * 1.05);
    const R = 30000;
    sp.set([R * Math.sin(ph) * Math.cos(th), R * Math.cos(ph), R * Math.sin(ph) * Math.sin(th)], i * 3);
    sc[i] = Math.pow(N.rnd(), 6) * 2.5 + 0.6;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  starGeo.setAttribute('size', new THREE.BufferAttribute(sc, 1));
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `attribute float size; varying float vS; varying float vSeed;
      void main(){ vS = size; vSeed = position.x*0.013+position.z*0.007; vec4 mv = modelViewMatrix*vec4(position,1.0);
      gl_Position = projectionMatrix*mv; gl_PointSize = size*1.6; }`,
    fragmentShader: `uniform float uOpacity; uniform float uTime; varying float vS; varying float vSeed;
      void main(){ vec2 c = gl_PointCoord-0.5; float d = length(c); float a = smoothstep(0.5,0.0,d);
      float tw = 0.75+0.25*sin(uTime*3.0+vSeed*50.0);
      gl_FragColor = vec4(vec3(0.85,0.9,1.0)*a*tw*uOpacity*min(vS,1.6), 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  scene.add(stars);

  const moonMat = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: new THREE.Vector3() }, uOpacity: { value: 1 } },
    vertexShader: `varying vec3 vN; void main(){ vN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `uniform vec3 uSun; uniform float uOpacity; varying vec3 vN;
      void main(){ float l = smoothstep(-0.05,0.15,dot(vN,uSun)); vec3 c = vec3(1.0,0.97,0.88)*(0.03+1.6*l);
      gl_FragColor = vec4(c, uOpacity);} `,
    transparent: true, fog: false, depthWrite: false,
  });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(260, 32, 16), moonMat);
  scene.add(moon);

  // ---------- 雲 ----------
  const cloudMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uCover: { value: 0.3 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunCol: { value: new THREE.Color(1, 1, 1) }, uAmb: { value: new THREE.Color(0.5, 0.55, 0.6) },
      uDark: { value: 0 }, uCam: { value: new THREE.Vector3() },
    },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: GLSL_NOISE + `
      uniform float uTime, uCover, uDark; uniform vec3 uSunDir, uSunCol, uAmb, uCam; varying vec3 vW;
      void main(){
        vec2 p = vW.xz/2600.0 + vec2(uTime*0.004, uTime*0.0015);
        float n = fbm2(p) * 0.7 + fbm2(p*2.7 + 4.0)*0.3;
        float cov = mix(0.66, 0.2, uCover);
        float d = smoothstep(cov, cov+0.05, n);                 // くっきりした輪郭
        float core = smoothstep(cov+0.03, cov+0.2, n);
        vec2 sd = normalize(uSunDir.xz+1e-4)*0.025;
        float n2 = fbm2(p+sd)*0.7 + fbm2((p+sd)*2.7+4.0)*0.3;
        float lit = step(n2, n + 0.012);                         // 日なたと日かげの2トーン
        vec3 white = uSunCol + uAmb*0.35;
        vec3 shade = mix(uAmb*1.1, white, 0.55);
        vec3 col = mix(shade, white, mix(lit, 1.0, 1.0-core*0.8));
        col = mix(col, uAmb*0.9, uCover*core*0.55);
        col *= 1.0 - uDark*0.95;
        float dist = length(vW.xz - uCam.xz);
        float fade = 1.0 - smoothstep(12000.0, 30000.0, dist);
        gl_FragColor = vec4(col, d*fade);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
  });
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000).rotateX(Math.PI / 2), cloudMat);
  clouds.position.y = 1800;
  clouds.renderOrder = -1;
  scene.add(clouds);

  // ---------- 入道雲（遠くの山の向こうにわく積雲） ----------
  const cumulus = buildCumulus();
  scene.add(cumulus.group);

  // ---------- 光 ----------
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadow, quality.shadow);
  const sc2 = sun.shadow.camera;
  sc2.left = -70; sc2.right = 70; sc2.top = 70; sc2.bottom = -70; sc2.near = 10; sc2.far = 600;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const moonLight = new THREE.DirectionalLight(0x9fb4ff, 0);
  scene.add(moonLight);
  const hemi = new THREE.HemisphereLight(0xcfe4ff, 0x6f7a4a, 1.2);
  scene.add(hemi);

  // ---------- 地形 ----------
  const SEG = quality.terrainSeg, EXT = 16000;
  const tGeo = new THREE.PlaneGeometry(2, 2, SEG, SEG).rotateX(-Math.PI / 2);
  const tp = tGeo.attributes.position;
  const vCount = tp.count;
  const vInfo = new Float32Array(vCount * 4); // [height, forestMix, hueNoise, rockiness]
  for (let i = 0; i < vCount; i++) {
    const x = warpCoord(tp.getX(i), EXT), z = warpCoord(tp.getZ(i), EXT);
    const y = terrainHeight(x, z);
    tp.setXYZ(i, x, y, z);
  }
  tGeo.computeVertexNormals();
  const tn = tGeo.attributes.normal;
  for (let i = 0; i < vCount; i++) {
    const x = tp.getX(i), z = tp.getZ(i);
    vInfo[i * 4] = tp.getY(i);
    vInfo[i * 4 + 1] = clamp(0.5 + N.fbm(x / 350 + 9, z / 350, 3) * 1.4 + (tp.getY(i) - 300) / 900); // 針葉樹の割合
    vInfo[i * 4 + 2] = N.fbm(x / 70, z / 70, 3) * 0.5 + 0.5;
    vInfo[i * 4 + 3] = smooth(0.82, 0.62, tn.getY(i)) * smooth(250, 600, tp.getY(i));
  }
  const tCol = new Float32Array(vCount * 3);
  tGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
  const tMat = toon({ vertexColors: true });
  tMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix*vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;\n' + GLSL_NOISE)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        // 田んぼの部分は地形をくり抜く
        if (abs(vWp.x) < ${(FIELD_HALF_W).toFixed(2)} && abs(vWp.z) < ${(FIELD_HALF_D).toFixed(2)}) discard;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        // 森の樹冠のざらつき（距離で弱める）
        float camD = length(vWp - cameraPosition);
        vec2 cp = vec2(vWp.x + vWp.z*0.5, vWp.z - vWp.x*0.5 + vWp.y);
        float canopy = vnoise(cp*0.3)*0.6 + vnoise(cp*1.1)*0.4;
        float broad = fbm2(vWp.xz*0.02);
        float k = smoothstep(4.0, 40.0, vWp.y) * (1.0 - smoothstep(600.0, 4000.0, camD));
        // イラスト調：木々のもこもこを段階的な明暗で
        float blob = step(0.52, canopy);
        diffuseColor.rgb *= mix(1.0, 0.86 + 0.22*blob, k);
        diffuseColor.rgb *= 0.93 + 0.14*step(0.5, broad);
        float g = smoothstep(4.0, 1.0, vWp.y);
        diffuseColor.rgb *= mix(1.0, 0.94 + 0.1*step(0.5, vnoise(vWp.xz*0.08)), g);`);
  };
  const terrain = new THREE.Mesh(tGeo, tMat);
  terrain.receiveShadow = true;
  group.add(terrain);

  // ---------- 森（インスタンス） ----------
  const forest = buildForest(quality);
  group.add(forest.group);

  // ---------- 里の建物・桜・電柱 ----------
  const village = buildVillage();
  group.add(village.group);

  // ---------- 北の丘のふもとの集落 ----------
  group.add(buildHamlet());

  // ---------- 鉄道（遠くを走るローカル線） ----------
  const railway = buildRailway();
  group.add(railway.group);

  // ---------- 季節の色 ----------
  const C = (r, g, b) => new THREE.Color(r, g, b);
  const col = {
    conifer: hex('#24582f'), broadSummer: hex('#3d8a34'), broadFresh: hex('#82c650'),
    red: hex('#d4542a'), orange: hex('#e58a30'), yellow: hex('#e9c443'),
    bare: hex('#8a7a62'), rock: hex('#8c8f96'), snow: hex('#f2f6fb'),
    grassSummer: hex('#6cb83f'), grassSpring: hex('#93d052'), grassDry: hex('#b9a564'),
  };
  const tmp = new THREE.Color(), tmp2 = new THREE.Color();

  function updateSeason(t) {
    const f = foliage(t), sl = snowLine(t), sc = snowCover(t);
    for (let i = 0; i < vCount; i++) {
      const h = vInfo[i * 4], fm = vInfo[i * 4 + 1], hue = vInfo[i * 4 + 2], rock = vInfo[i * 4 + 3];
      // 広葉樹の色
      tmp.copy(col.bare).lerp(col.broadSummer, f.green).lerp(col.broadFresh, f.fresh * 0.8);
      if (f.autumn > 0) {
        tmp2.copy(hue < 0.4 ? col.red : hue < 0.7 ? col.orange : col.yellow);
        // 標高が高いほど早く色づく
        const a = clamp(f.autumn + (h - 300) / 900);
        tmp.lerp(tmp2, a * 0.95);
      }
      // 針葉樹と混ぜる
      tmp.lerp(col.conifer, fm * 0.85);
      // 盆地の草地
      const flat = smooth(30, 5, h);
      tmp2.copy(col.grassDry).lerp(col.grassSummer, f.green).lerp(col.grassSpring, f.fresh);
      tmp.lerp(tmp2, flat);
      tmp.lerp(col.rock, rock * 0.8);
      // 雪（雪線より上、冬は全体）
      let s = smooth(sl - 60, sl + 60, h + (hue - 0.5) * 140);
      s = Math.max(s, sc * (0.8 + 0.2 * (1 - fm)));
      s *= 1 - rock * 0.4;
      tmp.lerp(col.snow, clamp(s));
      tCol[i * 3] = tmp.r; tCol[i * 3 + 1] = tmp.g; tCol[i * 3 + 2] = tmp.b;
    }
    tGeo.attributes.color.needsUpdate = true;
    forest.updateSeason(t, col);
    village.updateSeason(t);
  }

  // ---------- 時刻・天気による空と光 ----------
  const sunDir = new THREE.Vector3(), moonDir = new THREE.Vector3();
  const fogColor = new THREE.Color();
  scene.fog = new THREE.FogExp2(0x9fb3c8, 0.00012);

  function dirFromAzEl(v, az, el) {
    return v.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  }

  function updateSky(sunPos, moonPos, wx, dt, time, camera) {
    dirFromAzEl(sunDir, sunPos.az, sunPos.el);
    dirFromAzEl(moonDir, moonPos.az, moonPos.el);
    const elS = sunPos.el;
    const sinEl = Math.sin(elS);
    const day = smooth(-0.1, 0.08, sinEl);           // 薄明を含む昼らしさ
    const sunUp = smooth(-0.01, 0.06, sinEl);
    const over = wx.cover;                             // 0..1 雲量

    // 空の色（昼は澄んだ青、朝夕は茜色、夜は群青）
    const dusk = smooth(0.28, 0.0, Math.abs(sinEl)) * smooth(-0.2, -0.02, sinEl);
    const su = skyMat.uniforms;
    su.uZenith.value.set('#2f7fe0').lerp(hex('#3d5f8a'), dusk * 0.6).lerp(hex('#8c96a3'), over * 0.85).multiplyScalar(0.03 + 0.97 * day);
    su.uHorizon.value.set('#cfe6fb').lerp(hex('#f2a66b'), dusk * 0.85).lerp(hex('#d2d6dc'), over * 0.85).multiplyScalar(0.03 + 0.97 * day);
    su.uZenith.value.lerp(hex('#050a1c'), 1 - smooth(-0.25, -0.05, sinEl));
    su.uHorizon.value.lerp(hex('#0d1630'), 1 - smooth(-0.25, -0.05, sinEl));
    su.uGround.value.copy(su.uHorizon.value).multiplyScalar(0.85);
    su.uSunDir.value.copy(sunDir);
    su.uSunCol.value.set('#fff6dc').multiplyScalar(sunUp * (1 - over * 0.9) * 1.5);
    su.uGlow.value.set('#ffd9a0').multiplyScalar(0.35 * (0.3 + dusk) * (1 - over * 0.8) * smooth(-0.15, 0.02, sinEl));
    sky.position.copy(camera.position);

    // 太陽光
    const warm = smooth(0.0, 0.35, sinEl);
    sun.color.setRGB(1, 0.45 + 0.53 * warm, 0.22 + 0.72 * warm);
    sun.intensity = 2.6 * sunUp * (1 - over * 0.7);
    sun.position.copy(sunDir).multiplyScalar(300);
    sun.target.position.set(0, 0, 0);
    sun.castShadow = sunUp > 0.01 && over < 0.85;

    // 月
    const moonUp = smooth(-0.02, 0.1, Math.sin(moonPos.el));
    const illum = 0.5 - 0.5 * Math.cos(moonPos.phase * Math.PI * 2);
    moonLight.position.copy(moonDir).multiplyScalar(300);
    moonLight.intensity = 0.5 * moonUp * illum * (1 - day) * (1 - over * 0.8);
    moon.position.copy(camera.position).addScaledVector(moonDir, 20000);
    moonMat.uniforms.uSun.value.copy(sunDir);
    moonMat.uniforms.uOpacity.value = moonUp * (1 - over * 0.85) * (1 - day * 0.6);
    moon.visible = moonUp > 0.001;

    // 星
    stars.position.copy(camera.position);
    stars.rotation.y = time * 0.002;
    starMat.uniforms.uOpacity.value = (1 - smooth(-0.2, -0.04, sinEl)) * (1 - over * 0.95);
    starMat.uniforms.uTime.value = time;

    // 雲
    const cu = cloudMat.uniforms;
    cu.uTime.value = time;
    cu.uCover.value = over;
    cu.uSunDir.value.copy(sunDir);
    cu.uSunCol.value.copy(sun.color).multiplyScalar(smooth(-0.08, 0.1, sinEl) * (1 - over * 0.5) * 1.1);
    cu.uAmb.value.setRGB(0.42, 0.48, 0.56).multiplyScalar(0.15 + 0.85 * day);
    cu.uDark.value = 1 - smooth(-0.16, 0.02, sinEl);
    cu.uCam.value.copy(camera.position);
    clouds.position.x = camera.position.x; clouds.position.z = camera.position.z;
    cumulus.update(time, wx, cu.uSunCol.value, cu.uAmb.value, day, camera);

    // 霧（遠くの山ほど空色にかすむ）
    fogColor.copy(su.uHorizon.value).lerp(su.uZenith.value, 0.15);
    scene.fog.color.copy(fogColor);
    scene.fog.density = 0.00005 + over * 0.00012 + wx.haze * 0.0012 + wx.precip * 0.0025;

    // 空からの光（半球光）
    hemi.color.copy(su.uZenith.value).lerp(hex('#ffffff'), 0.45).multiplyScalar(0.25 + 0.75 * day);
    hemi.groundColor.set('#7a8a4a').multiplyScalar(0.15 + 0.85 * day);
    hemi.intensity = 1.7 * (0.12 + 0.88 * day) + 0.35 * (1 - day);
    if (day < 0.3) hemi.color.lerp(hex('#3a4e8a'), 1 - day / 0.3);

    return { sunDir, day, sunUp, moonUp: moonUp * illum };
  }

  return { group, terrain, sky, sun, updateSeason, updateSky, sunDir, forest, village, railway };
}

// ---------- 森 ----------
function buildForest(quality) {
  const group = new THREE.Group();
  // 杉（三段の円錐）
  const cone = mergeGeos([
    new THREE.ConeGeometry(0.55, 0.55, 7).translate(0, 0.42, 0),
    new THREE.ConeGeometry(0.42, 0.45, 7).translate(0, 0.66, 0),
    new THREE.ConeGeometry(0.28, 0.4, 7).translate(0, 0.85, 0),
    new THREE.CylinderGeometry(0.05, 0.06, 0.25, 5).translate(0, 0.12, 0),
  ]);
  // 広葉樹（いくつかの房が集まった樹冠）
  const lumps = [];
  for (let k = 0; k < 5; k++) {
    const g = new THREE.IcosahedronGeometry(0.3 + N.rnd() * 0.12, 1);
    const a = k / 5 * Math.PI * 2;
    const rr = k === 0 ? 0 : 0.22;
    g.translate(Math.cos(a) * rr, k === 0 ? 0.85 : 0.6 + N.rnd() * 0.15, Math.sin(a) * rr);
    lumps.push(g);
  }
  const blob = mergeGeos(lumps);
  const bp = blob.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i);
    const k = 1 + N.n2(x * 7 + 1, z * 7 + y * 5) * 0.12;
    bp.setXYZ(i, x * k, y * k, z * k);
  }
  // 樹冠は外向きのなめらかな法線にする（葉の塊らしく）
  const bn = blob.attributes.normal;
  for (let i = 0; i < bp.count; i++) {
    const v = new THREE.Vector3(bp.getX(i), bp.getY(i) - 0.55, bp.getZ(i)).normalize();
    bn.setXYZ(i, v.x, v.y, v.z);
  }
  const broadGeo = mergeGeos([blob, new THREE.CylinderGeometry(0.03, 0.05, 0.45, 5).translate(0, 0.22, 0)]);

  const placeC = [], placeB = [];
  const target = quality.trees;
  let tries = 0;
  while ((placeC.length + placeB.length) < target && tries < target * 30) {
    tries++;
    // 盆地の縁から山腹へ（近いほど密）
    const ang = N.rnd() * Math.PI * 2;
    const r = 300 + Math.pow(N.rnd(), 1.3) * 1800;
    const x = Math.cos(ang) * r / 0.8, z = Math.sin(ang) * r;
    if (Math.abs(x) < 70 && Math.abs(z) < 60) continue; // 田んぼの近くは空ける
    if (Math.abs(z - RAIL_Z) < 22 && Math.abs(x) < 1600) continue; // 線路沿い
    const y = terrainHeight(x, z);
    if (y < 6) continue; // 平地には植えない（丘や山を森で覆う）
    if (y > 1250) continue;
    const slope = Math.abs(terrainHeight(x + 4, z) - y) + Math.abs(terrainHeight(x, z + 4) - y);
    if (slope > 6) continue;
    const coniferP = clamp(0.5 + N.fbm(x / 350 + 9, z / 350, 3) * 1.4 + (y - 300) / 900);
    const s = 7 + N.rnd() * 5;
    const item = { x, y, z, s, rot: N.rnd() * 6.28, hue: N.rnd(), h: y };
    (N.rnd() < coniferP ? placeC : placeB).push(item);
  }
  const mat = toon({});
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vTy;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTy = position.y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vTy;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(0.55, 1.12, smoothstep(0.25, 1.05, vTy));');
  };
  const mk = (geo, list) => {
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    const o = new THREE.Object3D();
    list.forEach((p, i) => {
      o.position.set(p.x, p.y - 0.5, p.z);
      o.rotation.set(0, p.rot, 0);
      o.scale.set(p.s * (0.8 + N.rnd() * 0.3), p.s * (0.9 + N.rnd() * 0.5), p.s * (0.8 + N.rnd() * 0.3));
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, new THREE.Color(0.05, 0.1, 0.04));
    });
    m.castShadow = false; m.receiveShadow = true;
    return m;
  };
  const conifers = mk(cone, placeC), broads = mk(broadGeo, placeB);
  group.add(conifers, broads);

  const c = new THREE.Color(), c2 = new THREE.Color();
  function updateSeason(t, col) {
    const f = foliage(t), sl = snowLine(t), sc = snowCover(t);
    placeC.forEach((p, i) => {
      c.copy(col.conifer).multiplyScalar(0.75 + p.hue * 0.6);
      const s = Math.max(smooth(sl - 50, sl + 50, p.h), sc * 0.6);
      c.lerp(col.snow, s * 0.55);
      conifers.setColorAt(i, c);
    });
    placeB.forEach((p, i) => {
      c.copy(col.bare).lerp(col.broadSummer, f.green).lerp(col.broadFresh, f.fresh * 0.9);
      if (f.autumn > 0) {
        c2.copy(p.hue < 0.35 ? col.red : p.hue < 0.7 ? col.orange : col.yellow);
        c.lerp(c2, clamp(f.autumn + (p.h - 300) / 900) * 0.95);
      }
      c.multiplyScalar(0.8 + p.hue * 0.4);
      const s = Math.max(smooth(sl - 50, sl + 50, p.h), sc * 0.8);
      c.lerp(col.snow, s * 0.7);
      broads.setColorAt(i, c);
    });
    conifers.instanceColor.needsUpdate = true;
    broads.instanceColor.needsUpdate = true;
  }
  return { group, updateSeason };
}

export function mergeGeos(geos) {
  // index を外して単純連結
  const parts = geos.map(g => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  parts.forEach(g => (n += g.attributes.position.count));
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  parts.forEach(g => {
    pos.set(g.attributes.position.array, o * 3);
    if (!g.attributes.normal) g.computeVertexNormals();
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

// ---------- 里（農家・桜・屋敷林・電柱） ----------
function buildVillage() {
  const group = new THREE.Group();
  const std = (c) => toon({ color: c });

  // 農家（土壁・瓦屋根・下屋）
  const house = new THREE.Group();
  const wall = std(0xd9d2c0, 0.9), wood = std(0x3b2a1e, 0.8), roofM = std(0x2c3036, 0.55, 0.15);
  const body = new THREE.Mesh(new THREE.BoxGeometry(14, 5.2, 9), wall);
  body.position.y = 2.6;
  const base = new THREE.Mesh(new THREE.BoxGeometry(14.2, 1.0, 9.2), wood);
  base.position.y = 0.5;
  const roof = new THREE.Mesh(hipRoof(16.4, 11.2, 4.2), roofM);
  roof.position.y = 5.2;
  const beams = new THREE.Group();
  for (let i = -3; i <= 3; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.4, 0.12), wood);
    b.position.set(i * 2.2, 2.9, 4.52);
    beams.add(b);
  }
  const win = new THREE.Mesh(new THREE.BoxGeometry(8, 1.6, 0.1), std(0x1a1d22, 0.2, 0.3));
  win.position.set(0, 2.6, 4.53);
  house.add(body, base, roof, beams, win);
  house.position.set(-62, BASIN_LEVEL, 8);
  house.rotation.y = Math.PI * 0.5;
  house.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // 作業小屋（トタン屋根）
  const shed = new THREE.Group();
  const sb = new THREE.Mesh(new THREE.BoxGeometry(7, 3.6, 5), std(0x5a4636, 0.9));
  sb.position.y = 1.8;
  const sr = new THREE.Mesh(gableRoof(7.8, 6, 1.4), std(0x7a2c1e, 0.5, 0.4));
  sr.position.y = 3.6;
  shed.add(sb, sr);
  shed.position.set(-58, BASIN_LEVEL, -14);
  shed.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(house, shed);

  // 屋敷林の杉
  const cedarGeo = mergeGeos([
    new THREE.ConeGeometry(2.2, 9, 8).translate(0, 9.5, 0),
    new THREE.ConeGeometry(2.8, 7, 8).translate(0, 6.5, 0),
    new THREE.CylinderGeometry(0.25, 0.35, 5, 6).translate(0, 2.5, 0),
  ]);
  const cedarMat = std(0x16241a, 0.95);
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(cedarGeo, cedarMat);
    const a = -0.6 + i * 0.12;
    m.position.set(-75 - Math.sin(i * 1.7) * 4 - 3, BASIN_LEVEL, -20 + i * 3.4);
    m.scale.setScalar(1.6 + 0.4 * Math.sin(i * 3.1) + a * 0);
    m.castShadow = true;
    group.add(m);
  }

  // 一本桜（畦の角）
  const tree = new THREE.Group();
  const bark = std(0x2e2420, 0.95);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.8, 4, 8), bark);
  trunk.position.y = 2;
  tree.add(trunk);
  const branchPts = [];
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + 0.3;
    const len = 4 + (i % 3);
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.3, len, 6), bark);
    br.position.set(Math.cos(a) * len * 0.35, 3.6 + len * 0.3, Math.sin(a) * len * 0.35);
    br.lookAt(new THREE.Vector3(Math.cos(a) * len, 3.6 + len * 0.9, Math.sin(a) * len));
    br.rotateX(Math.PI / 2);
    tree.add(br);
    branchPts.push([Math.cos(a) * len * 0.75, 3.6 + len * 0.6, Math.sin(a) * len * 0.75]);
  }
  const blossomGeo = new THREE.IcosahedronGeometry(0.42, 0);
  const blossomMat = toon({ color: 0xffd6e6 });
  const BL = 700;
  const blossoms = new THREE.InstancedMesh(blossomGeo, blossomMat, BL);
  const o = new THREE.Object3D();
  for (let i = 0; i < BL; i++) {
    // 傘形の樹冠（楕円体の上側の殻）
    const th = N.rnd() * Math.PI * 2, ph = Math.acos(N.rnd() * 0.95);
    const rr = 0.75 + 0.25 * N.rnd();
    o.position.set(Math.cos(th) * Math.sin(ph) * 6.2 * rr, 5.2 + Math.cos(ph) * 3.4 * rr, Math.sin(th) * Math.sin(ph) * 6.2 * rr);
    o.rotation.set(N.rnd() * 3, N.rnd() * 3, N.rnd() * 3);
    o.scale.setScalar(0.7 + N.rnd() * 0.9);
    o.updateMatrix();
    blossoms.setMatrixAt(i, o.matrix);
  }
  blossoms.castShadow = true;
  tree.add(blossoms);
  tree.position.set(40, BASIN_LEVEL, -33);
  tree.traverse(m => { if (m.isMesh) m.castShadow = true; });
  group.add(tree);

  // 電柱と電線（農道沿い）
  const poleMat = std(0x8d8a84, 0.8);
  const wireMat = new THREE.LineBasicMaterial({ color: 0x111111 });
  const poles = [];
  for (let i = 0; i < 6; i++) {
    const x = -70 + i * 35;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 10, 8), poleMat);
    p.position.set(x, BASIN_LEVEL + 5, 36);
    p.castShadow = true;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), poleMat);
    arm.position.set(x, BASIN_LEVEL + 9.3, 36);
    group.add(p, arm);
    poles.push(x);
  }
  for (let i = 0; i < poles.length - 1; i++) {
    for (const dx of [-0.7, 0.7]) {
      const pts = [];
      for (let k = 0; k <= 12; k++) {
        const s = k / 12;
        pts.push(new THREE.Vector3(poles[i] + dx + s * 35, BASIN_LEVEL + 9.4 - Math.sin(s * Math.PI) * 0.6, 36));
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
    }
  }

  // 農道（砂利）
  const road = new THREE.Mesh(new THREE.PlaneGeometry(260, 4.5).rotateX(-Math.PI / 2), std(0x8a8172, 1));
  road.position.set(0, BASIN_LEVEL + 0.03, 32);
  road.receiveShadow = true;
  group.add(road);

  const blossomCol = new THREE.Color();
  function updateSeason(t) {
    const s = sakura(t), f = foliage(t);
    blossomCol.set('#3f8a35').lerp(hex('#86c64e'), f.fresh);
    if (f.autumn > 0) blossomCol.lerp(hex('#d8682e'), f.autumn);
    blossomCol.lerp(hex('#f7b9c9'), s);
    blossomMat.color.copy(blossomCol);
    const leafy = Math.max(s, f.green);
    blossoms.visible = leafy > 0.05;
    blossoms.scale.setScalar(0.5 + 0.5 * leafy);
    const snow = snowCover(t);
    roofM.color.set('#3b4250').lerp(hex('#eef3f8'), snow);
    sr.material.color.set('#a8402c').lerp(hex('#eef3f8'), snow);
  }
  return { group, updateSeason };
}

function hipRoof(w, d, h) {
  const g = new THREE.BufferGeometry();
  const hw = w / 2, hd = d / 2, r = (w - d) / 2;
  const v = [
    -hw, 0, -hd, hw, 0, -hd, hw, 0, hd, -hw, 0, hd, // 0-3 軒
    -r, h, 0, r, h, 0, // 4,5 棟
  ];
  const idx = [0, 4, 1, 1, 4, 5, 2, 5, 3, 3, 5, 4, 1, 5, 2, 3, 4, 0];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  const ng = g.toNonIndexed();
  ng.computeVertexNormals();
  // 裏面を出す
  const p = ng.attributes.position.array;
  for (let i = 0; i < p.length; i += 9) {
    // 法線を上向きにそろえる（巻き順チェック）
    const ax = p[i + 3] - p[i], ay = p[i + 4] - p[i + 1], az = p[i + 5] - p[i + 2];
    const bx = p[i + 6] - p[i], by = p[i + 7] - p[i + 1], bz = p[i + 8] - p[i + 2];
    const ny = az * bx - ax * bz;
    if (ny < 0) { for (let k = 0; k < 3; k++) { const tmp = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = tmp; } }
    void ay; void by;
  }
  ng.computeVertexNormals();
  return ng;
}
function gableRoof(w, d, h) {
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2, 0); shape.lineTo(0, h); shape.lineTo(d / 2, 0); shape.lineTo(-d / 2, 0);
  const g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
  g.translate(0, 0, -w / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

// ---------- 鉄道 ----------
function buildRailway() {
  const group = new THREE.Group();
  const LEN = 3000, Y = BASIN_LEVEL + 1.2;
  // 盛り土と砂利、レール
  const bed = new THREE.Mesh(new THREE.BoxGeometry(LEN, 1.4, 5), toon({ color: '#9b927f' }));
  bed.position.set(0, Y - 0.7, RAIL_Z);
  const ballast = new THREE.Mesh(new THREE.BoxGeometry(LEN, 0.25, 3.2), toon({ color: '#7d766a' }));
  ballast.position.set(0, Y + 0.1, RAIL_Z);
  group.add(bed, ballast);
  const railMat = toon({ color: '#4a4440' });
  for (const dz of [-0.55, 0.55]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(LEN, 0.16, 0.08), railMat);
    rail.position.set(0, Y + 0.3, RAIL_Z + dz);
    group.add(rail);
  }
  // 踏切（農道と交わる所）の警報機
  const xing = new THREE.Group();
  for (const dz of [-4, 4]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 6), toon({ color: '#eeeeee' }));
    pole.position.set(-6, Y + 1.5, RAIL_Z + dz);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 1.4), toon({ color: '#f2d33a' }));
    sign.position.set(-6, Y + 2.7, RAIL_Z + dz);
    xing.add(pole, sign);
  }
  group.add(xing);

  // 2両編成の気動車（ステンレス車体に青緑の窓帯、黄色いドア）
  const train = new THREE.Group();
  const steel = toon({ color: '#c9ced3' }), winBand = toon({ color: '#3b4048' }), teal = toon({ color: '#27b3b8' });
  const yellow = toon({ color: '#f2c81e' }), blue = toon({ color: '#2f5fb3' }), roofM = toon({ color: '#8d9298' });
  const under = toon({ color: '#2e2f33' });
  const winMat = new THREE.MeshBasicMaterial({ color: '#1f2a33' });
  const lightMat = new THREE.MeshBasicMaterial({ color: '#fff4c0' });
  const CAR = 20, GAP = 0.8;
  const box = (w, h, d, m, x, y, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };
  for (let c = 0; c < 2; c++) {
    const car = new THREE.Group();
    car.add(box(CAR, 2.7, 2.9, steel, 0, 2.35));                 // 車体
    car.add(box(CAR + 0.02, 0.95, 2.94, winBand, 0, 2.55));         // 窓まわりの黒
    car.add(box(CAR + 0.03, 0.42, 2.95, teal, 0, 1.6));          // 腰の青緑帯
    car.add(box(CAR - 1.6, 0.7, 2.96, winMat, 0, 2.6));          // 窓
    car.add(box(CAR, 0.5, 2.6, roofM, 0, 3.85));                 // 屋根
    car.add(box(1.2, 0.5, 1.4, roofM, CAR * 0.25, 4.25));         // 屋根上の機器
    // 黄色い両開きドア（片側3か所）
    for (const dx of [-0.36, 0, 0.36]) {
      car.add(box(1.4, 2.0, 2.97, yellow, dx * CAR, 2.05));
      car.add(box(0.5, 0.7, 2.98, winMat, dx * CAR - 0.33, 2.6));
      car.add(box(0.5, 0.7, 2.98, winMat, dx * CAR + 0.33, 2.6));
    }
    // 運転台側の青い前面と黄色い前面
    const end = c === 0 ? -1 : 1;
    car.add(box(0.12, 2.7, 2.9, yellow, end * (CAR / 2 + 0.04), 2.35));
    car.add(box(0.14, 0.9, 1.9, winMat, end * (CAR / 2 + 0.06), 2.75));
    car.add(box(0.13, 2.7, 0.35, blue, end * (CAR / 2 + 0.05), 2.35, 1.3));
    car.add(box(0.13, 2.7, 0.35, blue, end * (CAR / 2 + 0.05), 2.35, -1.3));
    car.add(box(CAR - 2, 0.8, 2.2, under, 0, 0.75));             // 床下機器・台車
    for (const dz of [-0.8, 0.8]) car.add(box(0.06, 0.22, 0.32, lightMat, end * (CAR / 2 + 0.12), 1.55, dz));
    car.position.x = (c - 0.5) * (CAR + GAP);
    car.traverse(o => { if (o.isMesh) o.castShadow = false; });
    train.add(car);
  }
  train.position.set(-9999, Y + 0.38, RAIL_Z);
  train.visible = false;
  group.add(train);

  // 運行：数十秒おきに東西どちらかから走ってくる（早朝〜夜）
  let x = 0, dir = 1, wait = 6, running = false;
  const SPEED = 24; // m/s（約85km/h）
  const night = new THREE.Color('#ffe9a8'), dark = new THREE.Color('#26323a');
  function update(dt, hour, day) {
    winMat.color.copy(dark).lerp(night, 1 - day);
    lightMat.color.set('#fff4c0').multiplyScalar(1 + (1 - day) * 0.5);
    if (!running) {
      wait -= dt;
      if (wait <= 0 && hour > 5.3 && hour < 23.2) {
        running = true; dir = Math.random() < 0.5 ? 1 : -1; x = -dir * LEN / 2;
        train.visible = true;
      }
      return;
    }
    x += dir * SPEED * dt;
    train.position.x = x;
    if (Math.abs(x) > LEN / 2 + 30) { running = false; train.visible = false; wait = 25 + Math.random() * 50; }
  }
  return { group, update, get running() { return running; }, place(px) { running = true; dir = 1; x = px; train.position.x = px; train.visible = true; } };
}

// ---------- 入道雲（ビルボード） ----------
function cumulusTexture(seed) {
  const R = makeNoise(seed).rnd;
  const W = 512, H = 320;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  // もくもくの房：下は平らに、上へ積み上がる
  const puffs = [];
  const base = H * 0.8;
  for (let i = 0; i < 9; i++) puffs.push([W * (0.12 + 0.76 * i / 8) + (R() - 0.5) * 20, base - 20 - R() * 25, 40 + R() * 30]);
  for (let i = 0; i < 7; i++) puffs.push([W * (0.22 + 0.56 * R()), base - 70 - R() * 60, 45 + R() * 35]);
  for (let i = 0; i < 4; i++) puffs.push([W * (0.32 + 0.36 * R()), base - 140 - R() * 50, 40 + R() * 30]);
  // 影の層（右下にずらして青灰色）
  for (const [x, y, r] of puffs) {
    const gr = g.createRadialGradient(x + r * 0.15, y + r * 0.2, r * 0.2, x + r * 0.15, y + r * 0.2, r);
    gr.addColorStop(0, 'rgba(178,192,214,1)'); gr.addColorStop(0.85, 'rgba(178,192,214,1)'); gr.addColorStop(1, 'rgba(178,192,214,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x + r * 0.15, y + r * 0.2, r, 0, Math.PI * 2); g.fill();
  }
  // 日なたの層（左上が白く光る）
  for (const [x, y, r] of puffs) {
    const gr = g.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x - r * 0.1, y - r * 0.1, r * 0.92);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.7, 'rgba(250,252,255,0.95)'); gr.addColorStop(1, 'rgba(240,245,252,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x - r * 0.1, y - r * 0.1, r * 0.92, 0, Math.PI * 2); g.fill();
  }
  // 平らな雲底
  g.globalCompositeOperation = 'destination-out';
  const fade = g.createLinearGradient(0, base - 6, 0, base + 18);
  fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = fade; g.fillRect(0, base - 6, W, H);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function buildCumulus() {
  const group = new THREE.Group();
  const texs = [11, 23, 37, 51, 67].map(cumulusTexture);
  const R = makeNoise(909).rnd;
  const items = [];
  const COUNT = 26;
  for (let i = 0; i < COUNT; i++) {
    const mat = new THREE.SpriteMaterial({ map: texs[i % texs.length], fog: false, depthWrite: false, transparent: true });
    const sp = new THREE.Sprite(mat);
    // 北側（名峰の向こう）に多め、ほかの方角にも散らす
    const north = i < 14;
    const az = north ? (R() - 0.5) * 1.6 : R() * Math.PI * 2;
    const dist = 13000 + R() * 12000;
    const w = 4500 + R() * 6000;
    sp.scale.set(w, w * 0.625, 1);
    sp.renderOrder = -1;
    group.add(sp);
    items.push({ sp, az, dist, alt: 600 + R() * 900 + w * 0.2, rank: R(), w });
  }
  const col = new THREE.Color();
  function update(time, wx, sunCol, amb, day, camera) {
    // 晴れの日は少なめ、くもりの日は多く灰色がかる、雨や雪の日は出さない
    const amount = wx.kind === 'rain' || wx.kind === 'snow' ? 0 : wx.cover < 0.3 ? 0.55 : 0.95;
    col.setRGB(1, 1, 1).multiply(new THREE.Color().copy(sunCol).multiplyScalar(0.55).add(amb).addScalar(0.15));
    col.lerp(new THREE.Color(0.62, 0.65, 0.7), wx.cover * 0.6);
    col.multiplyScalar(0.05 + 0.95 * day);
    for (const it of items) {
      const a = it.az + time * 0.0006;
      it.sp.position.set(camera.position.x + Math.sin(a) * it.dist, it.alt, camera.position.z - Math.cos(a) * it.dist);
      it.sp.material.color.copy(col);
      it.sp.material.opacity = THREE.MathUtils.clamp((amount - it.rank) * 6, 0, 1) * (0.4 + 0.6 * day);
      it.sp.visible = it.sp.material.opacity > 0.01;
    }
  }
  return { group, update };
}

// ---------- 集落（北の丘のふもと） ----------
function buildHamlet() {
  const group = new THREE.Group();
  const R = makeNoise(5150).rnd;
  const wallCols = ['#f1efe8', '#e6e1d4', '#d9d6cf', '#efe9dc'], roofCols = ['#4a5260', '#6b3a2e', '#3f5a6e', '#585858'];
  const body = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  for (let i = 0; i < 22; i++) {
    const x = -700 + R() * 1500, z = -330 - R() * 120;
    const y = terrainHeight(x, z);
    if (y > 25) continue;
    const w = 9 + R() * 6, d = 7 + R() * 3, h = 4 + R() * 3;
    const house = new THREE.Group();
    const b = new THREE.Mesh(body, toon({ color: wallCols[i % 4] }));
    b.scale.set(w, h, d);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) * 0.56, 3 + R() * 1.5, 4, 1).rotateY(Math.PI / 4), toon({ color: roofCols[(i * 7) % 4] }));
    roof.scale.set(w / Math.hypot(w, d) * 1.42, 1, d / Math.hypot(w, d) * 1.42);
    roof.position.y = h + 1.4;
    house.add(b, roof);
    house.position.set(x, y - 0.2, z);
    house.rotation.y = (R() - 0.5) * 0.4;
    group.add(house);
  }
  return group;
}
