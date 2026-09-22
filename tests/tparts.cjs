/* 送る内容（入居のしおり・室内チェック・重要事項）の検査
   ・選んだものだけを記録の1行にできること
   ・その1行から、選んだものを読み戻せること
   ・印の無い、これまでの分は「3つとも送った」ものとして扱うこと
   使いかた： node tests/tparts.cjs                                    */
const fs = require('fs');
const path = require('path');
const DIR = path.resolve(process.argv[2] || path.join(__dirname, '..'));

/* clauses.js を、そのまま読み込んで動かします */
global.window = {};
require(path.join(DIR, 'clauses.js'));
const W = global.window;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ALL = { guide:true, room:true, terms:true };

console.log('■ 送る内容の記録');
ok((W.PARTS || []).length === 3, '送る内容は3つ');
ok(same((W.PARTS||[]).map(p => p.key), ['guide','room','terms']), '名前は guide・room・terms');
ok(W.partsMark(['guide','room','terms']).indexOf(W.PARTS_MARK) === 0, '記録の1行は【送付内容】ではじまる');
ok(W.isPartsMark(W.partsMark(['room'])) === true, '記録の1行は、見分けられる');
ok(W.isPartsMark('入居のしおりメールについて') === false, '★ふつうの特約は、記録の1行と間違えない');

console.log('■ 選んだものを、読み戻せる');
[['guide'], ['room'], ['terms'], ['guide','room'], ['room','terms'], ['guide','room','terms']]
  .forEach(keys => {
    const want = { guide:false, room:false, terms:false };
    keys.forEach(k => { want[k] = true; });
    ok(same(W.partsRead([W.partsMark(keys)]), want), keys.join('・') + ' を読み戻せる');
  });

console.log('■ 特約の一覧にまざっていても、読み取れる');
const list = ['火災保険について', '駐車場', W.partsMark(['room','terms'])];
ok(same(W.partsRead(list), { guide:false, room:true, terms:true }),
   '★特約と一緒に並んでいても、送った内容が分かる');
ok(same(W.partsRead(['guide','terms']), { guide:true, room:false, terms:true }),
   '★サーバーが parts をそのまま返したときも読める');

console.log('■ これまでの分（印が無いもの）');
ok(same(W.partsRead([]), ALL),                       '空なら、3つとも送ったものとして扱う');
ok(same(W.partsRead(null), ALL),                     '何も無くても落ちない');
ok(same(W.partsRead(['火災保険について']), ALL),     '★昔の記録は、これまでどおり3つとも出す');
ok(same(W.partsRead(W.partsMark(['guide'])), { guide:true, room:false, terms:false }),
   '1行そのものを渡しても読める');

console.log('■ 1つも選ばなかったとき');
ok(same(W.partsRead([W.partsMark([])]), { guide:false, room:false, terms:false }),
   '「なし」は、3つとも出さない（管理画面では選べません）');

console.log('PASS=' + pass + ' FAIL=' + fail);
process.exit(fail === 0 ? 0 : 1);
