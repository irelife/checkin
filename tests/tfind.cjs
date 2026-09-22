/* 探す欄の検査。物件名と号室の両方から探せること。 */
const fs = require('fs');
const path = require('path');
const DIR = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const src = fs.readFileSync(path.join(DIR, 'admin.html'), 'utf8');

const a = src.indexOf('  function findKey(v){');
const b = src.indexOf('\n  }', src.indexOf('  function hitFind(r, q){')) + 4;
if (a < 0 || b < 4) { console.log('❌ 探す道具が見つかりません'); console.log('PASS=0 FAIL=1'); process.exit(1); }
const box = new Function(src.slice(a, b) + '; return { findKey, hitFind };')();

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } };
const R = { bldg: 'アイレニック', room: '201' };
const S = { bldg: 'マーベラス',   room: 'B101' };

ok(box.hitFind(R, '') === true,                  '何も入れなければ、ぜんぶ出る');
ok(box.hitFind(R, 'アイレニック') === true,       '物件名で当たる');
ok(box.hitFind(R, 'アイレ') === true,             '物件名のとちゅうでも当たる');
ok(box.hitFind(R, '201') === true,                '★号室だけでも当たる');
ok(box.hitFind(R, 'アイレニック 201') === true,   '★物件名と号室を分けて書いても当たる');
ok(box.hitFind(R, '201 アイレ') === true,         '順番が逆でも当たる');
ok(box.hitFind(R, 'アイレニック 202') === false,  '号室が違えば当たらない');
ok(box.hitFind(R, 'マーベラス') === false,        'ほかの物件には当たらない');
ok(box.hitFind(S, 'B101') === true,               '英字の入った号室でも当たる');
ok(box.hitFind(S, 'b101') === true,               '大文字・小文字は区別しない');
ok(box.hitFind(R, '２０１') === true,             '★全角の数字でも当たる');
ok(box.hitFind(R, 'アイレニック　201') === true,  '★全角の空白で区切っても当たる');
ok(box.hitFind({ bldg:'', room:'' }, '201') === false, '中身が空なら当たらない');
ok(box.hitFind(R, '   ') === true,                '空白だけなら、ぜんぶ出る');

console.log('PASS=' + pass + ' FAIL=' + fail);
process.exit(fail === 0 ? 0 : 1);
