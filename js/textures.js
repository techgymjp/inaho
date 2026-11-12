// 手描き風の質感テクスチャ（キャンバスで生成）
import * as THREE from 'three';
import { makeNoise } from './noise.js';

function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, { srgb = true, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
const gray = (v, a = 1) => `rgba(${v},${v},${v},${a})`;

// 草地（明暗だけ。色はマテリアル側）：短い草の筆致を敷き詰める
export function grassTexture() {
  const R = makeNoise(4401).rnd, S = 512;
  const [c, g] = canvas(S);
  g.fillStyle = gray(200); g.fillRect(0, 0, S, S);
  // 大きなムラ
  for (let i = 0; i < 60; i++) {
    const x = R() * S, y = R() * S, r = 30 + R() * 70;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const v = R() < 0.5 ? 170 : 225;
    gr.addColorStop(0, gray(v, 0.35)); gr.addColorStop(1, gray(v, 0));
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) { g.fillStyle = gr; g.save(); g.translate(ox, oy); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore(); }
  }
  // 草の葉
  g.lineCap = 'round';
  for (let i = 0; i < 9000; i++) {
    const x = R() * S, y = R() * S, len = 4 + R() * 9, a = -Math.PI / 2 + (R() - 0.5) * 1.2;
    const v = R() < 0.55 ? 140 + R() * 40 : 225 + R() * 30;
    g.strokeStyle = gray(Math.round(v), 0.75); g.lineWidth = 1 + R() * 1.4;
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len); g.stroke();
    }
  }
  return tex(c, { srgb: false });
}

// 茅葺き：斜面に沿った（v方向の）わらの筋
export function thatchTexture() {
  const R = makeNoise(7301).rnd, W = 256, H = 256;
  const [c, g] = canvas(W, H);
  g.fillStyle = '#8c7a5c'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) {
    const x = R() * W, y = R() * H, len = 10 + R() * 30;
    const v = R();
    g.strokeStyle = v < 0.4 ? 'rgba(92,78,58,0.6)' : v < 0.8 ? 'rgba(170,150,112,0.55)' : 'rgba(205,188,150,0.5)';
    g.lineWidth = 0.8 + R() * 1.3;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 2, y + len); g.stroke();
    g.beginPath(); g.moveTo(x, y - H); g.lineTo(x + (R() - 0.5) * 2, y - H + len); g.stroke();
  }
  // 段（刈り込みの層）
  for (let y = 0; y < H; y += 64) { g.fillStyle = 'rgba(60,50,38,0.18)'; g.fillRect(0, y, W, 3); }
  return tex(c);
}

// 縦板張り（風雨にさらされた杉板）
export function boardTexture(base = '#5b4636') {
  const R = makeNoise(1203).rnd, W = 256, H = 256;
  const [c, g] = canvas(W, H);
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  const bw = 21;
  for (let x = 0; x < W; x += bw) {
    const v = (R() - 0.5) * 30;
    g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 240 : 0},${v > 0 ? 220 : 0},${Math.abs(v) / 160})`;
    g.fillRect(x, 0, bw, H);
    for (let k = 0; k < 14; k++) { // 木目
      g.strokeStyle = 'rgba(30,20,12,0.18)'; g.lineWidth = 0.7;
      const xx = x + 2 + R() * (bw - 4);
      g.beginPath(); g.moveTo(xx, 0); g.bezierCurveTo(xx + 2, H * 0.3, xx - 2, H * 0.6, xx + 1, H); g.stroke();
    }
    g.fillStyle = 'rgba(20,14,8,0.65)'; g.fillRect(x, 0, 1.6, H); // 目地
  }
  return tex(c);
}

// トタン（波板＋さび）
export function tinTexture() {
  const R = makeNoise(661).rnd, S = 256;
  const [c, g] = canvas(S);
  g.fillStyle = '#9b3d2a'; g.fillRect(0, 0, S, S);
  for (let x = 0; x < S; x += 8) {
    const gr = g.createLinearGradient(x, 0, x + 8, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0.22)'); gr.addColorStop(0.5, 'rgba(255,220,200,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0.22)');
    g.fillStyle = gr; g.fillRect(x, 0, 8, S);
  }
  for (let i = 0; i < 120; i++) { // さび
    const x = R() * S, y = R() * S, r = 3 + R() * 14;
    g.fillStyle = `rgba(${90 + R() * 40},${45 + R() * 20},20,${0.25 + R() * 0.35})`;
    g.beginPath(); g.ellipse(x, y, r * 0.6, r, 0, 0, Math.PI * 2); g.fill();
  }
  return tex(c);
}

// 障子
export function shojiTexture() {
  const [c, g] = canvas(128, 256);
  g.fillStyle = '#f3efe2'; g.fillRect(0, 0, 128, 256);
  g.strokeStyle = '#6b513a'; g.lineWidth = 3;
  for (let x = 0; x <= 128; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  for (let y = 0; y <= 256; y += 28) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
  g.lineWidth = 8; g.strokeRect(0, 0, 128, 256);
  g.fillStyle = '#7a5d42'; g.fillRect(0, 200, 128, 56); // 腰板
  return tex(c, { repeat: false });
}

// しっくい壁（うっすら汚れ）
export function plasterTexture() {
  const R = makeNoise(88).rnd, S = 256;
  const [c, g] = canvas(S);
  g.fillStyle = '#ece6d6'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) {
    const x = R() * S, y = R() * S, r = 10 + R() * 40;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(150,140,120,0.12)'); gr.addColorStop(1, 'rgba(150,140,120,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const gr = g.createLinearGradient(0, S * 0.7, 0, S); // 足元の雨だれ汚れ
  gr.addColorStop(0, 'rgba(120,105,85,0)'); gr.addColorStop(1, 'rgba(120,105,85,0.25)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return tex(c);
}

// 瓦（土蔵の屋根）
export function tileTexture() {
  const [c, g] = canvas(256);
  g.fillStyle = '#4b5058'; g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    const gr = g.createLinearGradient(x, 0, x + 16, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0.35)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.15)'); gr.addColorStop(1, 'rgba(0,0,0,0.35)');
    g.fillStyle = gr; g.fillRect(x, 0, 16, 256);
  }
  for (let y = 0; y < 256; y += 24) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, y, 256, 2); }
  return tex(c);
}
