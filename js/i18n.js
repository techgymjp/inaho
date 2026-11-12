// 日本語 / English
const KEY = 'suiden365.lang';
let saved = null;
try { saved = localStorage.getItem(KEY); } catch (e) { /* 保存できない環境 */ }
export let LANG = saved || ((navigator.language || 'ja').toLowerCase().startsWith('ja') ? 'ja' : 'en');
export function setLang(l) { try { localStorage.setItem(KEY, l); } catch (e) { /* noop */ } location.reload(); }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEK_JA = ['日', '月', '火', '水', '木', '金', '土'], WEEK_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function fmtDate(month, day, weekday) {
  return LANG === 'ja' ? `${month}月${day}日（${WEEK_JA[weekday]}）` : `${WEEK_EN[weekday]}, ${MONTHS[month - 1]} ${day}`;
}
export function fmtMonthDay(month, day) { return LANG === 'ja' ? `${month}月${day}日` : `${MONTHS[month - 1]} ${day}`; }

const EN = {
  // UI
  'title.pre': 'From a rice paddy in the mountains of Fukushima',
  'title.lead': 'Watch over a year of rice paddies,<br>surrounded by mountains — one day per minute.',
  'title.lead2': 'Snowmelt, flooded fields, planting, golden ears of rice.<br>Only the harvest is in your hands.',
  'start.continue': 'Continue', 'start.spring': 'Start from tilling', 'start.today': "Start from today's date",
  'start.harvest': 'Start just before harvest', 'start.jan': "Start from New Year's Day",
  'start.tiny': '1 day = 1 minute (about 6 hours per year). Fast-forward available. Sound on.',
  'menu.records': 'Harvest records', 'menu.howto': 'How to play',
  'howto.1': 'A year in the rice paddy passes at 1 day = 1 minute (×10 to ×600 fast-forward).',
  'howto.2': 'Drag to look around. The view always returns to the same telephoto angle from the levee; "View" switches to other spots.',
  'howto.3': 'Sep 22 – Oct 20 is harvest time. Swipe across the rice to cut it, right from the usual view (dragging from outside the paddies looks around).',
  'howto.4': 'Cut between Sep 28 and Oct 8 for first-grade rice. Rice left too long falls over.',
  'howto.5': 'Farm-work timing follows typical dates in the Aizu region of Fukushima.',
  'howto.6': 'A local train runs along the distant line. At dusk the town chime plays "Going Home".',
  'menu.reset': 'Start over', 'menu.close': 'Close', 'menu.lang': '日本語に切り替え',
  'result.title': "This year's harvest", 'result.back': 'Back to the paddies',
  'harvest.cut': 'Harvested', 'harvest.hint': 'Swipe across the rice to cut it',
  'btn.pause': 'Pause (Space)', 'btn.view': 'View', 'sound.on': 'Sound: on', 'sound.off': 'Sound: off',
  'quality': 'Quality', 'quality.high': 'High', 'quality.low': 'Light', 'quality.switch': 'switch',
  // views
  'view.aze': 'Levee', 'view.drone': 'Sky', 'view.yama': 'Hillside', 'view.kominka': 'Farmhouse', 'view.north': 'Canal',
  // weather
  'wx.clear': 'Sunny', 'wx.cloudy': 'Cloudy', 'wx.rain': 'Rain', 'wx.snow': 'Snow',
  // grades
  '1等米': 'Grade 1 rice', '2等米': 'Grade 2 rice', '3等米': 'Grade 3 rice',
};
const JA = {
  'title.pre': '福島・山あいの田んぼより',
  'title.lead': '山に囲まれた田んぼの一年を、<br>一日一分で見守る。',
  'title.lead2': '雪どけ、水張り、田植え、黄金の穂。<br>稲刈りのときだけ、あなたの手で。',
  'start.continue': 'つづきから', 'start.spring': '田起こしから始める', 'start.today': '今日の日付から',
  'start.harvest': '稲刈りの直前から', 'start.jan': '元日から',
  'start.tiny': '1日＝1分（1年で約6時間）。早送りもできます。音が出ます。',
  'menu.records': '収穫の記録', 'menu.howto': 'あそびかた',
  'howto.1': '田んぼの一年が、1日＝1分で進みます（×10〜×600で早送り）。',
  'howto.2': 'ドラッグで見回せます。しばらくするといつもの畦道の望遠アングルに戻ります。「視点」でほかの場所にも切り替えられます。',
  'howto.3': '9月22日〜10月20日は稲刈り。いつもの景色のまま、田んぼの稲をスワイプして刈り取ります（田んぼの外からのドラッグは見回し）。',
  'howto.4': '9月28日〜10月8日に刈ると一等米。遅れると稲が倒れてしまいます。',
  'howto.5': '農作業の時期は会津地方の一般的な目安をもとにしています。',
  'howto.6': '遠くの線路をローカル線が走ります。夕方には「家路」のチャイムが鳴ります。',
  'menu.reset': '最初からやり直す', 'menu.close': '閉じる', 'menu.lang': 'Switch to English',
  'result.title': '今年の収穫', 'result.back': '田んぼへ戻る',
  'harvest.cut': '刈り取り', 'harvest.hint': '田んぼの稲を指でなぞって刈り取る',
  'btn.pause': '一時停止（Space）', 'btn.view': '視点', 'sound.on': '音：オン', 'sound.off': '音：オフ',
  'quality': '画質', 'quality.high': '高', 'quality.low': '軽量', 'quality.switch': '切替',
  'view.aze': '畦道', 'view.drone': '空から', 'view.yama': '里山', 'view.kominka': '古民家', 'view.north': '水路',
  'wx.clear': '晴れ', 'wx.cloudy': 'くもり', 'wx.rain': '雨', 'wx.snow': '雪',
};

// 農作業の段階（日本語名 → 英語）
const STAGE_EN = {
  '冬の田んぼ': ['Winter paddies', 'The paddies sleep under the snow. Farmers service their machines and prepare for next year.'],
  '種もみ準備': ['Seed preparation', 'As the snow melts, seed rice is disinfected, soaked and sprouted.'],
  '播種・育苗': ['Sowing seedlings', 'Seeds are sown in trays and the seedlings are raised in a greenhouse.'],
  '田起こし': ['Tilling', 'A tractor turns over the soil and spreads base fertilizer.'],
  '代かき': ['Puddling', 'Water is let in and the soil is broken up and leveled. The levees and canals are checked. The mountains are mirrored in the water.'],
  '田植え': ['Rice planting', 'A rice transplanter sets out the seedlings. In Aizu, planting season is mid-to-late May.'],
  '除草・水管理': ['Weeding & water care', 'Early herbicide is applied and the water level is adjusted to encourage tillering.'],
  '中干し': ['Mid-season drainage', 'The water is drained for a while so the soil dries and the roots grow strong. Drainage furrows are cut.'],
  '追肥・防除': ['Top-dressing & pest control', 'Extra fertilizer feeds the developing ears, and the crop is protected from rice blast and pests.'],
  '出穂・開花': ['Heading & flowering', 'The ears emerge and tiny white flowers bloom. Stink-bug control matters now.'],
  '登熟': ['Ripening', 'With intermittent irrigation, the grains slowly fill and the ears begin to droop.'],
  '落水': ['Final drainage', 'The water is drained so the paddies dry out before harvest.'],
  '稲刈り': ['Harvest', 'The rice has turned gold. Swipe to cut it!'],
  '乾燥・調製': ['Drying & hulling', 'The rice dries on hazagake racks, then is hulled and sorted into new-crop rice.'],
  '秋起こし': ['Autumn plowing', 'Rice straw is plowed into the soil to build it up for next year.'],
  '冬支度': ['Preparing for winter', 'Levees and canals are repaired and machines serviced before winter.'],
  '初雪': ['First snow', 'Snow has come down from the mountains. The paddies are turning white.'],
};
const SEKKI_EN = {
  '小寒': 'Minor Cold', '大寒': 'Major Cold', '立春': 'Start of Spring', '雨水': 'Rain Water', '啓蟄': 'Insects Awaken', '春分': 'Spring Equinox',
  '清明': 'Clear & Bright', '穀雨': 'Grain Rain', '立夏': 'Start of Summer', '小満': 'Grain Buds', '芒種': 'Grain in Ear', '夏至': 'Summer Solstice',
  '小暑': 'Minor Heat', '大暑': 'Major Heat', '立秋': 'Start of Autumn', '処暑': 'End of Heat', '白露': 'White Dew', '秋分': 'Autumn Equinox',
  '寒露': 'Cold Dew', '霜降': 'Frost Descent', '立冬': 'Start of Winter', '小雪': 'Minor Snow', '大雪': 'Major Snow', '冬至': 'Winter Solstice',
};

export function t(key, ...args) {
  const d = LANG === 'ja' ? JA : EN;
  let v = d[key] ?? JA[key] ?? key;
  if (typeof v === 'function') v = v(...args);
  return v;
}
export const stageText = (st) => LANG === 'ja' ? st : { ...st, name: STAGE_EN[st.name]?.[0] ?? st.name, note: STAGE_EN[st.name]?.[1] ?? st.note };
export const sekkiText = (s) => LANG === 'ja' ? s : (SEKKI_EN[s] ?? s);
export const gradeText = (g) => LANG === 'ja' ? g : (EN[g] ?? g);

// 文章のテンプレート
export const msg = {
  yearDay: (y, d) => LANG === 'ja' ? `${y}年目 ・ ${d}日目` : `Year ${y} · Day ${d}`,
  speedTitle: (s) => LANG === 'ja' ? (s === 1 ? '1日＝1分' : `1日＝${(60 / s).toFixed(s >= 600 ? 1 : 0)}秒`) : (s === 1 ? '1 day = 1 min' : `1 day = ${(60 / s).toFixed(s >= 600 ? 1 : 0)} s`),
  kg: (kg) => LANG === 'ja' ? `${Math.round(kg).toLocaleString()} kg（${(kg / 60).toFixed(1)}俵）` : `${Math.round(kg).toLocaleString()} kg (${(kg / 60).toFixed(1)} bales)`,
  gradeNow: (g) => LANG === 'ja' ? `いま刈ると：${g}` : `Cut now: ${gradeText(g)}`,
  view: (label) => LANG === 'ja' ? `視点：${label}` : `View: ${label}`,
  quality: (name) => LANG === 'ja' ? `画質：${name}（切替）` : `Quality: ${name} (switch)`,
  confirmFast: () => LANG === 'ja' ? '稲刈りの期間中です。早送りすると刈り取りの時間が減ります。早送りしますか？' : 'It is harvest time. Fast-forwarding leaves less time to cut the rice. Fast-forward anyway?',
  confirmReset: () => LANG === 'ja' ? '記録を消して最初からやり直しますか？' : 'Erase your records and start over?',
  noRecords: () => LANG === 'ja' ? 'まだ収穫の記録はありません' : 'No harvests recorded yet',
  recordRow: (r) => LANG === 'ja'
    ? `<tr><td>${r.year}年目</td><td>${r.kg.toLocaleString()}kg</td><td>${(r.kg / 60).toFixed(1)}俵</td><td>${r.grade}</td></tr>`
    : `<tr><td>Year ${r.year}</td><td>${r.kg.toLocaleString()} kg</td><td>${(r.kg / 60).toFixed(1)} bales</td><td>${gradeText(r.grade)}</td></tr>`,
  harvestStart: () => LANG === 'ja'
    ? '<b>稲刈りの季節です！</b><br>田んぼの稲を指でなぞって（スワイプして）刈り取りましょう。<br>9月28日〜10月8日に刈ると一等米に。'
    : '<b>Harvest time!</b><br>Swipe across the rice with your finger to cut it.<br>Cut between Sep 28 and Oct 8 for first-grade rice.',
  newYear: (y, last) => LANG === 'ja'
    ? `<b>${y}年目の春を迎えます</b><br>${last ? `昨年の収穫：${last.kg.toLocaleString()}kg（${last.grade}）` : '新しい一年のはじまり'}`
    : `<b>Welcome to the spring of year ${y}</b><br>${last ? `Last year's harvest: ${last.kg.toLocaleString()} kg (${gradeText(last.grade)})` : 'A new year begins'}`,
  result: (rec, bowls, lostPct) => LANG === 'ja' ? `
    <div class="big">${rec.kg.toLocaleString()}<small> kg</small></div>
    <div class="row"><span>俵（60kg）</span><b>${(rec.kg / 60).toFixed(1)} 俵</b></div>
    <div class="row"><span>等級</span><b>${rec.grade}</b></div>
    <div class="row"><span>刈り取り率</span><b>${rec.rate}%</b></div>
    <div class="row"><span>ごはん換算</span><b>約 ${bowls.toLocaleString()} 杯</b></div>
    ${lostPct ? `<p class="warn">刈り遅れた稲 ${lostPct}% は倒れてしまいました。</p>` : ''}
    <p class="note">刈った稲は「はざ掛け」で天日に干されます。</p>` : `
    <div class="big">${rec.kg.toLocaleString()}<small> kg</small></div>
    <div class="row"><span>Bales (60 kg)</span><b>${(rec.kg / 60).toFixed(1)}</b></div>
    <div class="row"><span>Grade</span><b>${gradeText(rec.grade)}</b></div>
    <div class="row"><span>Harvested</span><b>${rec.rate}%</b></div>
    <div class="row"><span>Bowls of rice</span><b>about ${bowls.toLocaleString()}</b></div>
    ${lostPct ? `<p class="warn">${lostPct}% of the rice was left too long and fell over.</p>` : ''}
    <p class="note">The cut rice is hung on hazagake racks to dry in the sun.</p>`,
};

// HTML の data-i18n を差し替え
export function applyStatic() {
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.innerHTML = t(el.dataset.i18n); });
  if (LANG !== 'ja') {
    document.title = 'Suiden 365 — A Year in the Rice Paddies';
    const h1 = document.querySelector('h1');
    if (h1 && !document.getElementById('enSub')) h1.insertAdjacentHTML('afterend', '<p class="pre" id="enSub">Suiden 365 · A Year in the Rice Paddies</p>');
  }
}
