/* =====================================================================
   入居時チェック アプリ ｜ サーバー側（Google Apps Script）
   v2.14  2026/09/22

   ★ v2.14 で足したこと（4つ）
    30) 送る内容を、3つから選べるようにしました
        ・入居のしおり／室内チェック／重要事項
        ・管理画面で印を付けたものだけが、入居者様の画面に出ます
        ・ご案内メールの文面も、送った内容に合わせて変わります
          （入居のしおりだけの方に、お部屋の確認のお願いは書きません）
        ・「送付内容」の列に残します
    31) 入居のしおりだけの件は、送った時点で「完了」にします
        ・ご返信をお待ちするものがないためです
        ・督促メールも送りません
    32) メールが届かなかったこと（不達）を、こちらで見つけます
        ・1時間ごとに、送信元の Gmail に届く不達のお知らせを見ます
        ・見つけたら「不達」の列に印を付けます
        ・管理画面では、その1件が赤くなり「アドレス相違による未送信」と出ます
        ・印の付いた件には、自動の督促メールを送りません
    33) 宛先を直して、送り直せるようにしました
        ・管理画面の「宛先を直して送り直す」から
        ・パスワードとリンクは、これまでと同じものです
        ・送れたら、不達の印は消えます

   ★ v2 で足したこと（5つ）
     1) エリア（福山市・倉敷市・岡山市…）で分ける
        ・依頼を作るときにエリアを選びます
        ・返信の通知は、そのエリアの担当者あてに届きます
     2) 印を付けなかった理由を、入居者に選んでもらう
        「説明を受けていない／意味が分からなかった／納得できない」
     3) 仲介業者（会社・担当・メール）を登録し、
        「説明を受けていない」があったとき、仲介へ連絡できるようにする
     4) 「完了」ボタン。返信を確認し終えたものを、完了へ移す
     5) 年度でしぼる（4月〜翌3月）。古いものは既定では出しません
     6) 督促の状況を一覧に返す（何回送ったか／次に自動で出る日）  ← v2.1
     7) メールのパスワードを、リンクから1行あけて出す              ← v2.2
     8) 仲介への文面を「重説の記載項目です」という伝え方に直す    ← v2.3
     9) すべて問題なしの返信は、自動で「完了」にする              ← v2.4
    10) 返信から3日たっても完了にしていない件を、社内へお知らせ    ← v2.4
    11) 印の付かなかった特約の数を、理由を問わず数える（未確認件数）← v2.5
    12) 仲介へ連絡した日と回数を残す（「仲介へ確認」タブのため）    ← v2.5
    13) 送信を速く（ドライブ・表の呼び出しを減らす）                ← v2.6
    14) 期限は「契約開始日」から7日で数える                        ← v2.7
    15) 自動督促を送ったら、そのまま「完了」へ移す                  ← v2.7
    16) 社内への「3日たっても未完了」のお知らせは やめました        ← v2.7
    17) ご返信は何度でもいただけます。完了のあとでも受け付けます    ← v2.8
    18) 「回答」の表は、秒まで記録します（同じ分の2回を見分けるため）← v2.8

   ★ v2.9 で足したこと（5つ）
    19) 写真は、既定では公開しません
        ・これまではフォルダごと「リンクを知っている人は見られる」
          にしていました。アドレスが外に出ると、全員ぶんの写真が
          見られてしまいます。
        ・これからは共有しません。社内の Google アカウントで開いてください。
        ・前のやり方に戻すときは CFG.PHOTO_PUBLIC を true にします。
    20) 「完了」に、理由を残します
    21) 誰が操作したかを残します
    22) 1件を開くのを速くしました
    23) ご返信の受付を、完了から一定の日数で閉じます
    24) 写真と間取り図は、このアプリ自身がお渡しします
    25) 入居者が、途中で「一時保存」できます
    26) 「変わったかどうか」だけを、軽く聞けるようにしました
    27) メールが送れなくても、ご返信そのものは受け付けます
    28) きょう、あと何通送れるかを、管理画面に出します
    29) 1件を、まるごと消せるようにしました

   ★ 表の列は、足りなければ自動で足します。中身は消しません。

   保管場所
     スプレッドシート「一覧」  … 1件＝1行
     スプレッドシート「回答」  … 部屋ごとの答え（1部屋＝1行）
     ドライブのフォルダ        … 送られてきた写真

   同時に何人入力しても壊れないように、書き込みは順番待ち
   （LockService）にしています。

   ★★ 貼り替えたあとに、1回だけしていただくこと ★★
     Apps Script の画面の上で、関数に「setup」を選んで実行してください。
     ・足りない列（送付内容・不達）が、自動で足されます
     ・1時間ごとに不達をしらべる仕掛けが、用意されます
     ・そのとき Gmail を読む許可を求められます。「許可」してください
       （不達のお知らせは、送信元の Gmail に届くためです）
   ===================================================================== */

/* ----------------------------------------------------------------
   ここだけ、最初に設定してください
   ---------------------------------------------------------------- */
var CFG = {
  // 転送先（担当者のメール）。エリアの指定が無いときは、ここへ届きます
  TO_MAIL   : 'crm.irelife@gmail.com',

  // ★ エリアごとの担当者。ここを埋めると、そのエリアの返信はここへ届きます
  //   空のままにしておくと、上の TO_MAIL へ届きます（いまと同じ動き）
  //   カンマで複数書けます  例: 'a@example.com,b@example.com'
  AREA_MAIL : {
    '福山支店' : '',
    '倉敷支店' : '',
    '岡山支店' : ''
  },
  // 依頼を作るときに選べるエリア（増やすときは、ここに足してください）
  AREAS : ['福山支店', '倉敷支店', '岡山支店', 'その他'],

  // 管理画面から操作するときのパスワード。長めの文字列にしてください
  ADMIN_KEY : 'irelife5383',
  // 会社名（メールの署名に出ます）
  COMPANY   : 'IREライフ株式会社',
  // 入居者が開くページのURL（GitHub Pages のアドレス）
  APP_URL   : 'https://irelife.github.io/checkin/',
  // 返事の期限（日）
  DUE_DAYS  : 7,
  // 督促は何日おきに出すか
  REMIND_EVERY_DAYS : 3,
  // 督促は最大何回まで
  REMIND_MAX : 1,

  // ★ 仲介業者へ連絡してから、何日で督促を出すか（1回だけ出します）
  AGENT_REMIND_DAYS : 7,

  // ★ v2.4）「すべて問題なし」の返信を、自動で完了にする
  AUTO_DONE_WHEN_CLEAN : true,

  // ★ v2.7）自動の督促メールを送ったら、そのまま「完了」にするか
  DONE_AFTER_AUTO_REMIND : true,

  // ★ v2.6）写真の共有を、1枚ずつ設定するか
  SHARE_EACH_FILE : false,

  // ★ v2.9）写真を、リンクを知っている人に見せるか
  PHOTO_PUBLIC : false,

  // ★ v2.9）ご返信の受付を、完了の日から何日で閉じるか（0 でずっと受付）
  CLOSE_INPUT_DAYS : 30,

  // ★ v2.9）受付を閉じたあとに、入居者の画面へ出すお問い合わせ先
  CLOSE_TEL : '',

  // ★ v2.9）操作履歴を、何行まで残すか（古いものから消えます）
  ACT_LOG_MAX : 30,

  // ★ v2.14）不達（届かなかったメール）を、何日前まで見にいくか
  //   1時間ごとに見ますので、3日ぶんも見れば十分です
  BOUNCE_DAYS : 3,

  // ★ v2.14）不達をしらべ終えた通知に付ける、Gmail の名札
  //   同じ通知を何度も見ないための目印です。変えなくて構いません
  BOUNCE_LABEL : 'checkin-bounce'
};

var SHEET_LIST = '一覧';
var SHEET_ANS  = '回答';

/* ★ 列は、末尾に足しています。1〜16列目は動かしていないので、
   これまでの行はそのまま使えます。
   ★ v2.14）「送付内容」「不達」を、いちばん後ろに足しました。 */
var HEAD_LIST = ['ID','作成日','物件名','号室','契約者名','メール','入居日',
                 '該当特約','間取り図','パスワード','状態','返信日',
                 '問題あり件数','督促回数','最終督促日','メモ',
                 'エリア','仲介会社','仲介担当','仲介メール','未説明件数','完了日',
                 'アラート回数','最終アラート日',
                 '未確認件数','仲介連絡日','仲介連絡回数',
                 '駐車場区画','ポストダイヤル',
                 /* ★ 仲介業者からの回答 */
                 '仲介キー','仲介返信日','仲介可否','仲介備考','仲介督促日',
                 /* ★ v2.9）完了の理由と、誰が操作したか */
                 '完了理由','操作者','操作履歴',
                 /* ★ v2.14）送った内容と、届かなかったときの印 */
                 '送付内容','不達'];
var HEAD_ANS  = ['ID','送信日時','種類','場所','判定','コメント','写真'];

/* ★ v2.9）入居者の「一時保存」。1件＝1行で、書き替えていきます。 */
var SHEET_DRAFT = '下書き';
var HEAD_DRAFT  = ['ID','更新日時','中身'];

/* 列の番号を、名前から引きます（番号の数え間違いを防ぐため） */
function colOf(name){ return HEAD_LIST.indexOf(name) + 1; }

/* ----------------------------------------------------------------
   入口
   ---------------------------------------------------------------- */
function doGet(e){
  return json({ ok:true, msg:'入居時チェック API v2' });
}

function doPost(e){
  var req = {};
  try{ req = JSON.parse(e.postData.contents || '{}'); }catch(err){}
  var act = String(req.action || '');
  try{
    if(act === 'create')  return json(apiCreate(req));
    if(act === 'open')    return json(apiOpen(req));
    if(act === 'submit')  return json(apiSubmit(req));
    if(act === 'list')    return json(apiList(req));
    if(act === 'detail')  return json(apiDetail(req));
    if(act === 'remind')  return json(apiRemind(req));
    if(act === 'cancel')  return json(apiCancel(req));
    /* ★ v2 で足した窓口 */
    if(act === 'done')      return json(apiDone(req));        // 完了にする／戻す
    if(act === 'agentMail') return json(apiAgentMail(req));   // 仲介へ連絡（下書き／送信）
    if(act === 'config')    return json(apiConfig(req));      // エリアの一覧を返す
    /* ★ 仲介業者が開く画面。管理パスワードは要りません。 */
    if(act === 'agentOpen')  return json(apiAgentOpen(req));
    if(act === 'agentReply') return json(apiAgentReply(req));
    /* ★ v2.9）入居者の「一時保存」。管理パスワードは要りません */
    if(act === 'draftSave')  return json(apiDraftSave(req));
    /* ★ v2.10）写真・間取り図を、このアプリ自身がお渡しします */
    if(act === 'photo')      return json(apiPhoto(req));
    if(act === 'plan')       return json(apiPlan(req));
    /* ★ v2.11）変わったかどうかだけを、軽く聞く */
    if(act === 'ping')       return json(apiPing(req));
    /* ★ v2.12）1件を、まるごと消す（戻せません） */
    if(act === 'drop')       return json(apiDrop(req));
    /* ★ v2.14）宛先を直して、ご案内を送り直す */
    if(act === 'resend')     return json(apiResend(req));
    return json({ ok:false, err:'不明な操作です' });
  }catch(err){
    return json({ ok:false, err:String(err && err.message || err) });
  }
}

function json(o){
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ----------------------------------------------------------------
   表の用意
   ---------------------------------------------------------------- */
function ss(){ return SpreadsheetApp.getActiveSpreadsheet(); }

/* すでにある表には、足りない見出しだけを右に足します。 */
function sheet(name, head){
  var s = ss().getSheetByName(name);
  if(!s){
    s = ss().insertSheet(name);
    s.getRange(1,1,1,head.length).setValues([head]).setFontWeight('bold');
    s.setFrozenRows(1);
    return s;
  }
  var w = Math.max(s.getLastColumn(), 1);
  var cur = s.getRange(1, 1, 1, w).getValues()[0];
  var have = {}, i;
  for(i = 0; i < cur.length; i++) have[String(cur[i])] = 1;
  var add = [];
  for(i = 0; i < head.length; i++){ if(!have[head[i]]) add.push(head[i]); }
  if(add.length){
    if(s.getMaxColumns() < w + add.length){
      s.insertColumnsAfter(s.getMaxColumns(), w + add.length - s.getMaxColumns());
    }
    s.getRange(1, w + 1, 1, add.length).setValues([add]).setFontWeight('bold');
  }
  return s;
}
/* ★ v2.6）表も、1回の実行のあいだは覚えておきます。 */
var _sh = {};
function listSheet(){ return _sh['L'] || (_sh['L'] = sheet(SHEET_LIST, HEAD_LIST)); }
function ansSheet(){  return _sh['A'] || (_sh['A'] = sheet(SHEET_ANS,  HEAD_ANS)); }
function draftSheet(){ return _sh['D'] || (_sh['D'] = sheet(SHEET_DRAFT, HEAD_DRAFT)); }

/* ★ v2.6）写真の置き場。1回の送信のあいだは、探した結果を覚えておきます。 */
var _folder = null;
function photoFolder(){
  if(_folder) return _folder;
  var name = '入居時チェック_写真';
  var it = DriveApp.getFoldersByName(name);
  _folder = it.hasNext() ? it.next() : DriveApp.createFolder(name);
  if(CFG.PHOTO_PUBLIC === true && CFG.SHARE_EACH_FILE !== true){
    try{ _folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }catch(e){}
  }
  return _folder;
}

/* ★ v2.9）すでに公開になっている写真の置き場を、非公開に戻します。 */
function 写真の共有をやめる(){
  var f = photoFolder();
  f.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  return '写真の置き場を非公開にしました。'
       + '管理画面で写真を見るときは、同じブラウザで会社の Google アカウントに'
       + 'ログインしてください。';
}
/* もとに戻すとき（おすすめしません）。CFG.PHOTO_PUBLIC も true にしてください */
function 写真の共有をもとにもどす(){
  var f = photoFolder();
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'リンクを知っている人は見られる状態に戻しました。';
}

/* ================================================================
   ★ v2.10）写真・間取り図を、このアプリ自身がお渡しします
   ================================================================ */
var PHOTO_MAX_BYTES = 8 * 1024 * 1024;   /* これより大きいものはお渡ししません */

/* ドライブのアドレスから、ファイルの番号だけを取り出します */
function fileIdOf_(u){
  var m = /[-\w]{25,}/.exec(String(u || ''));
  return m ? m[0] : '';
}
/* このアプリの置き場にあるファイルか、確かめます */
function inPhotoFolder_(f){
  var want = '';
  try{ want = photoFolder().getId(); }catch(e){ return false; }
  if(!want) return false;
  try{
    var it = f.getParents();
    while(it.hasNext()){ if(it.next().getId() === want) return true; }
  }catch(e){}
  return false;
}
function fileDataUrl_(id){
  var f = DriveApp.getFileById(id);
  if(!inPhotoFolder_(f)) throw new Error('この画像は、このアプリのものではありません');
  var b = f.getBlob();
  var bytes = b.getBytes();
  if(bytes.length > PHOTO_MAX_BYTES) throw new Error('画像が大きすぎます');
  return 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(bytes);
}

/* 管理画面から。写真も間取り図も、ここでお渡しします */
function apiPhoto(req){
  needAdmin(req);
  var id = fileIdOf_(req.url || req.fileId);
  if(!id) throw new Error('画像が見つかりません');
  return { ok:true, data: fileDataUrl_(id) };
}

/* 入居者の画面から。その方の間取り図だけをお渡しします */
function apiPlan(req){
  var r = findRow(req.id);
  if(!r) throw new Error('この番号のご案内が見つかりません');
  var o = rowObj(listSheet(), r);
  if(String(o['パスワード']) !== String(req.pass||'').toUpperCase().trim()){
    return { ok:false, err:'パスワードがちがいます' };
  }
  var id = fileIdOf_(o['間取り図']);
  if(!id) return { ok:false, err:'間取り図はありません' };
  return { ok:true, data: fileDataUrl_(id) };
}

/* ================================================================
   ★ v2.13）メールは「送れなくても、先へ進む」ようにします
   ================================================================ */
function mailLeft_(){
  try{ return Number(MailApp.getRemainingDailyQuota()); }catch(e){ return -1; }
}
/* メールを1通送ってみます。送れたら ''、送れなければ、その理由を返します */
function trySend_(what, fn){
  try{ fn(); return ''; }
  catch(e){
    var m = String((e && e.message) || e);
    var n = mailLeft_();
    if(n === 0){
      m = 'きょう送れるメールの数を使い切りました（Gmail の1日の上限です）';
    }
    try{ Logger.log('メールを送れませんでした（' + what + '）： ' + m); }catch(x){}
    return what + '：' + m;
  }
}

/* ----------------------------------------------------------------
   小道具
   ---------------------------------------------------------------- */
function newId(){
  var c = 'abcdefghijkmnpqrstuvwxyz23456789';
  var s = '';
  for(var i=0;i<32;i++) s += c.charAt(Math.floor(Math.random()*c.length));
  return s;
}
function newPass(){
  var c = 'ABCDEFGHJKLMNPQRSTUVWXY3456789';
  var s = '';
  for(var i=0;i<6;i++) s += c.charAt(Math.floor(Math.random()*c.length));
  return s;
}
function nowStr(){
  return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
}
/* ★ v2.8）「回答」の表だけは、秒まで入れます。 */
function nowSec(){
  return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
}
function dayStr(d){
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy/MM/dd');
}
function jstr_(v){
  if(v === '' || v === null || v === undefined) return '';
  if(Object.prototype.toString.call(v) === '[object Date]'){
    return Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  }
  return String(v);
}
/* 年度（4月〜翌3月）。2026/09 なら 2026年度、2026/02 なら 2025年度 */
function fyOf(v){
  var d = (Object.prototype.toString.call(v) === '[object Date]') ? v : new Date(v);
  if(isNaN(d.getTime())) return 0;
  var y = Number(Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy'));
  var m = Number(Utilities.formatDate(d, 'Asia/Tokyo', 'MM'));
  return (m >= 4) ? y : (y - 1);
}
function thisFy(){ return fyOf(new Date()); }

/* 「何日たったか」を、日付だけで数えます（時刻は見ません）。 */
function midnight_(v){
  var d = (Object.prototype.toString.call(v) === '[object Date]') ? new Date(v) : new Date(v);
  if(isNaN(d.getTime())) return null;
  var ymd = String(Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy/MM/dd')).split('/');
  var t = new Date(Number(ymd[0]), Number(ymd[1]) - 1, Number(ymd[2])).getTime();
  return isNaN(t) ? null : t;
}
function daysBetween_(from, to){
  var a = midnight_(from), b = midnight_(to);
  if(a === null || b === null) return null;
  var n = Math.round((b - a) / 86400000);
  return isNaN(n) ? null : n;      /* 数えられないときは null（素通りさせない） */
}

function needAdmin(req){
  if(String(req.key||'') !== CFG.ADMIN_KEY) throw new Error('パスワードがちがいます');
}
function findRow(id){
  var s = listSheet();
  var last = s.getLastRow();
  if(last < 2) return null;
  var ids = s.getRange(2,1,last-1,1).getValues();
  for(var i=0;i<ids.length;i++){
    if(String(ids[i][0]) === String(id)) return i+2;
  }
  return null;
}
function rowObj(s, r){
  var n = Math.max(s.getLastColumn(), HEAD_LIST.length);
  var v = s.getRange(r, 1, 1, n).getValues()[0];
  var o = {};
  for(var i=0;i<HEAD_LIST.length;i++) o[HEAD_LIST[i]] = (i < v.length ? v[i] : '');
  o._row = r;
  return o;
}
/* ★ v2.11）書き込みがあったことの目印。 */
function bump_(){
  try{
    var pr = PropertiesService.getScriptProperties();
    var n = Number(pr.getProperty('rev') || 0);
    if(!(n >= 0)) n = 0;
    pr.setProperty('rev', String(n + 1));
  }catch(e){}
}
function rev_(){
  try{
    var pr = PropertiesService.getScriptProperties();
    var v = String(pr.getProperty('rev') || '');
    if(!v){ v = '1'; pr.setProperty('rev', v); }
    return v;
  }catch(e){ return ''; }
}
function lock(fn, quiet){
  var lk = LockService.getScriptLock();
  lk.waitLock(25000);
  try{ return fn(); }
  finally {
    if(quiet !== true){ try{ bump_(); }catch(e){} }   /* 順番待ちの中で進めます */
    lk.releaseLock();
  }
}

/* ★ v2.11）「何か変わりましたか」とだけ聞く、いちばん軽い窓口。 */
function apiPing(req){
  needAdmin(req);
  return { ok:true, rev: rev_() };
}

/* ================================================================
   ★ v2.14）送った内容（入居のしおり・室内チェック・重要事項）

   管理画面から parts（['guide','room','terms'] のうち選んだもの）が
   届きます。「送付内容」の列に残します。

   古い件には、この列がありません。そのときは「該当特約」のいちばん
   後ろに入っている『【送付内容】しおり・室内・重要事項』の行を見ます。
   それも無い、もっと古い件は、3つとも送ったものとして扱います。
   ================================================================ */
var PART_KEYS = ['guide', 'room', 'terms'];
var PART_TAG  = { guide:'しおり', room:'室内', terms:'重要事項' };
var PART_NAME = { guide:'入居のしおり', room:'室内チェック', terms:'重要事項' };

function partsOf_(o){
  var out = { guide:false, room:false, terms:false }, i, k;

  /* 1）「送付内容」の列 */
  var v = String((o && o['送付内容']) || '').trim();
  if(v){
    var ks = v.split(/[,、\s]+/);
    var any = false;
    for(i = 0; i < ks.length; i++){
      k = String(ks[i]).trim();
      if(out.hasOwnProperty(k)){ out[k] = true; any = true; }
    }
    if(any) return out;
  }

  /* 2）「該当特約」のいちばん後ろの【送付内容】…の行 */
  var cl = String((o && o['該当特約']) || '').split('\n');
  for(i = 0; i < cl.length; i++){
    if(String(cl[i]).indexOf('【送付内容】') !== 0) continue;
    var t = String(cl[i]);
    for(k in PART_TAG){
      if(PART_TAG.hasOwnProperty(k)) out[k] = (t.indexOf(PART_TAG[k]) >= 0);
    }
    return out;
  }

  /* 3）印が無い、これまでの分は、3つとも */
  return { guide:true, room:true, terms:true };
}
/* ['guide','room'] の形で返します（管理画面と入居者の画面へ渡します） */
function partsKeys_(o){
  var p = partsOf_(o), out = [];
  for(var i = 0; i < PART_KEYS.length; i++){
    if(p[PART_KEYS[i]]) out.push(PART_KEYS[i]);
  }
  return out;
}
/* 入居のしおりだけの件かどうか（ご返信をお待ちするものがありません） */
function guideOnly_(o){
  var p = partsOf_(o);
  return (p.guide && !p.room && !p.terms);
}

/* ================================================================
   ★ v2.9）だれが操作したか
   ================================================================ */
function who_(req){
  var w = String((req && req.who) || '').replace(/[\r\n\t]/g, ' ').trim();
  if(w.length > 20) w = w.slice(0, 20);
  return w;
}

/* 操作の記録を1行足します。lock の中から呼んでください。 */
function logAct_(s, r, o, what, who){
  var line = nowStr() + ' ｜ ' + String(what || '') + (who ? (' ｜ ' + who) : '');
  var cur = String(o['操作履歴'] || '');
  var arr = cur ? cur.split('\n') : [];
  arr.push(line);
  var max = Number(CFG.ACT_LOG_MAX || 30);
  if(arr.length > max) arr = arr.slice(arr.length - max);
  s.getRange(r, colOf('操作履歴')).setValue(arr.join('\n'));
  if(who) s.getRange(r, colOf('操作者')).setValue(who);
  o['操作履歴'] = arr.join('\n');
  if(who) o['操作者'] = who;
}

/* ================================================================
   ★ v2.9）ご返信の受付を閉じるか
   ================================================================ */
function closedDays_(o){
  var n = Number(CFG.CLOSE_INPUT_DAYS || 0);
  if(!(n > 0)) return null;                        /* 0 なら、ずっと受け付けます */
  var at = String(o['完了日'] || '').trim();
  if(!at) return null;                             /* まだ完了していません */
  var d = daysBetween_(at, new Date());
  if(d === null) return null;                      /* 日付が読めないときは、閉じません */
  return (d >= n) ? d : null;
}
function isClosed_(o){ return closedDays_(o) !== null; }
function closedMsg_(){
  var t = 'ご返信の受付は、終了いたしました。';
  if(String(CFG.CLOSE_TEL || '').trim()){
    t += 'お気づきの点は ' + String(CFG.CLOSE_TEL).trim() + ' までご連絡ください。';
  }else{
    t += 'お気づきの点は、' + CFG.COMPANY + ' までご連絡ください。';
  }
  return t;
}

/* ================================================================
   ★ v2.9）「回答」の表から、1件ぶんだけを速く読みます
   ================================================================ */
function ansRowsOf_(id){
  var a = ansSheet();
  var last = a.getLastRow();
  if(last < 2) return [];
  var ids = a.getRange(2, 1, last - 1, 1).getValues();   /* ← 1列だけ */
  var lo = -1, hi = -1;
  for(var i = 0; i < ids.length; i++){
    if(String(ids[i][0]) !== String(id)) continue;
    if(lo < 0) lo = i;
    hi = i;
  }
  if(lo < 0) return [];
  var v = a.getRange(2 + lo, 1, hi - lo + 1, HEAD_ANS.length).getValues();
  var out = [];
  for(var j = 0; j < v.length; j++){
    if(String(v[j][0]) === String(id)) out.push(v[j]);
  }
  return out;
}

/* エリアごとの通知先。空なら、これまでどおり TO_MAIL へ */
function mailFor(area){
  var a = String(area || '').trim();
  var m = '';
  try{ m = String((CFG.AREA_MAIL || {})[a] || '').trim(); }catch(e){ m = ''; }
  return m || CFG.TO_MAIL;
}

/* ----------------------------------------------------------------
   0) 管理画面が起動時に読む設定（エリアの一覧）
   ---------------------------------------------------------------- */
function apiConfig(req){
  needAdmin(req);
  return { ok:true, areas: CFG.AREAS || [], fy: thisFy(), mailLeft: mailLeft_() };
}

/* ----------------------------------------------------------------
   1) 新しいチェック依頼を作る（管理側）
   ---------------------------------------------------------------- */
function apiCreate(req){
  needAdmin(req);
  var bldg = String(req.bldg||'').trim();
  var room = String(req.room||'').trim();
  var name = String(req.name||'').trim();
  var mail = String(req.mail||'').trim();
  if(!bldg || !room || !name || !mail) throw new Error('物件名・号室・お名前・メールは必ず入れてください');

  var id   = newId();
  var pass = newPass();
  var planUrl = '';
  if(req.plan && req.plan.data){
    planUrl = saveFile(req.plan.data, req.plan.name || 'madori.jpg', id + '_間取り図');
  }
  var clauses = (req.clauses || []).join('\n');

  /* ★ v2.14）送る内容。届いていないときは、3つとも送ったものとします */
  var pk = [];
  for(var pi = 0; pi < PART_KEYS.length; pi++){
    if((req.parts || []).indexOf(PART_KEYS[pi]) >= 0) pk.push(PART_KEYS[pi]);
  }
  if(!pk.length) pk = PART_KEYS.slice();
  var parts = { guide:(pk.indexOf('guide')>=0), room:(pk.indexOf('room')>=0),
                terms:(pk.indexOf('terms')>=0) };
  /* 入居のしおりだけのときは、ご返信をお待ちするものがありません。
     送った時点で「完了」にし、督促もいたしません。 */
  var only = (parts.guide && !parts.room && !parts.terms);

  var row = [];
  row[colOf('ID')-1]           = id;
  row[colOf('作成日')-1]       = nowStr();
  row[colOf('物件名')-1]       = bldg;
  row[colOf('号室')-1]         = room;
  row[colOf('契約者名')-1]     = name;
  row[colOf('メール')-1]       = mail;
  row[colOf('入居日')-1]       = String(req.moveIn||'');
  row[colOf('該当特約')-1]     = clauses;
  row[colOf('間取り図')-1]     = planUrl;
  row[colOf('パスワード')-1]   = pass;
  row[colOf('状態')-1]         = only ? '完了' : '未返信';
  row[colOf('返信日')-1]       = '';
  row[colOf('問題あり件数')-1] = 0;
  row[colOf('督促回数')-1]     = 0;
  row[colOf('最終督促日')-1]   = '';
  row[colOf('メモ')-1]         = String(req.memo||'');
  row[colOf('エリア')-1]       = String(req.area||'');
  row[colOf('仲介会社')-1]     = String(req.agentCo||'');
  row[colOf('仲介担当')-1]     = String(req.agentName||'');
  row[colOf('仲介メール')-1]   = String(req.agentMail||'');
  row[colOf('未説明件数')-1]   = 0;
  row[colOf('完了日')-1]       = only ? nowStr() : '';
  row[colOf('アラート回数')-1]   = 0;
  row[colOf('最終アラート日')-1] = '';
  row[colOf('未確認件数')-1]     = 0;
  row[colOf('駐車場区画')-1]     = String(req.parking||'');
  row[colOf('ポストダイヤル')-1] = String(req.postDial||'');
  row[colOf('仲介連絡日')-1]     = '';
  row[colOf('仲介連絡回数')-1]   = 0;
  /* ★ v2.9）だれが作ったか */
  var mk = who_(req);
  row[colOf('完了理由')-1] = only ? 'しおりのみ：ご返信不要' : '';
  row[colOf('操作者')-1]   = mk;
  row[colOf('操作履歴')-1] = nowStr() + ' ｜ 依頼をつくった（' + partsLabel_(pk) + '）' +
                             (mk ? ('  ｜ ' + mk) : '');
  /* ★ v2.14）送った内容と、不達の印 */
  row[colOf('送付内容')-1] = pk.join(',');
  row[colOf('不達')-1]     = '';
  for(var i=0;i<HEAD_LIST.length;i++){ if(row[i] === undefined) row[i] = ''; }

  lock(function(){ listSheet().appendRow(row); });

  var warn = '';
  if(req.sendMail !== false){
    warn = trySend_('ご案内メール', function(){
      sendInvite({ id:id, pass:pass, bldg:bldg, room:room, name:name, mail:mail,
                   moveIn:req.moveIn,
                   parking:String(req.parking||''), postDial:String(req.postDial||''),
                   parts:parts });
    });
    if(warn){
      /* 送れなかったことを、この件に残します。 */
      lock(function(){
        var s2 = listSheet();
        var r2 = findRow(id);
        if(!r2) return;
        var o2 = rowObj(s2, r2);
        var memo = String(o2['メモ']||'');
        var add = '★ご案内メールを送れませんでした ' + nowStr() + '（' + warn + '）';
        s2.getRange(r2, colOf('メモ')).setValue(memo ? (memo + '\n' + add) : add);
        s2.getRange(r2, colOf('不達')).setValue(nowStr() + '　送信できませんでした');
        logAct_(s2, r2, o2, 'ご案内メールを送れなかった', mk);
      });
    }
  }
  return { ok:true, id:id, pass:pass, url:CFG.APP_URL + '?id=' + id,
           parts:pk, done:only,
           mailWarn:warn, mailLeft:mailLeft_() };
}

/* 「入居のしおり・室内チェック」の形にします（記録に残すため） */
function partsLabel_(keys){
  var t = [];
  for(var i = 0; i < PART_KEYS.length; i++){
    if((keys || []).indexOf(PART_KEYS[i]) >= 0) t.push(PART_NAME[PART_KEYS[i]]);
  }
  return t.length ? t.join('・') : 'なし';
}

function saveFile(dataUrl, fileName, prefix){
  var m = /^data:([^;]+);base64,(.*)$/.exec(String(dataUrl));
  if(!m) return '';
  var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], prefix + '_' + fileName);
  var f = photoFolder().createFile(blob);
  if(CFG.SHARE_EACH_FILE === true){
    try{ f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }catch(e){}
  }
  return f.getUrl();
}

/* ----------------------------------------------------------------
   ★ v2.14）宛先を直して、ご案内を送り直す

   管理画面の「宛先を直して送り直す」から届きます。
     { action:'resend', key, id, mail, who }

   ・パスワードとリンクは、これまでと同じものです（作り直しません）
   ・送れたときだけ、表の宛先を書き替え、不達の印を消します
   ---------------------------------------------------------------- */
function apiResend(req){
  needAdmin(req);
  var r = findRow(req.id);
  if(!r) throw new Error('見つかりません');
  var s = listSheet();
  var o = rowObj(s, r);

  var mail = String(req.mail || '').trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)){
    throw new Error('メールアドレスの形をご確認ください');
  }
  if(String(o['状態'] || '') === '取消') throw new Error('この依頼は取り消されています');
  if(mailLeft_() < 1){
    throw new Error('きょう送れるメールの数を使い切りました。あすお試しください。');
  }

  var old = String(o['メール'] || '').trim();
  var w   = who_(req);

  /* 先に送ります。送れなかったときは、宛先を書き替えません */
  var warn = trySend_('ご案内メール', function(){
    sendInvite({ id:String(o['ID']), pass:String(o['パスワード']),
                 bldg:String(o['物件名']), room:String(o['号室']),
                 name:String(o['契約者名']), mail:mail,
                 moveIn:String(o['入居日']||''),
                 parking:String(o['駐車場区画']||''),
                 postDial:String(o['ポストダイヤル']||''),
                 parts:partsOf_(o) });
  });
  if(warn) return { ok:false, err:warn, mailLeft:mailLeft_() };

  lock(function(){
    s.getRange(r, colOf('メール')).setValue(mail);
    s.getRange(r, colOf('不達')).setValue('');      /* 届かなかった印は消します */
    logAct_(s, r, o, '宛先を直して送り直した（' + (old || '（空）') + ' → ' + mail + '）', w);
  });

  return { ok:true, mail:mail, mailLeft:mailLeft_() };
}

/* ----------------------------------------------------------------
   2) 入居者が開く
   ---------------------------------------------------------------- */
function apiOpen(req){
  var r = findRow(req.id);
  if(!r) throw new Error('この番号のご案内が見つかりません');
  var o = rowObj(listSheet(), r);
  if(String(o['パスワード']) !== String(req.pass||'').toUpperCase().trim()){
    return { ok:false, err:'パスワードがちがいます' };
  }
  /* ★ v2.9）完了から日がたった件は、新しいご返信の受付を閉じます。 */
  var closed = isClosed_(o);

  return {
    ok:true,
    bldg:o['物件名'], room:o['号室'], name:o['契約者名'],
    moveIn:String(o['入居日']||''),
    clauses:String(o['該当特約']||'').split('\n').filter(String),
    parts:partsKeys_(o),                   /* ★ v2.14）お送りした内容 */
    plan:String(o['間取り図']||''),
    area:String(o['エリア']||''),
    parking :String(o['駐車場区画']||''),
    postDial:String(o['ポストダイヤル']||''),
    done:(String(o['状態']) === '返信済' || String(o['状態']) === '完了'),
    closed  : closed,
    closedMsg: closed ? closedMsg_() : '',
    draft   : closed ? null : draftGet_(req.id),
    due:dueDateOf(o)
  };
}

/* ================================================================
   ★ v2.9）入居者の「一時保存」
   ================================================================ */
function draftGet_(id){
  var d = draftSheet();
  var last = d.getLastRow();
  if(last < 2) return null;
  var ids = d.getRange(2, 1, last - 1, 1).getValues();
  for(var i = ids.length - 1; i >= 0; i--){       /* 新しいほうから探します */
    if(String(ids[i][0]) !== String(id)) continue;
    var v = d.getRange(2 + i, 1, 1, HEAD_DRAFT.length).getValues()[0];
    var body = null;
    try{ body = JSON.parse(String(v[2] || 'null')); }catch(e){ body = null; }
    if(!body) return null;
    return { at: jstr_(v[1]), data: body };
  }
  return null;
}
function draftRow_(id){
  var d = draftSheet();
  var last = d.getLastRow();
  if(last < 2) return 0;
  var ids = d.getRange(2, 1, last - 1, 1).getValues();
  for(var i = ids.length - 1; i >= 0; i--){
    if(String(ids[i][0]) === String(id)) return i + 2;
  }
  return 0;
}
function draftDrop_(id){
  var r = draftRow_(id);
  if(!r) return;
  draftSheet().getRange(r, 1, 1, HEAD_DRAFT.length).setValues([['', '', '']]);
}
/* 使い終わって空になっている行を、1つ探します（無ければ 0） */
function draftFree_(){
  var d = draftSheet();
  var last = d.getLastRow();
  if(last < 2) return 0;
  var ids = d.getRange(2, 1, last - 1, 1).getValues();
  for(var i = 0; i < ids.length; i++){
    if(String(ids[i][0] || '') === '') return i + 2;
  }
  return 0;
}

function apiDraftSave(req){
  var r = findRow(req.id);
  if(!r) throw new Error('この番号のご案内が見つかりません');
  var o = rowObj(listSheet(), r);
  if(String(o['パスワード']) !== String(req.pass||'').toUpperCase().trim()){
    return { ok:false, err:'パスワードがちがいます' };
  }
  if(isClosed_(o)) return { ok:false, err:closedMsg_() };

  var body = '';
  try{ body = JSON.stringify(req.data || {}); }catch(e){ body = ''; }
  if(!body || body === '{}') return { ok:false, err:'預かるものがありません' };
  if(body.length > 40000) return { ok:false, err:'入力が大きすぎます。写真は端末に残ります' };

  var at = nowStr();
  lock(function(){
    var d = draftSheet();
    var row = draftRow_(req.id) || draftFree_();
    if(row) d.getRange(row, 1, 1, HEAD_DRAFT.length).setValues([[req.id, at, body]]);
    else    d.appendRow([req.id, at, body]);
  }, true);          /* 一覧は変わらないので、目印は進めません */
  return { ok:true, at:at };
}

/* ★ v2.7）ご返信の期限は「契約開始日」から数えます。 */
function dueBase_(o){
  var v = String(o['入居日'] || '').trim();
  if(v){
    var d = new Date(v);
    if(!isNaN(d.getTime())) return d;
  }
  var c = new Date(o['作成日']);
  return isNaN(c.getTime()) ? null : c;
}
function dueDateOf(o){
  var d = dueBase_(o);
  if(!d) return '';
  d = new Date(d.getTime());
  d.setDate(d.getDate() + CFG.DUE_DAYS);
  return dayStr(d);
}

/* 次に自動督促が出る日。もう出ないときは '' を返します。 */
function remindNextOf(o){
  if(String(o['状態']) !== '未返信') return '';
  if(guideOnly_(o)) return '';                    /* ★ しおりだけの件は督促しません */
  if(String(o['不達'] || '')) return '';          /* ★ 届いていない件も送りません */
  if(Number(o['督促回数']||0) >= CFG.REMIND_MAX) return '';
  var due = dueDateOf(o);
  if(!due) return '';
  var d = new Date(due);
  if(isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + 1);                     /* 期限の翌日に出します */
  var lastR = String(o['最終督促日']||'');
  if(lastR){
    var ld = new Date(lastR);
    if(!isNaN(ld.getTime())){
      ld.setDate(ld.getDate() + CFG.REMIND_EVERY_DAYS);
      if(ld.getTime() > d.getTime()) d = ld;      /* 前の督促から中○日 */
    }
  }
  var today = new Date(); today.setHours(0,0,0,0);
  if(d.getTime() < today.getTime()) d = today;    /* すでに来ていれば「きょう」 */
  return dayStr(d);
}

/* ----------------------------------------------------------------
   3) 入居者が送信する
   ---------------------------------------------------------------- */
function apiSubmit(req){
  var r = findRow(req.id);
  if(!r) throw new Error('この番号のご案内が見つかりません');
  var s = listSheet();
  var o = rowObj(s, r);
  if(String(o['パスワード']) !== String(req.pass||'').toUpperCase().trim()){
    return { ok:false, err:'パスワードがちがいます' };
  }
  if(isClosed_(o)) return { ok:false, err:closedMsg_(), closed:true };
  var again   = (String(o['状態']) === '返信済' || String(o['状態']) === '完了');
  var wasDone = (String(o['状態']) === '完了');

  var rooms   = req.rooms   || [];   // [{place, ng, comment, photos:[dataURL]}]
  var checks  = req.checks  || [];   // [{title, ok, why, note}]
  var ngCount = 0, noExp = 0;

  var stamp = nowStr();
  var astamp = nowSec();

  var lines = [];
  for(var i=0;i<rooms.length;i++){
    var it = rooms[i];
    if(it.ng) ngCount++;
    var urls = [];
    var ph = it.photos || [];
    for(var j=0;j<ph.length && j<10;j++){
      var u = saveFile(ph[j], (i+1)+'-'+(j+1)+'.jpg', req.id);
      if(u) urls.push(u);
    }
    lines.push([req.id, astamp, '室内', String(it.place||''),
                it.ng ? '気になるところあり' : '問題なし',
                String(it.comment||''), urls.join('\n')]);
  }
  for(var k=0;k<checks.length;k++){
    var c = checks[k];
    var why = String(c.why || '').trim();
    var note = String(c.note || '').trim();
    var cm = '';
    if(!c.ok){
      cm = why || '（理由の記入なし）';
      if(note) cm += ' ／ ' + note;
      if(why === '説明を受けていない') noExp++;
    }
    lines.push([req.id, astamp, '説明の確認', String(c.title||''),
                c.ok ? '確認した' : '未確認', cm, '']);
  }

  var noOk = 0;
  for(var q=0;q<checks.length;q++){ if(!checks[q].ok) noOk++; }
  var clean = (ngCount === 0 && noOk === 0);
  /* ★ v2.14）入居のしおりだけの件は、はじめから完了です。
       ご返信をいただいても、そのまま完了のままにします。 */
  var autoDone = (clean && CFG.AUTO_DONE_WHEN_CLEAN === true) || guideOnly_(o);

  lock(function(){
    if(lines.length) ansSheet().getRange(ansSheet().getLastRow()+1, 1, lines.length, HEAD_ANS.length).setValues(lines);
    s.getRange(r, colOf('状態')).setValue(autoDone ? '完了' : '返信済');
    s.getRange(r, colOf('返信日')).setValue(stamp);
    s.getRange(r, colOf('問題あり件数')).setValue(ngCount);
    s.getRange(r, colOf('未説明件数')).setValue(noExp);
    s.getRange(r, colOf('未確認件数')).setValue(noOk);
    if(autoDone){
      s.getRange(r, colOf('完了日')).setValue(stamp);
      s.getRange(r, colOf('完了理由')).setValue(
        guideOnly_(o) ? 'しおりのみ：ご返信不要' : '自動：問題の報告なし');
    }else{
      s.getRange(r, colOf('完了理由')).setValue('');
    }
    logAct_(s, r, o, again ? (wasDone ? '入居者から再送信（完了後）' : '入居者から再送信')
                           : '入居者から返信', '');
    draftDrop_(req.id);   /* お預かりしていた下書きは、送信できたので片づけます */

    var adds = [];
    if(again)    adds.push((wasDone ? '完了後に再送信あり：' : '再送信あり：') + stamp);
    if(autoDone) adds.push('自動完了：' + (guideOnly_(o) ? 'しおりのみ ' : '問題の報告なし ') + stamp);
    if(adds.length){
      var memo = String(o['メモ']||'');
      s.getRange(r, colOf('メモ')).setValue(memo ? (memo + '\n' + adds.join('\n')) : adds.join('\n'));
    }
  });

  /* ★ v2.13）メールが送れなくても、ここで止めません。 */
  var warns = [];
  var w1 = trySend_('社内へのお知らせ', function(){
    sendResult(o, rooms, checks, ngCount, noExp, autoDone, again, wasDone);
  });
  if(w1) warns.push(w1);
  var w2 = trySend_('入居者様へのご案内', function(){
    sendGuide(o, String(req.guide || ''));
  });
  if(w2) warns.push(w2);

  if(warns.length){
    try{
      lock(function(){
        var s3 = listSheet();
        var r3 = findRow(req.id);
        if(!r3) return;
        var o3 = rowObj(s3, r3);
        var memo = String(o3['メモ']||'');
        var add = '★メールを送れませんでした ' + nowStr() + '（' + warns.join(' ／ ') + '）';
        s3.getRange(r3, colOf('メモ')).setValue(memo ? (memo + '\n' + add) : add);
        logAct_(s3, r3, o3, 'メールを送れなかった（ご返信は受け付けました）', '');
      });
    }catch(e){}
  }

  return { ok:true, ng:ngCount, done:autoDone,
           mailWarn: warns.join(' ／ '), mailLeft: mailLeft_() };
}

/* ----------------------------------------------------------------
   4) 一覧・集計（管理側）
   ---------------------------------------------------------------- */
function apiList(req){
  needAdmin(req);
  var s = listSheet();
  var last = s.getLastRow();
  var rows = [];
  var wantFy   = (req.fy === undefined || req.fy === null || req.fy === '') ? thisFy() : Number(req.fy);
  var wantArea = String(req.area || '');
  var fySet = {};
  if(last >= 2){
    var w = Math.max(s.getLastColumn(), HEAD_LIST.length);
    var v = s.getRange(2,1,last-1,w).getValues();
    for(var i=0;i<v.length;i++){
      var o = {};
      for(var c=0;c<HEAD_LIST.length;c++) o[HEAD_LIST[c]] = (c < v[i].length ? v[i][c] : '');
      var fy = fyOf(o['作成日']);
      if(fy) fySet[fy] = 1;
      if(wantFy && fy !== wantFy) continue;
      if(wantArea && String(o['エリア']||'') !== wantArea) continue;
      rows.push({
        id:o['ID'], created:jstr_(o['作成日']), bldg:o['物件名'], room:o['号室'],
        name:o['契約者名'], mail:o['メール'], status:o['状態'],
        replied:jstr_(o['返信日']), ng:Number(o['問題あり件数']||0),
        remind:Number(o['督促回数']||0), lastRemind:String(o['最終督促日']||''),
        due:dueDateOf(o), over:isOverdue(o), remindNext:remindNextOf(o),
        area:String(o['エリア']||''),
        agentCo:String(o['仲介会社']||''), agentName:String(o['仲介担当']||''),
        agentMail:String(o['仲介メール']||''),
        noExp:Number(o['未説明件数']||0),
        noCheck:Number(o['未確認件数']||0),
        agentAt:jstr_(o['仲介連絡日']),
        agentN:Number(o['仲介連絡回数']||0),
        agentRe:jstr_(o['仲介返信日']),        /* ★ 仲介からの回答 */
        agentAns:String(o['仲介可否']||''),
        agentMemo:String(o['仲介備考']||''),
        agentRm:jstr_(o['仲介督促日']),
        doneAt:jstr_(o['完了日']),
        alerted:Number(o['アラート回数']||0),
        doneWhy:String(o['完了理由']||''),      /* ★ v2.9）なぜ完了になったか */
        who    :String(o['操作者']||''),        /* ★ v2.9）最後に操作した人 */
        parts  :partsKeys_(o),                  /* ★ v2.14）お送りした内容 */
        bounce :jstr_(o['不達']),               /* ★ v2.14）届かなかった印 */
        fy:fy
      });
    }
  }
  rows.reverse();

  /* 3つのタブぶんの数を数えます */
  var st = { waiting:0, todo:0, agent:0, done:0, over:0, ng:0, noExp:0, noCheck:0, remind:0, month:0 };
  var ym = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM');
  for(var n=0;n<rows.length;n++){
    var x = rows[n];
    if(x.created.indexOf(ym) === 0) st.month++;
    st.remind += x.remind;
    if(x.status === '取消') continue;
    if(x.status === '完了'){ st.done++; }
    else if(x.status === '返信済'){
      if(x.noCheck > 0 && !x.agentAt) st.agent++; else st.todo++;
      if(x.ng > 0) st.ng++;
      if(x.noExp > 0) st.noExp++;
      if(x.noCheck > 0) st.noCheck++;
    }else{
      st.waiting++;
      if(x.over) st.over++;
    }
  }
  var fys = [];
  for(var f in fySet){ if(fySet.hasOwnProperty(f)) fys.push(Number(f)); }
  fys.sort(function(a,b){ return b-a; });

  return { ok:true, rows:rows, stat:st, fy:wantFy, fys:fys, areas:(CFG.AREAS||[]),
           remindMax:CFG.REMIND_MAX, remindEvery:CFG.REMIND_EVERY_DAYS,
           doneAfterRemind:(CFG.DONE_AFTER_AUTO_REMIND === true),
           rev:rev_(),            /* ★ v2.11）この一覧が、いつの分か */
           mailLeft:mailLeft_() };/* ★ v2.13）きょう、あと何通送れるか */
}

/* ----------------------------------------------------------------
   4-2) 1件の中身を返す（管理側）
   ---------------------------------------------------------------- */
function apiDetail(req){
  needAdmin(req);
  var r = findRow(req.id);
  if(!r) throw new Error('見つかりません');
  var o = rowObj(listSheet(), r);

  /* ★ v2.9）表をまるごと読むのをやめ、この1件の行だけを読みます */
  var v = ansRowsOf_(req.id);
  var rooms = [], checks = [], replies = 0;
  {
    var mine = [], newest = '', seen = {};
    for(var i=0;i<v.length;i++){
      var when = jstr_(v[i][1]);
      if(!seen[when]){ seen[when] = true; replies++; }
      if(when > newest) newest = when;
      mine.push({
        when : when,
        kind : String(v[i][2]||''),
        item : {
          when   : when,
          place  : String(v[i][3]||''),
          judge  : String(v[i][4]||''),
          comment: String(v[i][5]||''),
          photos : String(v[i][6]||'').split('\n').filter(String)
        }
      });
    }
    for(var m=0;m<mine.length;m++){
      if(mine[m].when !== newest) continue;
      if(mine[m].kind === '室内') rooms.push(mine[m].item); else checks.push(mine[m].item);
    }
  }

  return {
    ok:true,
    bldg   : o['物件名'],
    room   : o['号室'],
    name   : o['契約者名'],
    mail   : o['メール'],
    created: jstr_(o['作成日']),
    replied: jstr_(o['返信日']),
    status : String(o['状態']||''),
    pass   : String(o['パスワード']||''),
    plan   : String(o['間取り図']||''),
    memo   : String(o['メモ']||''),
    area   : String(o['エリア']||''),
    parking : String(o['駐車場区画']||''),
    postDial: String(o['ポストダイヤル']||''),
    agentCo: String(o['仲介会社']||''),
    agentName: String(o['仲介担当']||''),
    agentMail: String(o['仲介メール']||''),
    agentAt  : jstr_(o['仲介連絡日']),
    agentRe  : jstr_(o['仲介返信日']),
    agentAns : String(o['仲介可否']||''),
    agentMemo: String(o['仲介備考']||''),
    agentRm  : jstr_(o['仲介督促日']),
    noExp  : Number(o['未説明件数']||0),
    doneAt : jstr_(o['完了日']),
    doneWhy: String(o['完了理由']||''),                            /* ★ v2.9 */
    who    : String(o['操作者']||''),                              /* ★ v2.9 */
    acts   : String(o['操作履歴']||'').split('\n').filter(String), /* ★ v2.9 */
    closed : isClosed_(o),                                         /* ★ v2.9 */
    clauses: String(o['該当特約']||'').split('\n').filter(String),
    parts  : partsKeys_(o),                                        /* ★ v2.14 */
    bounce : jstr_(o['不達']),                                     /* ★ v2.14 */
    replies: replies,           /* 何回ご返信をいただいたか */
    rooms  : rooms,
    checks : checks
  };
}

function isOverdue(o){
  var st = String(o['状態']);
  if(st === '返信済' || st === '完了' || st === '取消') return false;
  var due = dueDateOf(o);
  if(!due) return false;
  var n = daysBetween_(due, new Date());   /* 期限日から何日たったか */
  return n !== null && n > 0;
}

function apiCancel(req){
  needAdmin(req);
  var r = findRow(req.id);
  if(!r) throw new Error('見つかりません');
  var s0 = listSheet();
  var o  = rowObj(s0, r);
  var w  = who_(req);
  lock(function(){
    s0.getRange(r, colOf('状態')).setValue('取消');
    logAct_(s0, r, o, '取り消した', w);
  });
  return { ok:true };
}

/* ================================================================
   ★ v2.12）1件を、まるごと消します
   ================================================================ */
function apiDrop(req){
  needAdmin(req);
  var r = findRow(req.id);
  if(!r) throw new Error('見つかりません');
  var s = listSheet();
  var o = rowObj(s, r);
  var w = who_(req);

  /* 先に、消す写真のアドレスを集めます（行を消すと読めなくなるためです） */
  var urls = [];
  var av = ansRowsOf_(req.id);
  for(var i = 0; i < av.length; i++){
    var ph = String(av[i][6] || '').split('\n');
    for(var j = 0; j < ph.length; j++){ if(ph[j]) urls.push(ph[j]); }
  }
  if(String(o['間取り図'] || '')) urls.push(String(o['間取り図']));

  var ansN = 0;
  lock(function(){
    /* 「回答」の行を消します。下から消します。 */
    var a = ansSheet();
    var last = a.getLastRow();
    if(last >= 2){
      var ids = a.getRange(2, 1, last - 1, 1).getValues();
      for(var k = ids.length - 1; k >= 0; k--){
        if(String(ids[k][0]) !== String(req.id)) continue;
        a.deleteRow(k + 2);
        ansN++;
      }
    }
    draftDrop_(req.id);
    /* 「一覧」の行は、いちばん最後に消します */
    s.deleteRow(r);
  });

  /* 写真は、ごみ箱に入れます。 */
  var fileN = 0;
  for(var u = 0; u < urls.length; u++){
    var id = fileIdOf_(urls[u]);
    if(!id) continue;
    try{
      var f = DriveApp.getFileById(id);
      if(!inPhotoFolder_(f)) continue;
      f.setTrashed(true);
      fileN++;
    }catch(e){}
  }

  Logger.log('まるごと消しました： ' + String(o['物件名']) + ' ' + String(o['号室']) +
             ' ／ ' + String(o['契約者名']) + ' ／ 回答 ' + ansN + '行 ／ 写真 ' + fileN + '枚' +
             (w ? ('　' + w) : ''));

  return { ok:true, id:req.id, ans:ansN, files:fileN,
           bldg:String(o['物件名']||''), room:String(o['号室']||''),
           name:String(o['契約者名']||'') };
}

/* ----------------------------------------------------------------
   ★ v2）完了にする／完了をとりけす
   ---------------------------------------------------------------- */
function apiDone(req){
  needAdmin(req);
  var r = findRow(req.id);
  if(!r) throw new Error('見つかりません');
  var back = (req.undo === true);
  var s0 = listSheet();
  var o  = rowObj(s0, r);
  var w  = who_(req);
  /* ★ v2.14）しおりだけの件は、理由を分けて残します
       （手で押したのではなく、はじめからご返信をお待ちしない件のためです） */
  var why = guideOnly_(o) ? 'しおりのみ：ご返信不要' : '手で完了';
  lock(function(){
    s0.getRange(r, colOf('状態')).setValue(back ? '返信済' : '完了');
    s0.getRange(r, colOf('完了日')).setValue(back ? '' : nowStr());
    s0.getRange(r, colOf('完了理由')).setValue(back ? '' : why);
    logAct_(s0, r, o, back ? '完了をとりけした' : '完了にした', w);
  });
  return { ok:true, doneWhy: back ? '' : why };
}

/* ----------------------------------------------------------------
   ★ v2）仲介業者へ連絡する
   ---------------------------------------------------------------- */
function apiAgentMail(req){
  needAdmin(req);
  var r = findRow(req.id);
  if(!r) throw new Error('見つかりません');
  var o = rowObj(listSheet(), r);
  o['仲介キー'] = agentKey_(r, o);          /* ★ 回答ページのリンクに使う鍵 */

  var to = String(req.to || o['仲介メール'] || '').trim();

  if(req.preview){
    var d = agentDraft(o, req.id);
    return { ok:true, to:to, subject:d.subject, body:d.body,
             agentCo:String(o['仲介会社']||''), agentName:String(o['仲介担当']||'') };
  }

  if(!to) throw new Error('仲介業者のメールアドレスが入っていません');
  var subject = String(req.subject || '').trim();
  var body    = String(req.body || '').trim();
  if(!subject || !body) throw new Error('件名と本文を入れてください');
  if(mailLeft_() < 2) throw new Error('きょう送れるメールの数を使い切りました。あすお試しください。');
  MailApp.sendEmail(to, subject, body, { cc: CFG.TO_MAIL });

  lock(function(){
    var s = listSheet();
    var memo = String(o['メモ']||'');
    var add = '仲介へ連絡 ' + nowStr() + '（' + to + '）';
    s.getRange(r, colOf('メモ')).setValue(memo ? (memo + '\n' + add) : add);
    s.getRange(r, colOf('仲介連絡日')).setValue(nowStr());
    s.getRange(r, colOf('仲介連絡回数')).setValue(Number(o['仲介連絡回数']||0) + 1);
    logAct_(s, r, o, '仲介へ連絡した（' + to + '）', who_(req));
  });
  return { ok:true };
}

/* ================================================================
   ★ 仲介業者からの回答（agent.html）
   ================================================================ */
var AGENT_ANS = ['対応完了', '契約キャンセル'];

/* 回答ページのリンクに使う鍵。まだ無ければ作って、表に残します */
function agentKey_(row, o){
  var k = String(o['仲介キー'] || '').trim();
  if(k) return k;
  k = newPass() + newPass();               /* 12文字 */
  lock(function(){ listSheet().getRange(row, colOf('仲介キー')).setValue(k); });
  return k;
}

function agentLink_(o){
  return CFG.APP_URL + 'agent.html?id=' + encodeURIComponent(o['ID']) +
         '&k=' + encodeURIComponent(String(o['仲介キー'] || ''));
}

/* リンクの鍵を確かめます。合わなければ、そこで止めます */
function agentRow_(req){
  var r = findRow(req.id);
  if(!r) throw new Error('見つかりません');
  var o = rowObj(listSheet(), r);
  var k = String(o['仲介キー'] || '').trim();
  if(!k || String(req.k || '') !== k){
    throw new Error('このページは開けません。メールに記載のリンクからお開きください。');
  }
  if(String(o['状態'] || '') === '取消') throw new Error('この依頼は取り消されています。');
  o._row = r;
  return o;
}

/* 仲介業者が画面を開いたとき */
function apiAgentOpen(req){
  var o = agentRow_(req);
  return {
    ok      : true,
    company : CFG.COMPANY,
    bldg    : String(o['物件名'] || ''),
    room    : String(o['号室'] || ''),
    name    : String(o['契約者名'] || ''),
    co      : String(o['仲介会社'] || ''),
    person  : String(o['仲介担当'] || ''),
    replied : jstr_(o['返信日']),
    items   : agentItemList_(req.id),
    choices : AGENT_ANS,
    answered: jstr_(o['仲介返信日']),
    ans     : String(o['仲介可否'] || ''),
    memo    : String(o['仲介備考'] || '')
  };
}

/* 仲介業者が送信したとき。 */
function apiAgentReply(req){
  var o   = agentRow_(req);
  var ans = String(req.ans || '').trim();
  if(AGENT_ANS.indexOf(ans) < 0) throw new Error('ご対応の結果をお選びください。');
  var memo = String(req.memo || '').trim();
  if(memo.length > 2000) memo = memo.slice(0, 2000);

  var again = !!String(o['仲介返信日'] || '');
  lock(function(){
    var s = listSheet();
    s.getRange(o._row, colOf('仲介返信日')).setValue(nowStr());
    s.getRange(o._row, colOf('仲介可否')).setValue(ans);
    s.getRange(o._row, colOf('仲介備考')).setValue(memo);
    var m   = String(o['メモ'] || '');
    var add = '仲介より連絡 ' + nowStr() + '（' + ans + '）' + (again ? '※送り直し' : '');
    s.getRange(o._row, colOf('メモ')).setValue(m ? (m + '\n' + add) : add);
    logAct_(s, o._row, o, '仲介から返事（' + ans + '）' + (again ? '※送り直し' : ''), '');
  });

  /* 弊社へお知らせします */
  try{
    var b = [];
    b.push('仲介業者より、ご対応の結果のご連絡が届きました。');
    b.push('');
    b.push('　物件　　： ' + o['物件名'] + ' ' + o['号室']);
    b.push('　入居者様： ' + o['契約者名'] + ' 様');
    b.push('　仲介　　： ' + String(o['仲介会社'] || '') + ' ' + String(o['仲介担当'] || ''));
    b.push('');
    b.push('　結果　　： ' + ans);
    b.push('　備考　　： ' + (memo || '（記入なし）'));
    b.push('');
    if(again) b.push('※ 送り直しです。前回の回答は、この内容に置き換わっています。');
    b.push('管理画面の「仲介から返事あり」に入っています。');
    MailApp.sendEmail(mailFor(o['エリア']),
      '【仲介より連絡】' + o['物件名'] + ' ' + o['号室'] + '（' + ans + '）', b.join('\n'));
  }catch(e){}

  return { ok:true, ans:ans, memo:memo, at:nowStr(), mailLeft:mailLeft_() };
}

/* 仲介へ連絡してから AGENT_REMIND_DAYS 日たっても回答が無いとき、
   1回だけ確認のメールを送ります（毎朝の dailyReminder から呼びます） */
function dailyAgentRemind(){
  var s = listSheet();
  var last = s.getLastRow();
  if(last < 2) return;
  var w = Math.max(s.getLastColumn(), HEAD_LIST.length);
  var v = s.getRange(2, 1, last - 1, w).getValues();
  for(var i = 0; i < v.length; i++){
    var o = {};
    for(var c = 0; c < HEAD_LIST.length; c++) o[HEAD_LIST[c]] = (c < v[i].length ? v[i][c] : '');
    o._row = i + 2;
    if(String(o['状態'] || '') === '取消') continue;
    if(!String(o['仲介連絡日'] || '')) continue;    /* まだ連絡していません */
    if(String(o['仲介返信日'] || '')) continue;     /* もう回答が来ています */
    if(String(o['仲介督促日'] || '')) continue;     /* 督促は1回だけです */
    var to = String(o['仲介メール'] || '').trim();
    if(!to) continue;                               /* 宛先が無ければ送れません */
    var n = daysBetween_(o['仲介連絡日'], new Date());
    if(n === null || n < CFG.AGENT_REMIND_DAYS) continue;
    if(mailLeft_() < 2){
      try{ Logger.log('きょうの送信枠が尽きたため、仲介への督促をここで止めます'); }catch(e){}
      break;
    }
    sendAgentRemind_(o, to, n);
    Utilities.sleep(400);
  }
}

function sendAgentRemind_(o, to, days){
  var atena = String(o['仲介会社'] || '');
  if(String(o['仲介担当'] || '')) atena += (atena ? '　' : '') + String(o['仲介担当']) + ' 様';
  else if(atena) atena += ' 御中';

  var b = [];
  b.push(atena || 'ご担当者 様');
  b.push('');
  b.push('いつも大変お世話になっております。' + CFG.COMPANY + 'でございます。');
  b.push('');
  b.push('先日ご連絡いたしました下記の件につきまして、');
  b.push('ご対応の結果のご連絡を、まだいただけておりません。');
  b.push('');
  b.push('　物件　　： ' + o['物件名'] + ' ' + o['号室']);
  b.push('　入居者様： ' + o['契約者名'] + ' 様');
  b.push('　ご連絡日： ' + jstr_(o['仲介連絡日']) + '（' + days + '日前）');
  b.push('');
  b.push('お手数をおかけいたしますが、下記のページよりお知らせください。');
  b.push('');
  b.push(agentLink_(o));
  b.push('');
  b.push('※ すでにご連絡いただいている場合は、行き違いですのでご容赦ください。');
  b.push('');
  b.push('--');
  b.push(CFG.COMPANY);

  MailApp.sendEmail(to,
    '【再度のお願い】' + o['物件名'] + ' ' + o['号室'] + '　ご対応の結果について',
    b.join('\n'), { cc: CFG.TO_MAIL });

  lock(function(){
    listSheet().getRange(o._row, colOf('仲介督促日')).setValue(nowStr());
  });
}

/* 印の付かなかった項目を、順番に取り出します。 */
function agentItemList_(id){
  var first = [], rest = [];
  var v = ansRowsOf_(id);
  {
    for(var i=0;i<v.length;i++){
      if(String(v[i][2]) !== '説明の確認') continue;
      if(String(v[i][4]) === '確認した') continue;
      var it = { t: String(v[i][3]||''), c: String(v[i][5]||'') };
      if(it.c.indexOf('説明を受けていない') === 0) first.push(it); else rest.push(it);
    }
  }
  return first.concat(rest);
}

function agentDraft(o, id){
  var list = agentItemList_(id);
  var items = list.map(function(x){
    var line = '　・' + x.t;
    if(x.c) line += '\n　　└ 入居者様のご回答：' + x.c;
    return line;
  });

  var atena = String(o['仲介会社']||'');
  if(String(o['仲介担当']||'')) atena += (atena ? '　' : '') + String(o['仲介担当']) + ' 様';
  else if(atena) atena += ' 御中';

  var t = [];
  t.push(atena || 'ご担当者 様');
  t.push('');
  t.push('いつも大変お世話になっております。' + CFG.COMPANY + 'でございます。');
  t.push('');
  t.push('このたびご契約いただきました下記のお部屋につきまして、');
  t.push('重要事項説明書に記載の下記項目について、入居者様よりご回答が届いております。');
  t.push('つきましては、ご対応をお願いいたします。');
  t.push('');
  t.push('　物件　　： ' + o['物件名'] + ' ' + o['号室']);
  t.push('　入居者様： ' + o['契約者名'] + ' 様');
  t.push('　ご回答日： ' + jstr_(o['返信日']));
  t.push('');
  if(items.length){
    t.push('■ 重要事項説明書の記載項目と、入居者様のご回答');
    t.push(items.join('\n'));
    t.push('');
    t.push('いずれも、ご契約時の重要事項説明書に記載のある項目でございます。');
    t.push('入居者様のご認識と記載内容に相違がある状態ですので、');
    t.push('恐れ入りますが、入居者様へ改めてご説明いただき、');
    t.push('ご対応の結果を弊社までご一報いただけますでしょうか。');
  }else{
    t.push('■ ご回答のあった項目はございませんでした。');
    t.push('');
    t.push('念のためご共有まで、ご連絡いたしました。');
  }
  t.push('');
  t.push('──────────────────────────────');
  t.push('入居者様へ改めてご説明いただき、ご納得いただけましたら、');
  t.push('下記のページより「対応完了」をお知らせください。');
  t.push('');
  t.push(agentLink_(o));
  t.push('');
  t.push('　・「対応完了」または「契約キャンセル」をお選びいただき、');
  t.push('　　送信ボタンを押すだけです');
  t.push('　・パスワードは不要です。このリンクからそのまま開けます');
  t.push('　・' + CFG.AGENT_REMIND_DAYS + '日を過ぎてもご回答がない場合は、');
  t.push('　　念のため一度だけ、確認のメールをお送りいたします');
  t.push('──────────────────────────────');
  t.push('');
  t.push('ご不明な点がございましたら、ご連絡ください。');
  t.push('');
  t.push('--');
  t.push(CFG.COMPANY);

  return {
    subject: '【ご対応のお願い】' + o['物件名'] + ' ' + o['号室'] +
             '　重要事項説明書の記載項目について',
    body: t.join('\n')
  };
}

/* ----------------------------------------------------------------
   5) 督促（手で押す／毎朝の自動）
   ---------------------------------------------------------------- */
function apiRemind(req){
  needAdmin(req);
  var r = findRow(req.id);
  if(!r) throw new Error('見つかりません');
  var o = rowObj(listSheet(), r);
  /* ★ v2.14）しおりだけの件には、督促をいたしません */
  if(guideOnly_(o)){
    throw new Error('この件は「入居のしおり」だけをお送りしています。ご返信をお待ちするものがないため、督促はいたしません。');
  }
  if(String(o['不達'] || '')){
    throw new Error('この件は、メールが届いていません。先に「宛先を直して送り直す」からお送りください。');
  }
  /* 手で押したときは、送れなければ、はっきりお伝えします */
  var n = mailLeft_();
  if(n === 0) throw new Error('きょう送れるメールの数を使い切りました。あすお試しください。');
  sendRemind(o, true, who_(req));
  return { ok:true, mailLeft:mailLeft_() };
}

function dailyReminder(){
  var s = listSheet();
  var last = s.getLastRow();
  if(last < 2) return;
  var w = Math.max(s.getLastColumn(), HEAD_LIST.length);
  var v = s.getRange(2,1,last-1,w).getValues();
  for(var i=0;i<v.length;i++){
    var o = {};
    for(var c=0;c<HEAD_LIST.length;c++) o[HEAD_LIST[c]] = (c < v[i].length ? v[i][c] : '');
    o._row = i+2;
    if(String(o['状態']) !== '未返信') continue;
    /* ★ v2.14）しおりだけの件と、メールが届かなかった件には送りません */
    if(guideOnly_(o)) continue;
    if(String(o['不達'] || '')) continue;
    if(!isOverdue(o)) continue;
    if(Number(o['督促回数']||0) >= CFG.REMIND_MAX) continue;
    var lastR = String(o['最終督促日']||'');
    if(lastR){
      var ld = new Date(lastR);
      if(!isNaN(ld.getTime())){
        var diff = (new Date().getTime() - ld.getTime())/86400000;
        if(diff < CFG.REMIND_EVERY_DAYS) continue;
      }
    }
    if(mailLeft_() === 0){
      try{ Logger.log('きょうの送信枠が尽きたため、自動督促をここで止めます'); }catch(e){}
      break;
    }
    sendRemind(o, false);
    Utilities.sleep(400);
  }
  /* ★ 仲介業者への督促も、あわせて見ます（1件につき1回だけ） */
  try{ dailyAgentRemind(); }catch(e){ Logger.log('仲介への督促に失敗: ' + e.message); }
}

/* ================================================================
   ★ v2.14）メールが届かなかったこと（不達）を、見つけます

   メールを送ったあと、宛先が見つからないときは、送信元の Gmail に
   「Address not found」のお知らせ（mailer-daemon から）が届きます。
   1時間ごとに、それを見にいきます。

   ・見つけたら「不達」の列に、日付と理由を入れます
   ・同じお知らせを何度も見ないよう、Gmail に名札を付けます
   ・「完了」になっている件も見ます（しおりだけの件も届いていないため）
   ・取り消した件は見ません

   ※ この関数を動かすには、Gmail を読む許可が要ります。
     setup を1回実行して「許可」してください。
   ================================================================ */
function checkBounces(){
  var lab = null;
  try{
    lab = GmailApp.getUserLabelByName(CFG.BOUNCE_LABEL) ||
          GmailApp.createLabel(CFG.BOUNCE_LABEL);
  }catch(e){
    Logger.log('Gmail を読めませんでした： ' + e.message);
    return 0;
  }

  var q = 'from:mailer-daemon newer_than:' + Number(CFG.BOUNCE_DAYS || 3) + 'd' +
          ' -label:' + CFG.BOUNCE_LABEL;
  var th = [];
  try{ th = GmailApp.search(q, 0, 30); }catch(e){ Logger.log('さがせませんでした： ' + e.message); return 0; }
  if(!th.length) return 0;

  /* いま出ている宛先を、まとめて読みます */
  var s = listSheet();
  var last = s.getLastRow();
  if(last < 2){
    for(var z = 0; z < th.length; z++){ try{ th[z].addLabel(lab); }catch(e){} }
    return 0;
  }
  var w = Math.max(s.getLastColumn(), HEAD_LIST.length);
  var v = s.getRange(2, 1, last - 1, w).getValues();
  var mc = colOf('メール') - 1, sc = colOf('状態') - 1, bc = colOf('不達') - 1;
  var want = [];
  for(var i = 0; i < v.length; i++){
    if(String(v[i][sc] || '') === '取消') continue;
    var m = String(v[i][mc] || '').trim().toLowerCase();
    if(!m) continue;
    want.push({ row:i + 2, mail:m, had:String(v[i][bc] || '') });
  }

  var hit = 0;
  for(var t = 0; t < th.length; t++){
    var body = '';
    try{
      var ms = th[t].getMessages();
      for(var k = 0; k < ms.length; k++){
        try{ body += '\n' + ms[k].getSubject(); }catch(e){}
        try{ body += '\n' + ms[k].getPlainBody(); }catch(e){}
      }
    }catch(e){}
    var low = body.toLowerCase();
    var why = bounceWhy_(body);
    for(var j = 0; j < want.length; j++){
      if(want[j].had) continue;                       /* もう印が付いています */
      if(low.indexOf(want[j].mail) < 0) continue;     /* この件の宛先ではありません */
      markBounce_(want[j].row, why);
      want[j].had = '1';
      hit++;
    }
    try{ th[t].addLabel(lab); }catch(e){}
  }
  if(hit) Logger.log('届かなかったメールを ' + hit + ' 件 見つけました');
  return hit;
}

/* お知らせの文から、届かなかった理由をひとことにします */
function bounceWhy_(body){
  var t = String(body || '');
  if(/address not found|550[ -]?5\.1\.1|does not exist|user unknown|no such user|recipient address rejected/i.test(t)){
    return 'アドレスが見つかりません';
  }
  if(/mailbox (is )?full|over quota|552/i.test(t)) return '相手のメールボックスがいっぱいです';
  if(/blocked|spam|policy|rejected/i.test(t))      return '受け取りを断られました';
  return '届きませんでした';
}

/* その1件に、届かなかった印を付けます */
function markBounce_(row, why){
  lock(function(){
    var s = listSheet();
    var o = rowObj(s, row);
    s.getRange(row, colOf('不達')).setValue(nowStr() + (why ? ('　' + why) : ''));
    var memo = String(o['メモ'] || '');
    var add  = '★メールが届きませんでした ' + nowStr() + (why ? ('（' + why + '）') : '');
    s.getRange(row, colOf('メモ')).setValue(memo ? (memo + '\n' + add) : add);
    logAct_(s, row, o, 'メールが届かなかった（' + (why || '理由不明') + '）', '');
  });
}

/* ----------------------------------------------------------------
   メール
   ---------------------------------------------------------------- */
function link(id){ return CFG.APP_URL + '?id=' + id; }

/* 契約開始日（無ければ、渡された日／それも無ければ今日）から DUE_DAYS 日後 */
function dueFrom_(base){
  var d = base ? new Date(base) : new Date();
  if(isNaN(d.getTime())) d = new Date();
  d.setDate(d.getDate() + CFG.DUE_DAYS);
  return dayStr(d);
}

/* 案内メールに入れる、お部屋のこと（無いものは、行ごと出しません） */
function roomInfo_(x){
  var t = [];
  var p = String(x.parking || '').trim();
  if(p && p !== 'なし') t.push('　駐車場の区画　　　　： ' + p);
  var d = String(x.postDial || '').trim();
  if(d) t.push('　集合ポストのダイヤル： ' + d);
  if(!t.length) return '';
  return '■ お部屋のこと\n' + t.join('\n') + '\n\n';
}

/* ★ v2.14）ご案内メールは、お送りした内容に合わせて変えます。
     ・入居のしおりだけ … ご返信のお願いも、期限も書きません
     ・室内チェックあり … お部屋の確認のお願いを書きます
     ・重要事項あり　　 … ご説明内容の確認のお願いを書きます
     駐車場・集合ポストのダイヤルは、しおりをお送りするときだけ入れます。 */
function sendInvite(x){
  var p = x.parts || { guide:true, room:true, terms:true };
  if(p.guide && !p.room && !p.terms) return sendInviteGuide_(x);

  /* 契約開始日が入っていれば、そこから7日。無ければ今日から7日 */
  var due = dueFrom_(String(x.moveIn||'').trim() || null);

  var ask = '';
  if(p.room && p.terms){
    ask = 'お部屋の中に、入居前からのキズ・汚れ・不具合が無いか\n' +
          'ご確認のうえ、下記のページよりお知らせください。\n' +
          'あわせて、ご契約時に不動産会社からご説明のあった内容のご確認もお願いいたします。\n\n';
  }else if(p.room){
    ask = 'お部屋の中に、入居前からのキズ・汚れ・不具合が無いか\n' +
          'ご確認のうえ、下記のページよりお知らせください。\n\n';
  }else{
    ask = 'ご契約時に不動産会社からご説明のあった内容を、\n' +
          '下記のページよりご確認ください。\n\n';
  }

  var keep = p.guide
    ? ('※ このメールは削除せず、保管してください。\n' +
       '　 上記のページより、駐車場の区画・集合ポストのダイヤル・ゴミの出し方などを\n' +
       '　 いつでもご確認いただけます。\n\n')
    : '※ このメールは削除せず、保管してください。\n\n';

  /* 「入居前からあったキズ」の話は、室内チェックをお送りするときだけ */
  var why = p.room
    ? 'このご連絡は、後日「聞いていない」「入居前からあったキズである」といった\n'
    : 'このご連絡は、後日「聞いていない」といった\n';

  var noreply = p.room
    ? ('・ご返信がない場合、入居前からのキズや汚れであっても、ご退去の際に\n' +
       '　ご負担をお願いすることがございます。\n')
    : ('・ご返信がない場合、後日の行き違いを防ぐため、改めてご連絡することがございます。\n');

  var body =
    x.name + ' 様\n\n' +
    'このたびは ' + x.bldg + ' ' + x.room + ' にご入居いただき、ありがとうございます。\n' +
    CFG.COMPANY + ' です。\n\n' +
    '■ ご返信の期限　' + due + '（' + CFG.DUE_DAYS + '日以内）\n\n' +
    ask +
    '▼ 入力ページ\n' + link(x.id) + '\n' +
    '\n' +                       /* ★ リンクと離します（コピーのときリンクを押してしまうため） */
    'パスワード： ' + x.pass + '\n\n' +
    (p.guide ? roomInfo_(x) : '') +
    keep +
    why +
    '行き違いを防ぐためのものです。お手数ですが、ご協力をお願いいたします。\n\n' +
    '■ ご返信がない場合について\n' +
    '・' + due + ' を過ぎてもご返信がない場合は、確認のメールをお送りします。\n' +
    noreply + '\n' +
    '--\n' + CFG.COMPANY + '\n';

  var subj = (p.room && p.terms) ? 'お部屋の確認と、ご説明内容の確認について'
           : p.room              ? 'お部屋の確認について'
           :                       'ご説明内容の確認について';
  MailApp.sendEmail(x.mail, '【ご入居のお願い】' + subj + '（' + due + 'まで）', body);
}

/* ★ v2.14）入居のしおりだけをお送りするとき。
     ご返信をお待ちするものがありませんので、お願いも期限も書きません。
     そのかわり、すぐお使いになる
     「駐車場の区画」と「集合ポストのダイヤル」を、いちばん上にお出しします。
     ゴミの出し方・暮らしのルールは、ページでご覧いただきます。 */
function sendInviteGuide_(x){
  var t = [];
  t.push(x.name + ' 様');
  t.push('');
  t.push('このたびは ' + x.bldg + ' ' + x.room + ' にご入居いただき、ありがとうございます。');
  t.push(CFG.COMPANY + ' です。');
  t.push('');

  var p = String(x.parking || '').trim();
  var d = String(x.postDial || '').trim();
  if(p && p !== 'なし'){
    t.push('■ 駐車場の区画');
    t.push('　　' + p);
    t.push('　　ご契約の区画以外には、駐車なさらないようお願いいたします。');
    t.push('');
  }
  if(d){
    t.push('■ 集合ポストのダイヤル');
    t.push('　　' + d);
    t.push('　　開かない場合は、数字にきちんと合わせてから、ゆっくりお回しください。');
    t.push('');
  }

  t.push('このほか、ゴミの出し方・暮らしのルールを「入居のしおり」に');
  t.push('まとめております。ご入居までに、下記のページをお読みください。');
  t.push('');
  t.push('▼ 入居のしおり');
  t.push(link(x.id));
  t.push('');
  t.push('パスワード： ' + x.pass);
  t.push('');
  t.push('※ このメールは削除せず、保管してください。');
  t.push('　 上記のページは、ご入居後もいつでもご覧いただけます。');
  t.push('');
  t.push('ご不明な点がございましたら、弊社までご連絡ください。');
  t.push('');
  t.push('--');
  t.push(CFG.COMPANY);

  MailApp.sendEmail(x.mail,
    '【ご入居のご案内】' + x.bldg + ' ' + x.room + '　駐車場・集合ポストについて',
    t.join('\n') + '\n');
}

function sendRemind(o, manual, who){
  var due = dueDateOf(o);
  var body =
    o['契約者名'] + ' 様\n\n' +
    CFG.COMPANY + ' です。\n' +
    o['物件名'] + ' ' + o['号室'] + ' につきまして、\n' +
    'お部屋の確認のご回答を、まだいただけておりません。\n' +
    'ご返信の期限は ' + due + ' でした。\n\n' +
    '▼ 入力ページ\n' + link(o['ID']) + '\n' +
    '\n' +                       /* ★ リンクと離します */
    'パスワード： ' + o['パスワード'] + '\n\n' +
    '5分程度で完了いたします。お手数ですが、ご協力をお願いいたします。\n\n' +
    'ご返信がない場合、入居前からのキズや汚れであっても、ご退去の際に\n' +
    'ご負担をお願いすることがございます。何とぞご協力をお願いいたします。\n\n' +
    '※ すでにご返信いただいている場合は、行き違いですのでご容赦ください。\n\n' +
    '--\n' + CFG.COMPANY + '\n';
  MailApp.sendEmail(o['メール'],
    '【再度のお願い】お部屋の確認のご回答について（期限 ' + due + '）', body);
  lock(function(){
    var s = listSheet();
    s.getRange(o._row, colOf('督促回数')).setValue(Number(o['督促回数']||0) + 1);
    s.getRange(o._row, colOf('最終督促日')).setValue(dayStr(new Date()));

    /* ★ v2.7）自動で送ったときは、そのまま「完了」にします。 */
    if(!manual && CFG.DONE_AFTER_AUTO_REMIND === true){
      s.getRange(o._row, colOf('状態')).setValue('完了');
      s.getRange(o._row, colOf('完了日')).setValue(nowStr());
      s.getRange(o._row, colOf('完了理由')).setValue('自動：督促のみ・返事なし');
      var memo = String(o['メモ']||'');
      var add  = '自動完了：督促メールを送りました ' + nowStr();
      s.getRange(o._row, colOf('メモ')).setValue(memo ? (memo + '\n' + add) : add);
    }
    logAct_(s, o._row, o, manual ? '督促メールを送った' : '自動で督促メールを送った',
            manual ? String(who || '') : '');
  });
}

/* ★ ご返信のあと、入居者へお送りする「お部屋のご案内」。 */
function guideLink_(o){
  return CFG.APP_URL + '?id=' + encodeURIComponent(o['ID']) +
         '&k=' + encodeURIComponent(o['パスワード']);
}
function sendGuide(o, guide){
  var mail = String(o['メール'] || '').trim();
  if(!mail) return;
  /* ★ v2.14）入居のしおりをお送りしていない方には、ご案内を送りません */
  if(!partsOf_(o).guide) return;
  var t = [];
  t.push(o['契約者名'] + ' 様');
  t.push('');
  t.push('お部屋のご確認、ありがとうございました。');
  t.push(CFG.COMPANY + ' です。');
  t.push('');
  t.push('お住まいの間に必要となる事項を、まとめてお送りいたします。');
  t.push('このメールは削除せず、保管してください。');
  t.push('');
  t.push('　物件： ' + o['物件名'] + ' ' + o['号室']);
  t.push('');
  t.push('----------------------------------------');
  t.push('');
  if(String(guide || '').trim()){
    t.push(guide);
  }else{
    t.push('（このお部屋のご案内は、現在ございません）');
    t.push('');
  }
  t.push('----------------------------------------');
  t.push('');
  t.push('▼ この内容は、下記のページでもいつでもご覧いただけます');
  t.push('　パスワードの入力は不要です。そのまま開きます。');
  t.push('');
  t.push(guideLink_(o));
  t.push('');
  t.push('　スマートフォンのホーム画面に追加しておくと、すぐに開けます。');
  t.push('');
  t.push('--');
  t.push(CFG.COMPANY);
  MailApp.sendEmail(mail, '【お部屋のご案内】' + o['物件名'] + ' ' + o['号室'], t.join('\n'));
}

function sendResult(o, rooms, checks, ngCount, noExp, autoDone, again, wasDone){
  var area = String(o['エリア']||'');
  var t = [];
  if(again){
    t.push(wasDone
      ? '※ この件は、いちど「完了」にしたあとで、入居者様から追加のご返信が届きました。'
      : '※ この件は、入居者様から二度目以降のご返信が届きました。');
    t.push('　 以前のご返信は表に残っています。管理画面には、今回のぶんを出しています。');
    t.push('');
  }
  t.push('■ ' + o['物件名'] + ' ' + o['号室'] + ' ／ ' + o['契約者名'] + ' 様');
  if(area) t.push('エリア： ' + area);
  t.push('お送りした内容： ' + partsLabel_(partsKeys_(o)));   /* ★ v2.14 */
  t.push('受信： ' + nowStr());
  t.push('気になるところ： ' + ngCount + ' 件');
  if(noExp > 0) t.push('★「説明を受けていない」： ' + noExp + ' 件（仲介業者へのご確認をおすすめします）');
  if(autoDone){
    t.push('');
    t.push('※ すべて問題なしのご回答でしたので、この件は自動で「完了」といたしました。');
    t.push('　 管理画面の「完了」タブに入っています。取り消すこともできます。');
  }else{
    t.push('');
    t.push('※ この件は「要対応」に入りました。ご確認のうえ、完了にしてください。');
  }
  t.push('');
  t.push('― 室内 ―');
  for(var i=0;i<rooms.length;i++){
    var r = rooms[i];
    t.push((r.ng ? '【要確認】' : '　問題なし　') + ' ' + r.place);
    if(r.ng){
      if(r.comment) t.push('    ' + String(r.comment).replace(/\n/g,'\n    '));
      t.push('    写真 ' + ((r.photos||[]).length) + ' 枚');
    }
  }
  if(!rooms.length) t.push('（室内チェックは、お送りしていません）');
  t.push('');
  t.push('― ご説明の確認 ―');
  var no = [];
  for(var k=0;k<checks.length;k++){
    if(checks[k].ok) continue;
    var one = '　・' + String(checks[k].title||'');
    var why = String(checks[k].why||'').trim();
    var note = String(checks[k].note||'').trim();
    if(why) one += '\n　　└ ' + why + (note ? ('／' + note) : '');
    else if(note) one += '\n　　└ ' + note;
    no.push(one);
  }
  t.push(no.length ? ('印の付いていない項目：\n' + no.join('\n')) : 'すべて確認済み');
  t.push('');
  if(String(o['仲介会社']||'') || String(o['仲介メール']||'')){
    t.push('仲介： ' + String(o['仲介会社']||'') + ' ' + String(o['仲介担当']||'') + ' ' + String(o['仲介メール']||''));
    t.push('');
  }
  t.push('※ 写真と明細はスプレッドシートをご覧ください。');

  var opt = {};
  try{
    var pu = String(o['間取り図'] || '');
    var mm = /[-\w]{25,}/.exec(pu);
    if(mm){ opt.attachments = [ DriveApp.getFileById(mm[0]).getBlob() ]; }
  }catch(e){}

  var subj = '【入居チェック' + (again ? (wasDone ? '・完了後の再送信' : '・再送信') : '') + '】' +
             (area ? '['+area+'] ' : '') +
             o['物件名'] + ' ' + o['号室'] +
             '（' + (ngCount>0 ? '要確認 '+ngCount+'件' : '問題なし') +
             (noExp>0 ? ' ／ 未説明 '+noExp+'件' : '') +
             (autoDone ? ' ／ 自動完了' : '') + '）';
  MailApp.sendEmail(mailFor(area), subj, t.join('\n'), opt);
}

/* ----------------------------------------------------------------
   最初に1回だけ実行してください（表と、毎朝・毎時のトリガーを用意します）
   貼り替えたあとも、1回だけ実行しておくと
   ・足りない列（送付内容・不達）が足されます
   ・1時間ごとに不達をしらべる仕掛けが用意されます
   ・そのとき Gmail を読む許可を求められます。「許可」してください
   ---------------------------------------------------------------- */
function setup(){
  listSheet(); ansSheet(); draftSheet(); photoFolder();
  /* ★ v2.9）写真を公開しない設定のときは、置き場も非公開に戻しておきます */
  if(CFG.PHOTO_PUBLIC !== true){
    try{ 写真の共有をやめる(); }catch(e){ Logger.log('写真の共有を閉じられませんでした: ' + e.message); }
  }
  var ts = ScriptApp.getProjectTriggers();
  for(var i=0;i<ts.length;i++){
    var fn = ts[i].getHandlerFunction();
    if(fn === 'dailyReminder' || fn === 'checkBounces') ScriptApp.deleteTrigger(ts[i]);
  }
  ScriptApp.newTrigger('dailyReminder').timeBased().atHour(9).everyDays(1).create();
  /* ★ v2.14）1時間ごとに、届かなかったメールをしらべます */
  ScriptApp.newTrigger('checkBounces').timeBased().everyHours(1).create();
  /* Gmail の許可を、ここで一度もらっておきます */
  try{ GmailApp.getUserLabelByName(CFG.BOUNCE_LABEL) || GmailApp.createLabel(CFG.BOUNCE_LABEL); }
  catch(e){ Logger.log('Gmail の名札を作れませんでした: ' + e.message); }
  return '用意ができました。毎朝9時に督促を確認し、1時間ごとに'
       + '届かなかったメールをしらべます。'
       + (CFG.PHOTO_PUBLIC !== true ? '写真の置き場は非公開にしました。' : '');
}

/* ================================================================
★ ご返信を、ほんとうにいただいたか（2026/9/17）

これまでは「状態が 完了 なら、返信ずみ」としていました。

ところが、自動の督促メールを送ると、その瞬間に 完了 になります
（CFG.DONE_AFTER_AUTO_REMIND）。返事は、まだ1度も来ていません。

そのため入居者の画面が
「すでにご返信をいただいております」
と出てしまい、督促メールの文面と食い違っていました。

① 督促メールが届く 「回答をまだいただけておりません」
② 同じ瞬間に 状態＝完了
③ 入居者がリンクを開く
④ 画面「すでにご返信をいただいております」

偶然ではなく、自動の督促を送るたび、必ずこうなっていました。

完了理由に『自動：督促のみ・返事なし』と残してあります。
これを見れば、返信ずみかどうか、はっきり分かります。

★ v2.14）入居のしおりだけの件も、はじめから「完了」です。
   完了理由に『しおりのみ：ご返信不要』と残していますので、
   ここでも「返信ずみ」とは数えません。
================================================================ */
function hasReplied_(o){
  var st = String((o && o['状態']) || '');
  if(st === '返信済') return true;
  if(st === '完了'){
    /* 返事をいただかないまま完了にした件は、返信ずみではありません */
    if(/督促のみ|返事なし|ご返信不要/.test(String((o && o['完了理由']) || ''))) return false;
    return true;
  }
  return false;
}
