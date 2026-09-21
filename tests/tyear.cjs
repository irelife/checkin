/* 年の区切りの検査（1月はじまり・完了は完了した年で分ける）
   使いかた： node tests/tyear.cjs                                    */
const fs = require('fs');
const path = require('path');
const DIR = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const src = fs.readFileSync(path.join(DIR, 'admin.html'), 'utf8');

/* admin.html の中から、年をあつかう部分だけ取り出して動かします */
const a = src.indexOf('function ymOf(v){');
const b = src.indexOf('function inDonePeriod(r){');
if (a < 0 || b < 0) { console.log('❌ 年をあつかう部分が見つかりません'); console.log('PASS=0 FAIL=1'); process.exit(1); }
const end = src.indexOf('\n  }', b) + 4;
const code = src.slice(a, end);

let PICK = '';                                   /* 絞り込みで選んだ年 */
const $ = () => ({ get value(){ return PICK; } });
const inPeriod = () => true;                     /* 月・エリアの絞り込みは別の検査で見ます */
const NOW = new Date();
const box = new Function('$', 'inPeriod', code + '; return { ymOf, fyOf, doneYearOf, thisYear, inDonePeriod };')($, inPeriod);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } };

const Y = NOW.getFullYear();

/* ① 年は1月はじまり */
ok(box.fyOf('2026/03/15') === 2026, '3月は、その年（2026年）になる（4月はじまりなら2025年だった）');
ok(box.fyOf('2026/04/01') === 2026, '4月も、その年（2026年）のまま');
ok(box.fyOf('2026/12/31') === 2026, '12月も、その年（2026年）');
ok(box.fyOf('2027/01/01') === 2027, '1月1日で、次の年（2027年）にきりかわる');

/* ② 完了は「完了した日」の年で数える */
ok(box.doneYearOf({ created:'2026/12/20', doneAt:'2027-01-05' }) === 2027,
   '去年 受け付けて、今年 完了したものは「今年の完了」');
ok(box.doneYearOf({ created:'2026/11/02' }) === 2026,
   '完了日が入っていない古いものは、受付日の年で代える');

/* ③ 年を選んでいないときは、今年の完了分だけ */
PICK = '';
ok(box.inDonePeriod({ created:'2020/05/05', doneAt: Y + '-06-01' }) === true,  '今年 完了した分は出る');
ok(box.inDonePeriod({ created:'2020/05/05', doneAt:(Y-1) + '-12-31' }) === false, '去年 完了した分は出ない');

/* ④ 年を選べば、その年の完了分が出る */
PICK = String(Y - 1);
ok(box.inDonePeriod({ created:'2020/05/05', doneAt:(Y-1) + '-12-31' }) === true,  '去年を選べば、去年の完了分が出る');
ok(box.inDonePeriod({ created:'2020/05/05', doneAt: Y + '-06-01' }) === false, '去年を選べば、今年の分は出ない');

/* ⑤ 要対応・未返信は年で切らない（inPeriod のまま＝年を見ない） */
PICK = String(Y - 5);
ok(inPeriod({ created:(Y - 1) + '/12/20' }) === true, '要対応・未返信は、年をまたいでも消えない');

console.log('PASS=' + pass + ' FAIL=' + fail);
process.exit(fail === 0 ? 0 : 1);
