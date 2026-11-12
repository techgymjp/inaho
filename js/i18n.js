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
  'howto.7': 'Farm work events through the year — tilling, puddling, planting, weeding, stink-bug control, shooing sparrows, and in winter repairing levees, clearing snow off the greenhouse and spreading snow-melt — are all done by swiping the paddies. How well you do changes the harvest.',
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
  'howto.7': '一年を通して、田起こし・代かき・田植え・除草・カメムシ防除・スズメ追い、冬は畦の補修・ハウスの雪下ろし・融雪剤まきの農作業イベントがあります。どれも田んぼをなぞって行い、出来ばえが収穫に響きます。',
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

// ---- 農作業イベント ----
const J = LANG === 'ja';
const WORK = {
  till: J ? ['田起こし', '田んぼをなぞって耕す', 'よく耕すほど収量が増えます'] : ['Tilling', 'Swipe the paddies to till', 'More tilling, bigger harvest'],
  level: J ? ['代かき', '水を張った田んぼをなぞって平らにする', 'デコボコが残ると苗の育ちがそろいません'] : ['Puddling', 'Swipe the flooded paddies to level them', 'Bumpy paddies grow uneven rice'],
  plant: J ? ['田植え', '田んぼをなぞって苗を植える', '植え残しは後で手伝いが植えます（収量−15%）'] : ['Planting', 'Swipe along the paddies to plant seedlings', 'Unplanted rows get planted late (−15% yield)'],
  weed: J ? ['除草', '雑草（ヒエ）をなぞって抜く', '残った雑草は稲の栄養を奪います'] : ['Weeding', 'Swipe the weeds to pull them', 'Weeds left behind steal nutrients'],
  bug: J ? ['カメムシ防除', 'カメムシをなぞって捕まえる', '放っておくとお米に斑点がついて等級が下がります'] : ['Stink-bug control', 'Swipe the stink bugs to catch them', 'Bugs left alone spot the grain and lower the grade'],
  house: J ? ['ハウスの雪下ろし', 'ハウスの屋根をなぞって雪を落とす', '雪が重くなりすぎるとハウスがつぶれ、苗づくりに響きます'] : ['Clearing the greenhouse', 'Swipe the greenhouse roof to knock the snow off', 'Too much snow will crush the seedling greenhouse'],
  melt: J ? ['融雪剤まき', '雪の田んぼをなぞって融雪剤をまく', '黒い粉が日光を吸って、雪どけが早まります'] : ['Spreading snow-melt', 'Swipe the snowy paddies to spread snow-melting powder', 'The dark powder soaks up sunlight so the snow melts sooner'],
  levee: J ? ['畦の補修', '畦の穴をなぞってふさぐ', '穴が残ると来年、田んぼの水がもれます'] : ['Repairing levees', 'Swipe the holes in the levees to fill them', "Holes left open will leak water next year"],
  bird: J ? ['スズメ追い', 'スズメの群れをなぞって追い払う', 'スズメは実った稲をついばみます'] : ['Shooing sparrows', 'Swipe the flock to shoo the sparrows', 'Sparrows peck at the ripe rice'],
};
const daysLeft = (ev, t) => Math.max(0, Math.ceil(ev.end - t));
Object.assign(msg, {
  workEvent: (e, r) => {
    if (e === 'collapse') return J ? '<b>ハウスがつぶれてしまいました…</b><br>雪の重みに耐えられませんでした。今年の苗は買い苗でまかないます。' : '<b>The greenhouse collapsed…</b><br>It could not bear the weight of the snow. Seedlings will have to be bought this year.';
    if (e === 'houseWarn') return J ? '<b>ハウスの雪が重くなっています！</b><br>屋根をなぞって雪を下ろしましょう。' : '<b>Heavy snow on the greenhouse!</b><br>Swipe the roof to clear the snow.';
    if (e === 'leveeDone') {
      const fixed = Math.round((1 - r.levee.leak) * 100);
      return J ? `<b>畦の補修が終わりました</b><br>穴の ${fixed}% をふさぎました。来年の田んぼの水もちに効きます。` : `<b>Levee repairs are done</b><br>You filled ${fixed}% of the holes. It will help the paddies hold water next year.`;
    }
    return '';
  },
  workStart: (id) => `<b>${WORK[id][0]}${J ? 'の時期です' : ''}</b><br>${WORK[id][1]}${J ? '。' : '.'}<br>${WORK[id][2]}`,
  birdLine: (p) => J ? `スズメ ${p.live}群（被害 ${p.lost.toFixed(1)}kg）` : `Sparrows: ${p.live} flock(s), lost ${p.lost.toFixed(1)} kg`,
  work: (id, p, t, ev) => {
    const [label, hint, sub] = WORK[id];
    const left = J ? `あと${daysLeft(ev, t)}日` : `${daysLeft(ev, t)} days left`;
    if (id === 'house') {
      return { label, value: p.collapsed ? (J ? 'つぶれた…' : 'Collapsed…') : (J ? `屋根の雪 ${Math.round(p.load * 100)}%` : `Snow load ${Math.round(p.load * 100)}%`), ratio: p.collapsed ? 1 : p.load, right: left, sub: p.collapsed ? (J ? '苗は買い苗でまかないます（収量−10%）' : 'Seedlings will have to be bought (−10% yield)') : sub, hint };
    }
    if (id === 'levee') return { label, value: J ? `${p.fixed}か所` : `${p.fixed}`, ratio: p.shown ? p.fixed / p.shown : 0, right: left, sub: (J ? `残りの穴 ${p.shown - p.fixed}か所　` : `Holes left: ${p.shown - p.fixed}　`) + sub, hint };
    if (id === 'till' || id === 'level' || id === 'plant' || id === 'melt') {
      return { label, value: Math.floor(p * 100) + '%', ratio: p, right: left, sub, hint };
    }
    if (id === 'weed') return { label, value: J ? `${p.pulled}本` : `${p.pulled}`, ratio: p.shown ? p.pulled / p.shown : 0, right: left, sub: (J ? `生えている雑草 ${p.shown - p.pulled}本　` : `Weeds growing: ${p.shown - p.pulled}　`) + sub, hint };
    if (id === 'bug') return { label, value: J ? `${p.caught}匹` : `${p.caught}`, ratio: Math.min(1, p.caught / Math.max(1, p.caught + p.live)), right: left, sub: (J ? `いま ${p.live}匹　` : `Now: ${p.live}　`) + sub, hint };
    return { label, value: J ? `${p.live}群` : `${p.live}`, ratio: 0, right: J ? `被害 ${p.lost.toFixed(1)}kg` : `Lost ${p.lost.toFixed(1)} kg`, sub, hint };
  },
  workSummary: (r, F, birdLoss, W) => {
    const pc = (x) => x == null ? '—' : Math.round(x * 100) + '%';
    const mul = (f) => f === 1 ? '' : ` <small>(${J ? '収量' : 'yield'} ×${f.toFixed(2)})</small>`;
    const rows = [
      [WORK.till[0], pc(r.till) + (r.till == null ? '' : mul(F.tillF))],
      [WORK.level[0], pc(r.level) + (r.level == null ? '' : mul(F.levelF))],
      [WORK.plant[0], r.plant ? (J ? `自分で ${pc(r.plant.self / r.plant.total)}` : `by you ${pc(r.plant.self / r.plant.total)}`) + mul(F.plantF) : '—'],
      [WORK.weed[0], !r.skipped?.weed && (r.weed.done || r.weed.pulled) ? (J ? `${r.weed.pulled}/${W}本` : `${r.weed.pulled}/${W}`) + mul(F.weedF) : '—'],
      [WORK.bug[0], r.bug.spawned ? (J ? `${r.bug.caught}/${r.bug.spawned}匹` : `${r.bug.caught}/${r.bug.spawned}`) + (F.bugQ < 1 ? ` <small>(${J ? '品質' : 'quality'} ×${F.bugQ.toFixed(2)})</small>` : '') : '—'],
      [WORK.house[0], r.house && (r.house.done || r.house.collapsed) ? (r.house.collapsed ? (J ? 'つぶれた' : 'collapsed') + ` <small>(${J ? '収量' : 'yield'} ×0.90)</small>` : (J ? '無事' : 'safe')) : '—'],
      [WORK.melt[0], pc(r.melt) + (r.melt == null ? '' : mul(F.meltF))],
      [J ? '去年の畦の補修' : "Last year's levee repair", r.carryLeak ? (J ? `穴の残り ${Math.round(r.carryLeak * 100)}%` : `${Math.round(r.carryLeak * 100)}% left open`) + mul(F.leakF) : '—'],
      [WORK.bird[0], r.bird.shooed || birdLoss ? (J ? `被害 ${birdLoss.toFixed(1)}kg` : `lost ${birdLoss.toFixed(1)} kg`) : '—'],
    ];
    return `<h3 class="workTitle">${J ? '今年の農作業' : "This year's farm work"}</h3>` + rows.map(([a, b]) => `<div class="row"><span>${a}</span><b>${b}</b></div>`).join('');
  },
});

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
