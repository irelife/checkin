/* ★ 検査をまとめて走らせる係
 *
 *   使いかた：
 *     node tests/run-all.cjs              … このリポジトリを検査します
 *     node tests/run-all.cjs /別の/場所    … よその場所を検査します
 *
 *   1件でも失敗したら、終了コード 1 で終わります。
 *   GitHub Actions は、これを見て「赤」にします。
 *
 *   ★ 2026/10/17 新設
 *     検査は 2026/9/27 に tests/ フォルダごと消えていました。
 *     戻すにあたり、まとめて走らせる係も足しています。
 *     一覧に無い検査は走りません（PIVOT3 で実際に起きました）。
 *
 *   ★ このリポジトリの検査は、ぜんぶ素の JavaScript です。
 *     ブラウザを使わないので、playwright は要りません。
 */
const { execFileSync } = require('child_process');
const path = require('path');

const DIR = path.resolve(process.argv[2] || path.join(__dirname, '..'));

const SUITES = [
  ['tfind',   '探す欄（物件名と号室の両方から探せる）'],
  ['tyear',   '年の区切り（1月はじまり・完了は完了した年で分ける）'],
  ['tparts',  '送る内容（しおり・室内チェック・重要事項）の記録と読み戻し'],
];

let ngList = [];
let totalPass = 0;
console.log('検査する場所: ' + DIR);
console.log('');

for (const [name, what] of SUITES) {
  process.stdout.write('▶ ' + name + '  ' + what + ' … ');
  let out = '';
  let ng = false;
  try {
    out = execFileSync(process.execPath, [path.join(__dirname, name + '.cjs'), DIR],
                       { encoding: 'utf8', timeout: 5 * 60 * 1000 });
  } catch (e) {
    out = (e.stdout || '') + (e.stderr || '');
    ng = true;
  }
  const m = out.match(/PASS=(\d+)\s+(?:❌\s*)?FAIL=(\d+)/);
  const pass = m ? Number(m[1]) : 0;
  const fail = m ? Number(m[2]) : -1;
  if (fail !== 0) ng = true;
  totalPass += pass;

  console.log(ng ? ('❌ 合格' + pass + ' / 失敗' + (fail < 0 ? '?' : fail))
                 : ('✅ 合格' + pass));
  if (ng) {
    ngList.push(name);
    console.log('--- ' + name + ' の中身 ---');
    console.log(out.split('\n').filter(l => /❌|✗|PASS=|エラー|Error/.test(l)).join('\n'));
    console.log('--- ここまで ---');
  }
}

console.log('');
console.log('合格の合計: ' + totalPass + ' 件');
if (ngList.length === 0) {
  console.log('✅ すべて合格しました。');
  process.exit(0);
}
console.log('❌ 失敗した検査: ' + ngList.join(', '));
process.exit(1);
