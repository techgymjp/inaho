// 実際の星空：明るい恒星（赤経・赤緯・等級・色）と天の川
// 赤経は時、赤緯は度（J2000、概略値）。色: b=青白 w=白 y=黄 o=橙 r=赤
import * as THREE from 'three';
import { makeNoise, GLSL_NOISE } from './noise.js';

const CAT = `
Sirius 6.752 -16.716 -1.46 w|Arcturus 14.261 19.182 -0.05 o|Vega 18.616 38.784 0.03 w|Capella 5.278 45.998 0.08 y|Rigel 5.242 -8.202 0.13 b|
Procyon 7.655 5.225 0.34 w|Betelgeuse 5.919 7.407 0.5 r|Altair 19.846 8.868 0.77 w|Aldebaran 4.599 16.509 0.85 o|Antares 16.490 -26.432 1.0 r|
Spica 13.420 -11.161 0.97 b|Pollux 7.755 28.026 1.14 o|Fomalhaut 22.961 -29.622 1.16 w|Deneb 20.690 45.280 1.25 w|Regulus 10.140 11.967 1.35 b|
Adhara 6.977 -28.972 1.5 b|Castor 7.577 31.888 1.58 w|Shaula 17.560 -37.104 1.62 b|Bellatrix 5.419 6.350 1.64 b|Elnath 5.438 28.608 1.65 b|
Alnilam 5.604 -1.202 1.69 b|Alnitak 5.679 -1.943 1.74 b|Mintaka 5.533 -0.299 2.23 b|Saiph 5.796 -9.670 2.07 b|Alioth 12.900 55.960 1.77 w|
Dubhe 11.062 61.751 1.79 o|Mirfak 3.405 49.861 1.79 y|Wezen 7.140 -26.393 1.83 y|Alkaid 13.792 49.313 1.86 b|Menkalinan 5.992 44.948 1.9 w|
Alhena 6.629 16.399 1.9 w|Polaris 2.530 89.264 1.98 y|Mirzam 6.378 -17.956 1.98 b|Alphard 9.460 -8.659 1.98 o|Hamal 2.120 23.462 2.0 o|
Diphda 0.727 -17.987 2.04 y|Nunki 18.921 -26.297 2.05 b|Mizar 13.399 54.925 2.23 w|Alpheratz 0.140 29.091 2.06 b|Mirach 1.163 35.621 2.05 r|
Kochab 14.845 74.156 2.08 o|Rasalhague 17.582 12.560 2.08 w|Algol 3.136 40.956 2.1 b|Almach 2.065 42.330 2.1 o|Denebola 11.818 14.572 2.13 w|
Schedar 0.675 56.537 2.24 o|Caph 0.153 59.150 2.28 w|Navi 0.945 60.717 2.15 b|Ruchbah 1.430 60.235 2.68 w|Segin 1.907 63.670 3.35 b|
Merak 11.031 56.382 2.37 w|Phecda 11.897 53.695 2.44 w|Megrez 12.257 57.033 3.31 w|Eltanin 17.943 51.489 2.23 o|Sadr 20.370 40.257 2.23 y|
Gienah 20.770 33.970 2.48 o|Albireo 19.512 27.960 3.08 o|Fawaris 19.750 45.131 2.87 b|Enif 21.736 9.875 2.38 o|Scheat 23.063 28.083 2.42 r|
Markab 23.079 15.205 2.49 b|Algenib 0.221 15.184 2.83 b|Alphecca 15.578 26.715 2.22 w|Zubeneschamali 15.283 -9.383 2.61 b|Zubenelgenubi 14.848 -16.042 2.75 w|
Dschubba 16.006 -22.622 2.29 b|Acrab 16.091 -19.806 2.62 b|Sargas 17.622 -42.998 1.87 y|KausAustralis 18.403 -34.385 1.85 b|KausMedia 18.350 -29.828 2.7 o|
KausBorealis 18.466 -25.421 2.81 o|Ascella 19.044 -29.880 2.6 w|Paikauhale 16.598 -28.216 2.82 b|Larawag 16.836 -34.293 2.29 o|Lesath 17.512 -37.296 2.7 b|
Alcyone 3.791 24.105 2.87 b|Atlas 3.819 24.053 3.6 b|Electra 3.749 24.113 3.7 b|Maia 3.763 24.368 3.87 b|Merope 3.772 23.948 4.18 b|Taygeta 3.753 24.467 4.3 b|
Ain 4.477 19.180 3.53 o|Chamukuy 4.478 15.871 3.4 w|Prima 4.330 15.628 3.65 o|Secunda 4.382 17.543 3.76 o|
Algieba 10.333 19.842 2.08 o|Zosma 11.235 20.524 2.56 w|Chertan 11.237 15.430 3.33 w|RasElased 9.764 23.774 2.98 o|EtaLeo 10.122 16.763 3.5 w|Adhafera 10.278 23.417 3.43 w|
CorCaroli 12.934 38.318 2.89 w|Vindemiatrix 13.036 10.959 2.83 y|Porrima 12.694 -1.449 2.74 w|Izar 14.750 27.074 2.37 o|Muphrid 13.911 18.398 2.68 y|
Seginus 14.535 38.308 3.03 w|Nekkar 15.032 40.391 3.49 y|Kornephoros 16.504 21.490 2.78 y|ZetaHer 16.688 31.603 2.81 y|Sheliak 18.835 33.363 3.52 b|
Sulafat 18.982 32.690 3.25 b|Tarazed 19.771 10.613 2.72 o|Alshain 19.922 6.407 3.71 y|Menkar 3.038 4.090 2.54 r|Arneb 5.546 -17.822 2.58 w|
Nihal 5.471 -20.759 2.84 y|Aludra 7.402 -29.303 2.45 b|Gomeisa 7.453 8.289 2.89 b|Tejat 6.383 22.514 2.87 r|Mebsuta 6.732 25.131 3.06 y|
Hassaleh 4.950 33.166 2.69 o|Sheratan 1.911 20.808 2.64 w|Thuban 14.073 64.376 3.65 w|Pherkad 15.345 71.834 3.0 w|Unukalhai 15.738 6.426 2.63 o|
Sabik 17.173 -15.725 2.43 w|Cebalrai 17.725 4.567 2.77 o|DenebAlgedi 21.784 -16.127 2.85 w|Sadalsuud 21.526 -5.571 2.9 y|Sadalmelik 22.096 -0.320 2.95 y|
Alderamin 21.310 62.586 2.45 w|Errai 23.656 77.632 3.21 o|Hatysa 5.590 -5.910 2.77 b|Meissa 5.585 9.934 3.39 b|Wasat 7.335 21.982 3.53 w|
Propus 6.248 22.507 3.31 o|Alzirr 6.755 12.896 3.36 w|Furud 6.338 -30.064 3.02 b|Muliphein 7.062 -15.633 4.1 b|Haedus 5.033 41.234 3.7 w|
Almaaz 5.032 43.823 3.0 w|Mahasim 5.995 37.213 2.62 w|Atik 3.902 31.884 2.85 b|Menkib 3.983 35.791 4.0 b|EpsPer 3.964 40.010 2.89 b|
DeltaPer 3.715 47.788 3.0 b|Rotanev 20.626 14.595 3.63 y|Sualocin 20.661 15.912 3.77 b|Albaldah 19.163 -21.024 2.88 y|Nash 18.096 -30.424 2.98 o|
Tau2Sgr 19.116 -27.671 3.3 o|Alniyat 16.353 -25.593 2.89 b|Fang 15.981 -26.114 2.89 b|Iklil 16.200 -19.461 3.96 b|Xamidimura 16.864 -38.047 3.0 b|
Girtab 17.708 -39.030 2.4 y|Alkes 10.996 -18.299 4.08 o|
Gienah2 12.263 -17.542 2.59 b|Kraz 12.573 -23.397 2.65 y|Algorab 12.498 -16.515 2.95 w|Minkar 12.169 -22.620 3.0 o|Alchiba 12.140 -24.729 4.0 w`;

const COL = { b: [0.75, 0.85, 1.0], w: [1.0, 1.0, 1.0], y: [1.0, 0.95, 0.82], o: [1.0, 0.82, 0.6], r: [1.0, 0.65, 0.5] };

// 赤道座標 → 銀河座標（J2000）の回転
const EQ2GAL = [-0.0548755604, -0.8734370902, -0.4838350155, 0.4941094279, -0.4448296300, 0.7469822445, -0.8676661490, -0.1980763734, 0.4559837762];

export function createStarSky(scene, latDeg) {
  const R = makeNoise(31415).rnd;
  const ra = [], dec = [], mag = [], col = [];
  for (const line of CAT.split('|')) {
    const p = line.trim().split(/\s+/);
    if (p.length < 5) continue;
    ra.push(parseFloat(p[1]) * Math.PI / 12); dec.push(parseFloat(p[2]) * Math.PI / 180); mag.push(parseFloat(p[3])); col.push(...COL[p[4]]);
  }
  // かすかな星：天の川の近くほど多い
  let added = 0;
  while (added < 3200) {
    const a = R() * Math.PI * 2, d = Math.asin(R() * 2 - 1);
    const ex = Math.cos(d) * Math.cos(a), ey = Math.cos(d) * Math.sin(a), ez = Math.sin(d);
    const gz = EQ2GAL[6] * ex + EQ2GAL[7] * ey + EQ2GAL[8] * ez;   // 銀緯の sin
    if (R() > 0.35 + 0.65 * Math.exp(-Math.pow(Math.asin(gz) / 0.3, 2))) continue;
    ra.push(a); dec.push(d);
    mag.push(3.6 + Math.pow(R(), 0.55) * 2.6);
    const c = COL['bwwwyyo'[Math.floor(R() * 7)]]; col.push(...c);
    added++;
  }
  const n = ra.length;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); // 位置はシェーダーで計算
  geo.setAttribute('ra', new THREE.BufferAttribute(new Float32Array(ra), 1));
  geo.setAttribute('dec', new THREE.BufferAttribute(new Float32Array(dec), 1));
  geo.setAttribute('mag', new THREE.BufferAttribute(new Float32Array(mag), 1));
  geo.setAttribute('scol', new THREE.BufferAttribute(new Float32Array(col), 3));
  const lat = latDeg * Math.PI / 180;
  // 赤経・赤緯と地方恒星時から、地平座標（東・上・北）の向きを求める共通の式
  const ALTAZ = `
    uniform float uLST; const float LAT = ${lat.toFixed(6)};
    vec3 eqToWorld(float ra, float dec) {
      float H = uLST - ra;
      float e = -cos(dec) * sin(H);
      float nn = sin(dec) * cos(LAT) - cos(dec) * cos(H) * sin(LAT);
      float u = sin(dec) * sin(LAT) + cos(dec) * cos(H) * cos(LAT);
      return vec3(e, u, -nn); // x=東, y=上, z=南（-北）
    }`;
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uLST: { value: 0 }, uOpacity: { value: 0 }, uTime: { value: 0 }, uLimit: { value: 6 }, uPx: { value: 1 } },
    vertexShader: `attribute float ra, dec, mag; attribute vec3 scol; varying vec3 vCol; varying float vA;
      uniform float uOpacity, uTime, uLimit, uPx;` + ALTAZ + `
      void main(){
        vec3 d = eqToWorld(ra, dec);
        float alt = d.y;
        // 等級→明るさ。地平線近くは大気で暗く、よくまたたく
        float ext = smoothstep(-0.01, 0.2, alt);
        float b = max(pow(2.512, -(mag - 1.0) * 0.6), 0.22) * ext;
        float vis = smoothstep(uLimit + 0.3, uLimit - 0.6, mag + (1.0 - ext) * 1.5);
        float tw = 1.0 + (0.12 + 0.35 * (1.0 - smoothstep(0.0, 0.5, alt))) * sin(uTime * (6.0 + fract(ra * 13.7) * 9.0) + dec * 40.0);
        vA = clamp(b, 0.0, 3.0) * vis * tw * uOpacity * step(0.0, alt);
        vCol = scol;
        vec4 mv = modelViewMatrix * vec4(d * 30000.0, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(2.0 + (4.2 - mag) * 0.95, 1.7, 8.0) * uPx;
      }`,
    fragmentShader: `varying vec3 vCol; varying float vA;
      void main(){ float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, r); a *= a;
        gl_FragColor = vec4(vCol * a * min(vA * 1.4, 3.0), 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const stars = new THREE.Points(geo, starMat);
  stars.frustumCulled = false;
  stars.renderOrder = -1;
  scene.add(stars);

  // ---- 天の川（銀河面に沿った淡い光の帯。いて座の方向が最も明るい） ----
  const milkyMat = new THREE.ShaderMaterial({
    uniforms: { uLST: { value: 0 }, uOpacity: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: GLSL_NOISE + `uniform float uLST, uOpacity; varying vec3 vDir; const float LAT = ${lat.toFixed(6)};
      void main(){
        vec3 d = normalize(vDir);
        if (d.y < -0.02) discard;
        float e = d.x, u = d.y, nn = -d.z;
        float sd = nn * cos(LAT) + u * sin(LAT), dec = asin(clamp(sd, -1.0, 1.0));
        float H = atan(-e, u * cos(LAT) - nn * sin(LAT));
        float ra = uLST - H;
        vec3 eq = vec3(cos(dec) * cos(ra), cos(dec) * sin(ra), sin(dec));
        vec3 g = vec3(dot(vec3(${EQ2GAL.slice(0, 3).join(',')}), eq), dot(vec3(${EQ2GAL.slice(3, 6).join(',')}), eq), dot(vec3(${EQ2GAL.slice(6, 9).join(',')}), eq));
        float b = asin(clamp(g.z, -1.0, 1.0)), l = atan(g.y, g.x);
        float band = exp(-pow(b / 0.17, 2.0));
        float core = 0.45 + 0.55 * pow(0.5 + 0.5 * cos(l), 2.0);           // 銀河中心（いて座）ほど明るい
        vec2 p = vec2(l * 5.0, b * 14.0);
        float mott = 0.55 + 0.6 * fbm2(p * 1.7 + 3.0);
        float rift = 1.0 - 0.75 * smoothstep(0.55, 0.75, fbm2(p * 0.9 + 11.0)) * exp(-pow((b - 0.03) / 0.05, 2.0)); // 暗黒帯
        float ext = smoothstep(0.0, 0.35, u);
        float I = band * core * mott * rift * ext * uOpacity * 0.22;
        gl_FragColor = vec4(vec3(0.78, 0.84, 1.0) * I, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, fog: false,
  });
  const milky = new THREE.Mesh(new THREE.SphereGeometry(29000, 64, 32), milkyMat);
  milky.frustumCulled = false;
  milky.renderOrder = -1;
  scene.add(milky);

  // 地方恒星時（ラジアン）：西暦年・通日・日本時間・経度から
  function lst(year, doyFrac, lonDeg) {
    const jd2000 = Date.UTC(2000, 0, 1, 12) / 86400000;
    const d = Date.UTC(year, 0, 1) / 86400000 + doyFrac - 9 / 24 - jd2000; // JST → UT
    const gmst = 18.697374558 + 24.06570982441908 * d;
    return ((((gmst + lonDeg / 15) % 24) + 24) % 24) * Math.PI / 12;
  }
  function update({ year, t, lonDeg, time, camera, dark, cover, moon, px }) {
    const L = lst(year, t, lonDeg);
    starMat.uniforms.uLST.value = L; milkyMat.uniforms.uLST.value = L;
    stars.position.copy(camera.position); milky.position.copy(camera.position);
    const clear = 1 - cover * 0.95;
    starMat.uniforms.uOpacity.value = dark * clear;
    starMat.uniforms.uTime.value = time;
    // 見える限界等級：薄明や月明かりで暗い星から見えなくなる
    starMat.uniforms.uLimit.value = 2.0 + 4.0 * dark * (1 - 0.45 * moon);
    starMat.uniforms.uPx.value = px;
    milkyMat.uniforms.uOpacity.value = Math.pow(dark, 3) * clear * (1 - 0.85 * moon);
  }
  return { update };
}
