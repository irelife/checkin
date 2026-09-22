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

/* ── 同じ物件・同じ号室をさがす（登録のときのおうかがい用）── */
{
  const a2 = src.indexOf('  function sameRoomRows(bldg, room){');
  const b2 = src.indexOf('\n  }', a2) + 4;
  const ROWS = [
    { id:'1', bldg:'アイレニック', room:'201', status:'完了' },
    { id:'2', bldg:'アイレニック', room:'202', status:'未返信' },
    { id:'3', bldg:'マーベラス',   room:'201', status:'完了' },
    { id:'4', bldg:'アイレニック', room:'２０１', status:'取消' },   /* 取り消しは除く */
    { id:'5', bldg:'アイレニック', room:'２０１', status:'返信済' },  /* 全角でも同じ部屋 */
  ];
  const same = new Function('ROWS', 'findKey',
    src.slice(a2, b2) + '; return sameRoomRows;')(ROWS, box.findKey);

  const ids = (b, r) => same(b, r).map(x => x.id).join(',');
  ok(ids('アイレニック', '201') === '1,5', '★同じ物件・同じ号室を見つける（取り消しは除く・全角も同じ）');
  ok(ids('アイレニック', '202') === '2',   '別の号室は混ざらない');
  ok(ids('マーベラス', '201')   === '3',   '別の物件は混ざらない');
  ok(ids('アイレニック', '999') === '',    '無ければ空');
  ok(ids('', '201') === '',                '物件名が空なら、おうかがいしない');
  ok(ids('アイレニック', '') === '',       '号室が空なら、おうかがいしない');
}

/* ── 同じ号室が重なったら、新しい1件だけ出す（古いほうは消さない）── */
{
  const a3 = src.indexOf('  function newestOnly(rows){');
  const b3 = src.indexOf('\n  }', a3) + 4;
  const rKey   = (r) => String(r.bldg || '').trim() + '｜' + String(r.room || '').trim();
  const newKey = (r) => String(r.doneAt || '');
  const only = new Function('rKey', 'newKey', src.slice(a3, b3) + '; return newestOnly;')(rKey, newKey);

  const rows = [
    { id:'古', bldg:'アイレニック', room:'201', doneAt:'2026-03-01' },
    { id:'新', bldg:'アイレニック', room:'201', doneAt:'2026-09-18' },
    { id:'別', bldg:'アイレニック', room:'202', doneAt:'2026-05-01' },
    { id:'他', bldg:'マーベラス',   room:'201', doneAt:'2026-01-01' },
  ];
  const got = only(rows).map(x => x.id);
  ok(got.join(',') === '新,別,他', '★同じ号室は、いちばん新しい1件だけ残る');
  ok(got.indexOf('古') < 0,        '★古いほうは一覧から下がる');
  ok(rows.length === 4,            '★元のデータは減っていない（消していない）');

  ok(only([]).length === 0, '0件でも落ちない');
  ok(only([rows[0]]).length === 1, '1件だけなら、そのまま出る');

  /* 完了日が同じときは、片方だけ残る（どちらでも構いませんが、増えないこと） */
  const same = [
    { id:'a', bldg:'X', room:'1', doneAt:'2026-09-18' },
    { id:'b', bldg:'X', room:'1', doneAt:'2026-09-18' },
  ];
  ok(only(same).length === 1, '完了日が同じでも、1件だけになる');
}

console.log('PASS=' + pass + ' FAIL=' + fail);
process.exit(fail === 0 ? 0 : 1);
