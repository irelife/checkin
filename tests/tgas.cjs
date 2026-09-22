/* サーバー側（gas/コード.gs）の検査。
   Google の道具は、にせ物を渡して動かします。
   ・送った内容の読み取り（列／特約の1行／昔の分）
   ・ご案内メールの文面が、送った内容で変わること
   ・届かなかった理由の言い分け
   使いかた： node tests/tgas.cjs                                    */
const fs = require('fs'), vm = require('vm'), path = require('path');
const DIR = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const src = fs.readFileSync(path.join(DIR, 'gas', 'コード.gs'), 'utf8');
const sent = [];
const ctx = {
  MailApp: { sendEmail:(to,subj,body,opt)=>sent.push({to,subj,body,opt}),
             getRemainingDailyQuota:()=>100 },
  Utilities: { formatDate:(d,tz,f)=>{
      const p=n=>String(n).padStart(2,'0');
      return f.replace('yyyy',d.getFullYear()).replace('MM',p(d.getMonth()+1))
              .replace('dd',p(d.getDate())).replace('HH',p(d.getHours()))
              .replace('mm',p(d.getMinutes())).replace('ss',p(d.getSeconds()));
    }, base64Encode:()=> '', base64Decode:()=>[], newBlob:()=>({}) },
  Logger:{log:()=>{}}, console,
  SpreadsheetApp:{}, DriveApp:{}, ScriptApp:{}, PropertiesService:{}, LockService:{},
  ContentService:{}, GmailApp:{},
};
vm.createContext(ctx);
vm.runInContext(src, ctx);

let pass=0, fail=0;
const ok=(c,m)=>{ if(c){pass++;} else {fail++;} console.log((c?'  ✅ ':'  ❌ ')+m); };
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

console.log('■ 送った内容の読み取り');
ok(eq(ctx.partsOf_({'送付内容':'guide'}), {guide:true,room:false,terms:false}), '列から読める（しおりだけ）');
ok(eq(ctx.partsOf_({'送付内容':'room,terms'}), {guide:false,room:true,terms:true}), '列から読める（室内＋重説）');
ok(eq(ctx.partsOf_({'該当特約':'火災保険について\n【送付内容】しおり・室内'}), {guide:true,room:true,terms:false}), '特約の1行から読める');
ok(eq(ctx.partsOf_({'該当特約':'火災保険について'}), {guide:true,room:true,terms:true}), '昔の分は3つとも');
ok(eq(ctx.partsOf_({}), {guide:true,room:true,terms:true}), '空でも落ちない');
ok(ctx.guideOnly_({'送付内容':'guide'})===true, 'しおりだけを見分ける');
ok(ctx.guideOnly_({'送付内容':'guide,room'})===false, 'しおり＋室内は、しおりだけではない');
ok(eq(ctx.partsKeys_({'送付内容':'terms,guide'}), ['guide','terms']), '並びは guide→room→terms');
ok(ctx.partsLabel_(['guide','room'])==='入居のしおり・室内チェック', '名前でつなげられる');

console.log('■ ご案内メールの文面');
const base={id:'X',pass:'ABC123',bldg:'ハルモニア',room:'201',name:'長崎',
            mail:'a@b.com',moveIn:'2026-10-01',parking:'9（軽）',postDial:'右に2回まわして1、左に5'};
function mailFor(parts){ sent.length=0; ctx.sendInvite(Object.assign({},base,{parts})); return sent[0]; }

let m = mailFor({guide:true,room:false,terms:false});
ok(m.subj.indexOf('【入居のしおり】')===0, 'しおりだけ → 件名が「入居のしおり」');
ok(m.body.indexOf('キズ')<0, 'しおりだけ → お部屋の確認のお願いが入っていない');
ok(m.body.indexOf('ご返信の期限')<0, 'しおりだけ → 返信の期限が入っていない');
ok(m.body.indexOf('駐車場の区画')>=0, 'しおりだけ → 駐車場の区画は入っている');
ok(m.body.indexOf('ABC123')>=0 && m.body.indexOf('?id=X')>=0, 'しおりだけ → リンクとパスワードは入っている');

m = mailFor({guide:false,room:true,terms:false});
ok(m.subj.indexOf('お部屋の確認について')>=0, '室内だけ → 件名が「お部屋の確認について」');
ok(m.body.indexOf('ご説明のあった内容')<0, '室内だけ → ご説明の確認は入っていない');
ok(m.body.indexOf('駐車場の区画')<0, '室内だけ → 駐車場の区画は入っていない（しおりの中身のため）');

m = mailFor({guide:false,room:false,terms:true});
ok(m.subj.indexOf('ご説明内容の確認について')>=0, '重説だけ → 件名が「ご説明内容の確認について」');
ok(m.body.indexOf('キズ')<0, '重説だけ → お部屋のキズの話は入っていない');

m = mailFor({guide:true,room:true,terms:true});
ok(m.subj.indexOf('お部屋の確認と、ご説明内容の確認について')>=0, '3つとも → これまでどおりの件名');
ok(m.body.indexOf('キズ')>=0 && m.body.indexOf('ご説明のあった内容')>=0 && m.body.indexOf('駐車場の区画')>=0,
   '3つとも → これまでどおりの中身');

console.log('■ 届かなかった理由');
ok(ctx.bounceWhy_('Address not found\n550 5.1.1')==='アドレスが見つかりません','アドレス不明を見分ける');
ok(ctx.bounceWhy_('mailbox is full')==='相手のメールボックスがいっぱいです','いっぱいを見分ける');
ok(ctx.bounceWhy_('なにかの理由')==='届きませんでした','分からないときの言い方');

console.log('PASS=' + pass + ' FAIL=' + fail);
process.exit(fail === 0 ? 0 : 1);
