// 暦・農作業カレンダー・太陽位置・天気
// 1年 = 365日（うるう年なし）。doy は 0..364、1/1 = 0。

export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_START = MONTH_DAYS.reduce((a, d, i) => (a.push(i ? a[i - 1] + MONTH_DAYS[i - 1] : 0), a), []);

export function doyOf(month, day) { return MONTH_START[month - 1] + day - 1; }
export function monthDay(doy) {
  let m = 0;
  while (m < 11 && doy >= MONTH_START[m + 1]) m++;
  return { month: m + 1, day: doy - MONTH_START[m] + 1 };
}
const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
export function dateLabel(doy, year) {
  const { month, day } = monthDay(doy);
  const w = new Date(year, month - 1, day).getDay();
  return `${month}月${day}日（${WEEK[w]}）`;
}

const D = doyOf;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
export { clamp, smooth };

// 二十四節気（おおよその日付）
const SEKKI = [
  [1, 5, '小寒'], [1, 20, '大寒'], [2, 4, '立春'], [2, 19, '雨水'], [3, 5, '啓蟄'], [3, 20, '春分'],
  [4, 4, '清明'], [4, 20, '穀雨'], [5, 5, '立夏'], [5, 21, '小満'], [6, 5, '芒種'], [6, 21, '夏至'],
  [7, 7, '小暑'], [7, 22, '大暑'], [8, 7, '立秋'], [8, 23, '処暑'], [9, 7, '白露'], [9, 23, '秋分'],
  [10, 8, '寒露'], [10, 23, '霜降'], [11, 7, '立冬'], [11, 22, '小雪'], [12, 7, '大雪'], [12, 21, '冬至'],
];
export function sekki(doy) {
  let name = '冬至';
  for (const [m, d, n] of SEKKI) if (doy >= D(m, d)) name = n;
  return name;
}

// 農作業の段階（会津地方の一般的な時期をもとにした目安）
export const STAGES = [
  { from: D(1, 1), name: '冬の田んぼ', note: '田んぼは雪の下で眠っています。農家は農機具の整備や来年の準備をします。' },
  { from: D(3, 10), name: '種もみ準備', note: '雪どけが進むころ、種もみの消毒・浸種・催芽を行います。' },
  { from: D(4, 3), name: '播種・育苗', note: '苗箱に種をまき、ハウスで苗を育てます。' },
  { from: D(4, 15), name: '田起こし', note: 'トラクターで土を耕し、元肥をまきます。' },
  { from: D(4, 27), name: '代かき', note: '水を入れて土を細かく砕き、田面を平らにします。畦の補修や水路の確認も。水鏡に山が映ります。' },
  { from: D(5, 15), name: '田植え', note: '田植機で苗を植えていきます。会津では5月中旬〜下旬が田植えの季節です。' },
  { from: D(5, 25), name: '除草・水管理', note: '初期除草剤をまき、水位を調整しながら分げつ（茎の増加）を促します。' },
  { from: D(6, 25), name: '中干し', note: '一時的に水を抜いて土を乾かし、根を強くします。溝切りも行います。' },
  { from: D(7, 12), name: '追肥・防除', note: '穂を育てる肥料を追加し、いもち病などの病害虫を防ぎます。' },
  { from: D(7, 30), name: '出穂・開花', note: '穂が出て、小さな白い花が咲きます。カメムシの防除も大切な時期です。' },
  { from: D(8, 14), name: '登熟', note: '間断かん水で水を管理しながら、実が少しずつ膨らみ穂が垂れていきます。' },
  { from: D(9, 8), name: '落水', note: '稲刈りに備えて水を抜き、田んぼを乾かします。' },
  { from: D(9, 22), name: '稲刈り', note: '黄金色に実りました。スワイプで刈り取りましょう！' },
  { from: D(10, 21), name: '乾燥・調製', note: 'はざ掛けで乾かし、籾すり・選別をして新米になります。' },
  { from: D(11, 3), name: '秋起こし', note: '稲わらを土にすき込み、来年に向けた土づくりをします。' },
  { from: D(11, 25), name: '冬支度', note: '畦や水路を補修し、農機具を整備して冬に備えます。' },
  { from: D(12, 8), name: '初雪', note: '山から雪が降りてきました。田んぼが白く染まっていきます。' },
];
export function stageOf(doy) {
  let s = STAGES[0];
  for (const st of STAGES) if (doy >= st.from) s = st;
  return s;
}

export const PLANT_START = D(5, 15);
export const PLANT_END = D(5, 24);
export const HARVEST_START = D(9, 22);
export const HARVEST_END = D(10, 21); // この日になったら残りは倒伏
export const HAZA_START = D(9, 24);
export const HAZA_END = D(11, 10);
export const PLOW_DAY = D(11, 3);

// 田んぼの水位 0..1（日単位の連続値）
export function waterLevel(t) {
  const f = (a, b) => smooth(a, b, t);
  // 4/27〜4/30 で満水、6/25〜6/27 中干しで抜く、7/12〜7/14 で張る、9/8〜9/10 落水
  return f(D(4, 27), D(4, 30)) * (1 - f(D(6, 25), D(6, 27))) +
    f(D(7, 12), D(7, 14)) * (1 - f(D(9, 8), D(9, 10)));
}

// 積雪 0..1
export function snowCover(t) {
  const melt = 1 - smooth(D(3, 5), D(3, 30), t);
  const fall = smooth(D(12, 8), D(12, 25), t);
  return Math.max(melt, fall);
}
// 山の雪線（標高 m、低いほど下まで雪）
const SNOWLINE = [[D(1, 1), 150], [D(2, 20), 150], [D(3, 20), 500], [D(4, 10), 800], [D(4, 30), 1150], [D(5, 20), 1450],
  [D(6, 5), 1700], [D(6, 15), 5000], [D(10, 30), 5000], [D(11, 5), 1500], [D(11, 25), 1000], [D(12, 10), 500], [D(12, 31), 150]];
export function snowLine(t) {
  for (let i = 1; i < SNOWLINE.length; i++) {
    const [d1, h1] = SNOWLINE[i];
    if (t <= d1) { const [d0, h0] = SNOWLINE[i - 1]; return h0 + (h1 - h0) * clamp((t - d0) / (d1 - d0)); }
  }
  return 150;
}

// 稲の生長
export function riceGrowth(t) {
  if (t < PLANT_START) return null;
  const h = 0.18 + 0.82 * smooth(PLANT_START, D(8, 5), t);        // 草丈
  const ear = smooth(D(7, 28), D(8, 10), t);                        // 穂の出方
  const ripe = smooth(D(8, 18), D(9, 25), t);                       // 色づき
  const droop = smooth(D(8, 12), D(9, 18), t);                      // 穂の垂れ
  const late = smooth(D(10, 8), D(10, 20), t);                      // 刈り遅れ
  return { h, ear, ripe, droop, late };
}

// 刈り取り時期による収量と等級
export function harvestQuality(t) {
  const best0 = D(9, 28), best1 = D(10, 8);
  if (t < best0) return 0.82 + 0.18 * smooth(HARVEST_START, best0, t);
  if (t <= best1) return 1.0;
  return 1.0 - 0.18 * smooth(best1, HARVEST_END, t);
}
export function grade(q) {
  if (q >= 0.97) return '1等米';
  if (q >= 0.9) return '2等米';
  return '3等米';
}

// 紅葉 0..1、落葉 0..1、新緑 0..1
export function foliage(t) {
  const green = smooth(D(4, 20), D(5, 25), t) * (1 - smooth(D(10, 10), D(11, 5), t));
  const autumn = smooth(D(10, 5), D(10, 30), t) * (1 - smooth(D(11, 15), D(11, 30), t));
  const fresh = smooth(D(4, 20), D(5, 5), t) * (1 - smooth(D(5, 20), D(6, 20), t));
  return { green, autumn, fresh };
}
export function sakura(t) { return smooth(D(4, 12), D(4, 18), t) * (1 - smooth(D(4, 22), D(4, 29), t)); }

// ---- 太陽位置（福島県・会津盆地付近） ----
const LAT = 37.5 * Math.PI / 180;
const LON = 139.9;
export function sunPosition(t) {
  // t: 日の通し値（doy + 時刻/24）、時刻はJST
  const doy = Math.floor(t);
  const hour = (t - doy) * 24;
  const g = (2 * Math.PI / 365) * (doy + (hour - 12) / 24);
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const solar = hour * 60 + eqt + 4 * (LON - 135);
  const ha = ((solar / 4) - 180) * Math.PI / 180;
  const sinEl = Math.sin(LAT) * Math.sin(decl) + Math.cos(LAT) * Math.cos(decl) * Math.cos(ha);
  const el = Math.asin(sinEl);
  let az = Math.acos(clamp((Math.sin(decl) - Math.sin(el) * Math.sin(LAT)) / (Math.cos(el) * Math.cos(LAT)), -1, 1));
  if (ha > 0) az = 2 * Math.PI - az; // 北から時計回り
  return { el, az };
}
// 月（簡易：朔望周期で位相、太陽の反対側付近）
export function moonPosition(t, year) {
  const days = (year - 2000) * 365.2422 + t;
  const phase = (((days - 6.1) / 29.53) % 1 + 1) % 1; // 0=新月 0.5=満月
  const p = sunPosition((t - phase + 365) % 365);       // 位相ぶん太陽から遅れて昇る
  return { el: p.el, az: p.az, phase };
}

// ---- 天気（年と日から決まる疑似乱数） ----
// 32ビット整数のまま掛け算する（普通の掛け算だと大きな数で精度が落ち、結果がほぼ0に偏って毎日雨になっていた）
function hash(n) { n = (n << 13) ^ n; n = (Math.imul(n, (Math.imul(Math.imul(n, n), 15731) + 789221) | 0) + 1376312589) & 0x7fffffff; return n / 0x7fffffff; }
export function weatherOf(doy, year) {
  const r = hash(doy * 7919 + year * 104729);
  const r2 = hash(doy * 3571 + year * 2903 + 17);
  const { month } = monthDay(doy);
  // 月別の降水確率（福島・会津のイメージ：冬は雪、梅雨、秋晴れ）
  // 月別の降水日の割合（会津若松の平年の降水日数〔12月 約15日・1月 約15日・2月 約14日・3月 約13日、年 約144日〕に合わせた目安）
  const pRain = [0.49, 0.48, 0.43, 0.33, 0.3, 0.42, 0.47, 0.33, 0.38, 0.32, 0.42, 0.47][month - 1];
  const pCloud = 0.3;
  let kind;
  // 冬は雪。3月は下旬ほど雨まじり、11月は下旬ほど雪まじり
  const { day } = monthDay(doy);
  const snowy = month <= 2 || month === 12 || (month === 3 && r2 > day / 40) || (month === 11 && r2 < (day - 10) / 30);
  if (r < pRain) kind = snowy ? 'snow' : 'rain';
  else if (r < pRain + pCloud) kind = 'cloudy';
  else kind = 'clear';
  const strength = 0.4 + 0.6 * r2;
  return { kind, strength };
}
export const WEATHER_LABEL = { clear: '晴れ', cloudy: 'くもり', rain: '雨', snow: '雪' };
