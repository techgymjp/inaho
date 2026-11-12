// 振動（スマートフォンのバイブ）。対応していない端末では何もしない
const PATTERN = {
  till: [35],               // ズシャッ：重く長め
  level: [14],              // チャプッ：軽く
  plant: [18],              // プスッ
  weed: [22, 30, 14],       // ブチッ：引っぱって抜ける
  bug: [24],                // パシッ
  bird: [15, 40, 15],       // 羽ばたいて逃げる
  levee: [40],              // ペタッ：土をたたく
  melt: [8],                // サラサラ：ごく軽く
  snow: [20],               // 雪をかく
  thud: [45],               // ドサッ
  crash: [90, 60, 140],     // ハウスがつぶれる
  harvest: [14],            // 稲を刈る
  start: [60, 80, 60],      // 農作業イベントの開始
};
const last = {};
export function buzz(kind) {
  if (!navigator.vibrate) return;
  const now = performance.now();
  const gap = kind === 'melt' ? 60 : 110;
  if (now - (last[kind] || 0) < gap) return;
  last[kind] = now;
  try { navigator.vibrate(PATTERN[kind] || [15]); } catch (e) { /* 使えない環境 */ }
}
