// Web 版とアプリ（Android）に使うファイルを www/ にまとめる。アプリ用は --app を付ける
//   npm run build     … Web 版用。そのままコピーする
//   npm run build:app … アプリ用。Web 版だけの部分（動作確認用のしかけなど）を取り除く
// Web 版だけの部分は目印で囲む: JS は // web-only:start … // web-only:end、HTML は <!-- web-only --> … <!-- /web-only -->
// （アプリの中に「画面に出ない機能」を残すと、ストアの審査で問題になることがあるため）
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const item of ['index.html', 'css', 'js', 'lib']) {
  const src = path.join(root, item);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(out, item), { recursive: true });
}
// Google Play 用のビルドでは本番の広告を使う
const mode = process.env.ADMOB_MODE === 'production' ? 'production' : 'test';
fs.writeFileSync(path.join(out, 'js', 'ads-config.js'), `// ビルド時に生成\nwindow.AD_MODE = '${mode}';\n`);
// タイトル画面に出すバージョン（CI では VERSION_NAME / VERSION_CODE を使う）
const version = process.env.VERSION_CODE
  ? `v${process.env.VERSION_NAME || require('../package.json').version} (build ${process.env.VERSION_CODE})`
  : 'dev';
fs.writeFileSync(path.join(out, 'js', 'build-info.js'), `// ビルド時に生成\nwindow.APP_VERSION = '${version}';\n`);

const app = process.argv.includes('--app');
if (app) {
  const strip = {
    '.html': /[ \t]*<!-- web-only -->[\s\S]*?<!-- \/web-only -->[ \t]*\n?/g,
    '.js': /[ \t]*\/\/ web-only:start[\s\S]*?\/\/ web-only:end[ \t]*\n?/g,
  };
  const problems = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      if (fs.statSync(file).isDirectory()) { if (name !== 'lib') walk(file); continue; }
      const re = strip[path.extname(name)];
      if (!re) continue;
      const text = fs.readFileSync(file, 'utf8').replace(re, '');
      fs.writeFileSync(file, text);
      if (/web-only/.test(text)) problems.push(path.relative(out, file));
    }
  };
  walk(out);
  // 取り除き忘れがあればビルドを止める
  if (problems.length) throw new Error('web-only markers left in: ' + problems.join(', '));
}
console.log(`built web assets into www/ (${app ? 'app' : 'web'}, ads: ${mode}, version: ${version})`);
