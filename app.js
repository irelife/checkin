/* =====================================================================
   入居時チェック アプリ ｜ 入居者の画面

   ・?id=…… で、その方だけのご案内を開きます
   ・パスワード（6文字）を入れると中身が出ます
   ・書きかけは、その端末の中に自動で残ります（送信すると消えます）
   ・写真は送る前に小さくします（通信量と、サーバーの負担を減らすため）
   ===================================================================== */
(function(){
  'use strict';

  var CFG = window.APP_CONFIG || {};
  var ID  = (location.search.match(/[?&]id=([^&]+)/) || [])[1] || '';
  var PASS = '';
  var DATA = null;               // サーバーから受け取ったご案内

  /* 暮らしのルールの文。ゴミの回収の回数だけ、エリアによって差し替えます。
     エリアが分からないとき・回数が決まっていないときは、
     回数を書かずに「市区町村のきまりによります」と出します。 */
  function manners(){
    var area = String((DATA || {}).area || '');
    var n    = String((window.TRASH || {})[area] || '');
    var t    = n ? ('回収は' + n + 'です')
                 : '回収の曜日と回数は、お住まいの市区町村のきまりによります';
    return (window.MANNERS || []).map(function(m){
      return String(m).split('{ゴミ回収}').join(t);
    });
  }
  var step = 1;
  var rooms = {};                // { 場所: {ng:bool, comment:'', photos:[dataURL]} }
  var whys  = {};                // { 特約のタイトル: {why:'…', note:'…'} } 印を付けなかった理由
  var checks = {};               // { 見出し: true }
  var KEY = 'ire_checkin_' + ID; // 書きかけの置き場所

  var MAXPHOTO = 10;   /* 1か所あたりの写真の上限 */

  /* 印を付けなかったときに選んでもらう理由。
     「読んでいない」のか「聞いていない」のか「分からない」のかで、
     こちらのやることが変わるためです。 */
  var WHYS = [
    '説明を受けていない',
    '説明は受けたが、意味が分からなかった',
    '内容に納得できない'
  ];

  /* ご質問のあて先のご案内。
     このページは「お部屋の確認」と「ご説明の確認」だけを受け取る場所です。
     それ以外のご質問をここに書かれても、こちらでは受けられないため、
     はじめに、はっきりお伝えしておきます。 */
  function askHtml(){
    var hp = '';
    try{ hp = String((window.APP_CONFIG||{}).HP_URL || '').trim(); }catch(e){}
    return '<b>ご質問・ご要望について</b>' +
      '<p>このページでお受けしているのは、<b>お部屋の状態の確認</b>と' +
      '<b>ご契約時のご説明内容の確認</b>の、2つだけです。<br>' +
      'それ以外のご質問・ご要望につきましては、このページではお答えいたしかねます。<br>' +
      'お手数ですが、弊社ホームページの<b>お問い合わせ</b>よりご連絡くださいますよう、' +
      'くれぐれもよろしくお願いいたします。</p>' +
      (hp ? ('<a class="hp" href="' + esc(hp) + '" target="_blank" rel="noopener">' +
             (/contact|inquiry|toiawase|form/i.test(hp)
                ? 'お問い合わせページをひらく'
                : '弊社ホームページをひらく') + '</a>') : '');
  }

  function $(s){ return document.querySelector(s); }
  function $$(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  /* ---------- サーバーとのやりとり ---------- */
  function post(body){
    return fetch(CFG.GAS_URL, {
      method:'POST',
      /* text/plain にすると、よけいな事前確認（プリフライト）が飛ばず、
         そのぶん速く・確実につながります */
      headers:{ 'Content-Type':'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function(r){ return r.json(); });
  }

  /* ---------- 書きかけの保存・復元 ---------- */
  /* 書きかけを、この端末に残します。
     写真は1枚で100KB以上あるので、端末の置き場（およそ5MB）がいっぱいになることがあります。
     いっぱいのときは、写真を外して「選んだ内容と書いた文章」だけでも必ず残します。 */
  function save(){
    var body = { rooms:rooms, checks:checks, whys:whys, step:step };
    try{
      localStorage.setItem(KEY, JSON.stringify(body));
      return;
    }catch(e){}
    try{
      var slim = { rooms:{}, checks:checks, whys:whys, step:step, noPhoto:true }, k;
      for(k in rooms){
        if(!Object.prototype.hasOwnProperty.call(rooms, k)) continue;
        slim.rooms[k] = { ng:rooms[k].ng, comment:rooms[k].comment || '', photos:[] };
      }
      localStorage.setItem(KEY, JSON.stringify(slim));
      try{ console.warn('[checkin] 端末がいっぱいのため、写真ぬきで控えました'); }catch(x){}
    }catch(e){
      try{ localStorage.removeItem(KEY); }catch(x){}
    }
  }
  function load(){
    try{
      var v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if(v){ rooms = v.rooms || {}; checks = v.checks || {}; whys = v.whys || {}; }
    }catch(e){}
  }
  function clear(){ try{ localStorage.removeItem(KEY); }catch(e){} }

  /* ---------- パスワード ---------- */
  function openIt(){
    var p = String($('#pw').value || '').toUpperCase().trim();
    if(p.length < 4){ $('#pw-err').textContent = 'パスワードを入れてください。'; return; }
    $('#pw-err').textContent = '';
    veil('確認しています…');
    post({ action:'open', id:ID, pass:p }).then(function(res){
      veil(false);
      if(!res.ok){ $('#pw-err').textContent = res.err || '開けませんでした。'; return; }
      PASS = p; DATA = res;
      if(res.done){ showDone('すでにご返信いただいています。ありがとうございました。'); return; }
      load();
      build();
      go(1);
    }).catch(function(){
      veil(false);
      $('#pw-err').textContent = '通信できませんでした。電波の良いところでもう一度お試しください。';
    });
  }

  /* ---------- 画面を組み立てる ---------- */
  function build(){
    $('#h-bldg').textContent = (DATA.bldg || '') + ' ' + (DATA.room || '');
    $('#h-sub').textContent  = (DATA.name || '') + ' 様' + (DATA.due ? '　／　' + DATA.due + ' までにご返信ください' : '');
    /* 期限を、注意書きの中にも入れます（上のバーは小さく、見落とされるため） */
    try{
      var dn = $('#due-note');
      if(dn && DATA.due){
        dn.insertAdjacentHTML('afterbegin',
          '<b style="display:inline;font-size:15px;">' + esc(DATA.due) + ' まで</b>にご返信ください。<br>');
      }
    }catch(e){}

    /* 間取り図
       ドライブが返す URL は「閲覧ページ」のもので、そのままでは画像として
       読めません（画像が壊れた印になります）。ファイル番号を取り出して、
       画像として出せるアドレスに作り直します。 */
    if(DATA.plan){
      var big = driveImg(DATA.plan, 1600);
      $('#plan').innerHTML =
        '<img src="' + esc(driveImg(DATA.plan, 1000)) + '" alt="間取り図">' +
        '<div class="plan-cap">間取り図（タップで大きく表示）</div>';
      var pim = $('#plan img');
      pim.addEventListener('click', function(){ zoom(big); });
      /* もし読めなかったときは、壊れた印を出さずに、開くリンクにします */
      pim.addEventListener('error', function(){
        $('#plan').innerHTML =
          '<a class="plan-link" href="' + esc(DATA.plan) + '" target="_blank" rel="noopener">' +
          '間取り図をひらく</a>';
      });
    }

    /* 場所ごとのカード */
    var places = window.PLACES || [];
    $('#places').innerHTML = places.map(function(p, i){
      var cur = rooms[p] || {};
      return '<div class="place' + (cur.ng ? ' is-ng' : '') + '" data-p="' + esc(p) + '">' +
        '<div class="place-h">' + esc(p) + '</div>' +
        '<div class="pick">' +
          '<label><input type="radio" name="r' + i + '" value="ok"' + (cur.ng===false?' checked':'') + '><span>問題なし</span></label>' +
          '<label class="ng"><input type="radio" name="r' + i + '" value="ng"' + (cur.ng===true?' checked':'') + '><span>気になる</span></label>' +
        '</div>' +
        '<div class="detail' + (cur.ng ? '' : ' hide') + '">' +
          '<textarea placeholder="どこが、どんな状態か教えてください（例：北側の壁に10cmほどのキズ）">' + esc(cur.comment||'') + '</textarea>' +
          '<div class="shots"></div>' +
        '</div>' +
      '</div>';
    }).join('');
    $$('#places .place').forEach(bindPlace);

    /* 確認事項 */
    var all = window.CLAUSES || [];
    var mine = (DATA.clauses && DATA.clauses.length)
      ? all.filter(function(c){ return DATA.clauses.indexOf(c.t) >= 0; })
      : [];
    if(!mine.length) mine = all;   // 指定が無いときは、ぜんぶ出します

    /* 特約の一覧に無いものは「この物件について」として、そのまま出します。
       管理画面で「個別に伝えたいこと」に書いた文が、ここに来ます。 */
    var known = {}, extra = [];
    all.forEach(function(c){ known[c.t] = 1; });
    (DATA.clauses || []).forEach(function(t){
      if(!known[t] && String(t).trim()) extra.push({ t:t, b:'', money:false, extra:true });
    });
    $('#cl-money').innerHTML = mine.filter(function(c){ return c.money; }).map(clHtml).join('')
      || '<p class="note">該当なし</p>';
    $('#cl-other').innerHTML =
      (extra.length ? '<p class="note" style="margin:2px 0 6px">この物件・お部屋について</p>' + extra.map(clHtml).join('') : '') +
      (mine.filter(function(c){ return !c.money; }).map(clHtml).join('')
        || (extra.length ? '' : '<p class="note">該当なし</p>'));
    $('#manners').innerHTML = manners().map(function(m){
      return '<label class="chk mn' + (checks[m] ? ' on' : '') + '" data-t="' + esc(m) + '">' +
        '<input type="checkbox"' + (checks[m]?' checked':'') + '>' +
        '<div class="chk-h"><i class="box"></i><div class="chk-t">' + esc(m) + '</div></div></label>';
    }).join('');
    $$('.clwrap').forEach(bindClause);      /* 特約（理由つき） */
    $$('#manners .chk').forEach(bindChk);   /* 暮らしのルール（理由なし） */
  }

  var _clSeq = 0;
  function clHtml(c){
    var nm = 'w' + (++_clSeq);
    var w  = whys[c.t] || {};
    var on = !!checks[c.t];
    return '<div class="clwrap" data-t="' + esc(c.t) + '">' +
      '<label class="chk' + (on ? ' on' : '') + '" data-t="' + esc(c.t) + '">' +
        '<input type="checkbox"' + (on?' checked':'') + '>' +
        '<div class="chk-h"><i class="box"></i><div class="chk-t">' + esc(c.t) +
          (c.money ? '<span class="tag money">お金</span>' : '') + '</div></div>' +
        (c.b ? ('<div class="chk-b">' + esc(c.b) + '</div>') : '') +
      '</label>' +
      '<div class="why' + (on ? ' hide' : '') + '">' +
        '<div class="why-q">印を付けなかった理由を、教えてください</div>' +
        WHYS.map(function(t){
          var sel = (w.why === t);
          return '<label class="whyr' + (sel ? ' on' : '') + '">' +
            '<input type="radio" name="' + nm + '" value="' + esc(t) + '"' + (sel?' checked':'') + '>' +
            '<span>' + esc(t) + '</span></label>';
        }).join('') +
        '<textarea class="why-n" placeholder="ひとこと（任意）">' + esc(w.note || '') + '</textarea>' +
      '</div>' +
    '</div>';
  }

  /* 特約1件ぶんの動き（印の付け外しと、理由の記録） */
  function bindClause(wrap){
    var t   = wrap.getAttribute('data-t');
    var lab = wrap.querySelector('.chk');
    var why = wrap.querySelector('.why');
    lab.addEventListener('click', function(e){
      if(e.target.tagName === 'A') return;
      var inp = lab.querySelector('input');
      inp.checked = !inp.checked;
      lab.classList.toggle('on', inp.checked);
      checks[t] = inp.checked;
      if(why) why.classList.toggle('hide', inp.checked);
      save(); progress();
    });
    if(!why) return;
    why.querySelectorAll('input[type=radio]').forEach(function(r){
      r.addEventListener('change', function(){
        if(!whys[t]) whys[t] = {};
        whys[t].why = r.value;
        why.querySelectorAll('.whyr').forEach(function(l){
          l.classList.toggle('on', l.querySelector('input').checked);
        });
        save();
      });
    });
    var ta = why.querySelector('.why-n');
    if(ta) ta.addEventListener('input', function(){
      if(!whys[t]) whys[t] = {};
      whys[t].note = ta.value;
      save();
    });
  }

  function bindChk(el){
    el.addEventListener('click', function(e){
      if(e.target.tagName === 'A') return;
      var inp = el.querySelector('input');
      inp.checked = !inp.checked;
      el.classList.toggle('on', inp.checked);
      checks[el.getAttribute('data-t')] = inp.checked;
      save(); progress();
    });
  }

  function bindPlace(el){
    var place = el.getAttribute('data-p');
    if(!rooms[place]) rooms[place] = { ng:null, comment:'', photos:[] };
    var st = rooms[place];
    var detail = el.querySelector('.detail');
    var ta = el.querySelector('textarea');

    el.querySelectorAll('input[type=radio]').forEach(function(r){
      r.addEventListener('change', function(){
        st.ng = (r.value === 'ng');
        el.classList.toggle('is-ng', st.ng);
        detail.classList.toggle('hide', !st.ng);
        save(); progress();
      });
    });
    ta.addEventListener('input', function(){ st.comment = ta.value; save(); });

    drawShots();
    function drawShots(){
      var box = el.querySelector('.shots');
      box.innerHTML = st.photos.map(function(src, i){
        return '<div class="shot"><img src="' + src + '" alt=""><button type="button" data-i="' + i + '">×</button></div>';
      }).join('') +
      (st.photos.length < MAXPHOTO
        ? '<div class="addshot"><b>＋</b>写真</div>'
        : '<div class="note" style="font-size:12px;color:#777;padding:6px 2px">写真は' + MAXPHOTO + '枚までです</div>');
      box.querySelectorAll('.shot button').forEach(function(b){
        b.addEventListener('click', function(ev){
          ev.stopPropagation();
          st.photos.splice(Number(b.getAttribute('data-i')), 1);
          save(); drawShots();
        });
      });
      box.querySelectorAll('.shot img').forEach(function(im){
        im.addEventListener('click', function(){ zoom(im.src); });
      });
      var add = box.querySelector('.addshot');
      if(add) add.addEventListener('click', pickPhoto);
    }
    function pickPhoto(){
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
      inp.addEventListener('change', function(){
        var files = Array.prototype.slice.call(inp.files || []);
        var left = MAXPHOTO - st.photos.length;
        files.slice(0, left).reduce(function(chain, f){
          return chain.then(function(){
            return shrink(f).then(function(d){ if(d) st.photos.push(d); });
          });
        }, Promise.resolve()).then(function(){ save(); drawShots(); });
      });
      inp.click();
    }
  }

  /* 写真を小さくします（長辺1000px・JPEG）。
     そのまま送ると1枚で数MBあり、電波の弱いところで送信に何十秒もかかるためです。
     いちど作ってみて、まだ重いときは、もう一段だけ軽くします。
     （傷の確認には十分な大きさです） */
  function shrink(file){
    return new Promise(function(done){
      var fr = new FileReader();
      fr.onload = function(){
        var im = new Image();
        im.onload = function(){
          var M = 1000, w = im.width, h = im.height;
          if(w > M || h > M){ var s = M/Math.max(w,h); w = Math.round(w*s); h = Math.round(h*s); }
          var cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(im, 0, 0, w, h);
          var d = cv.toDataURL('image/jpeg', 0.60);
          if(d.length > 240000) d = cv.toDataURL('image/jpeg', 0.45);
          if(d.length > 240000) d = cv.toDataURL('image/jpeg', 0.35);
          done(d);
        };
        im.onerror = function(){ done(''); };
        im.src = fr.result;
      };
      fr.onerror = function(){ done(''); };
      fr.readAsDataURL(file);
    });
  }

  /* ---------- 進みぐあい ---------- */
  function progress(){
    var places = window.PLACES || [];
    var doneP = places.filter(function(p){ return rooms[p] && rooms[p].ng !== null; }).length;
    var total = places.length;
    var pct = total ? Math.round(doneP / total * 100) : 0;
    if(step === 2) pct = 100;
    if(step === 3) pct = 100;
    $('#bar').style.width = (step === 1 ? pct : 100) + '%';
    var okAll = (doneP === total);

    /* 暮らしのルールは、全部に印が付くまで先へ進めません。 */
    var mn = manners();
    var mnLeft = mn.filter(function(m){ return !checks[m]; }).length;

    $('#next').disabled = (step === 1 && !okAll) || (step === 2 && mnLeft > 0);
    $('#next').textContent = (step === 1)
      ? (okAll ? 'つぎへ（ご説明の確認）' : '残り ' + (total - doneP) + 'か所')
      : (step === 2
          ? (mnLeft > 0 ? '暮らしのルール が残り ' + mnLeft + ' 件' : '確認')
          : '送信する');
  }

  /* ---------- 画面の切り替え ---------- */
  function go(n){
    step = n;
    $('#s-pw').classList.add('hide');
    ['#s1','#s2','#s3'].forEach(function(s,i){ $(s).classList.toggle('hide', i !== n-1); });
    $('#foot').classList.remove('hide');
    $('#back').classList.toggle('hide', n === 1);
    $$('#steps span').forEach(function(sp){ sp.classList.toggle('on', Number(sp.getAttribute('data-s')) === n); });
    if(n === 3){ drawSum(); $('#ask3').innerHTML = askHtml(); }
    window.scrollTo(0,0);
    save(); progress();
  }

  function drawSum(){
    var places = window.PLACES || [];
    var ng = places.filter(function(p){ return rooms[p] && rooms[p].ng; });
    var all = (window.CLAUSES||[]).concat(manners().map(function(m){ return {t:m}; }));
    var mine = all.filter(function(c){ return checks.hasOwnProperty(c.t) || true; });
    var shown = $$('.chk').map(function(e){ return e.getAttribute('data-t'); });
    var noChk = shown.filter(function(t){ return !checks[t]; });
    var photos = 0;
    places.forEach(function(p){ if(rooms[p]) photos += (rooms[p].photos||[]).length; });

    var h = '';
    h += row('見ていただいた場所', places.length + ' か所');
    h += row('気になるところ', ng.length ? ('<b class="sum-ng">' + ng.length + ' か所</b>') : '<b>なし</b>');
    if(ng.length) h += row('　場所', esc(ng.join('、')));
    h += row('写真', photos + ' 枚');
    h += row('ご説明の確認', noChk.length ? ('<b class="sum-ng">未確認 ' + noChk.length + ' 件</b>') : '<b>すべて確認済み</b>');
    if(noChk.length) h += row('　未確認', esc(noChk.join('、')));
    $('#sum').innerHTML = h;
    function row(k,v){ return '<div class="sum-row"><span>' + k + '</span><span>' + v + '</span></div>'; }
  }

  /* ---------- 送信 ---------- */
  function submit(){
    var places = window.PLACES || [];
    var payload = {
      action:'submit', id:ID, pass:PASS,
      rooms: places.map(function(p){
        var s = rooms[p] || {};
        return { place:p, ng:!!s.ng, comment:s.comment||'', photos:(s.ng ? (s.photos||[]) : []) };
      }),
      checks: $$('.chk').map(function(e){
        var t = e.getAttribute('data-t');
        var w = whys[t] || {};
        return { title:t, ok:!!checks[t],
                 why : checks[t] ? '' : (w.why  || ''),
                 note: checks[t] ? '' : (w.note || '') };
      })
    };
    keepAwake(true);
    veilCount('送信しています… 画面をそのままにしてお待ちください');
    post(payload).then(function(res){
      keepAwake(false);
      veil(false);
      if(!res.ok){ alert(res.err || '送信できませんでした。もう一度お試しください。'); return; }
      clear();
      showDone(res.ng > 0
        ? 'ありがとうございました。気になるところについて、担当者からご連絡します。'
        : 'ありがとうございました。問題なしとして承りました。');
    }).catch(function(){
      keepAwake(false);
      veil(false);
      alert('通信できませんでした。電波の良いところで、もう一度お試しください。書いた内容は残っています。');
    });
  }

  function showDone(msg){
    ['#s-pw','#s1','#s2','#s3'].forEach(function(s){ $(s).classList.add('hide'); });
    $('#foot').classList.add('hide');
    $('#s-done').classList.remove('hide');
    $('#done-msg').textContent = msg;
    $('#ask4').innerHTML = askHtml();
    $('#bar').style.width = '100%';
    window.scrollTo(0,0);
  }

  /* ---------- 小道具 ---------- */
  var _tick = null, _lock = null, _guard = null;

  function veil(msg){
    if(msg === false){
      clearInterval(_tick); _tick = null;
      $('#veil').classList.remove('on');
      return;
    }
    $('#veil-msg').textContent = msg;
    $('#veil').classList.add('on');
  }

  /* 送信のあいだ、何秒たったかを出します。
     数字が動いていれば「止まっていない」と分かるので、
     途中でアプリを閉じられてしまうのを防げます。 */
  function veilCount(base){
    var t0 = Date.now();
    veil(base);
    clearInterval(_tick);
    _tick = setInterval(function(){
      var s = Math.round((Date.now() - t0) / 1000);
      var m = $('#veil-msg');
      if(m) m.textContent = base + '（' + s + '秒）';
    }, 1000);
  }

  /* 送信のあいだ、画面が暗くならないようにし、
     うっかり閉じようとしたら聞き返します。 */
  function keepAwake(on){
    if(on){
      try{
        if(navigator.wakeLock && navigator.wakeLock.request){
          navigator.wakeLock.request('screen').then(function(l){ _lock = l; }, function(){});
        }
      }catch(e){}
      _guard = function(e){ e.preventDefault(); e.returnValue = ''; return ''; };
      window.addEventListener('beforeunload', _guard);
    }else{
      try{ if(_lock){ _lock.release(); _lock = null; } }catch(e){}
      if(_guard){ window.removeEventListener('beforeunload', _guard); _guard = null; }
    }
  }
  /* ドライブの URL から、画像として出せるアドレスを作ります
     例）https://drive.google.com/file/d/XXXX/view
       → https://drive.google.com/thumbnail?id=XXXX&sz=w1000        */
  function driveImg(u, w){
    var t = String(u == null ? '' : u);
    var m = /[-\w]{25,}/.exec(t);
    return m ? ('https://drive.google.com/thumbnail?id=' + m[0] + '&sz=w' + (w || 1000)) : t;
  }

  function zoom(src){
    var z = $('#zoom');
    z.querySelector('img').src = src;
    z.classList.add('on');
  }
  $('#zoom').addEventListener('click', function(){ this.classList.remove('on'); });

  /* ---------- 出入り口 ---------- */
  $('#pw-go').addEventListener('click', openIt);
  $('#pw').addEventListener('keydown', function(e){ if(e.key === 'Enter') openIt(); });
  $('#next').addEventListener('click', function(){
    if(step < 3) go(step + 1); else submit();
  });
  $('#back').addEventListener('click', function(){ if(step > 1) go(step - 1); });
  /* 「すべてに印を付ける」は外しました。
     一括で付けられると、文面を読まずに送れてしまうためです。 */
  /* 「すべてに印を付ける」「ぜんぶ外す」は、どちらも外しました。
     まとめて操作できると、文面を読まずに送れてしまうためです。 */

  if(!ID){
    $('#pw-box').innerHTML =
      '<div class="card"><h2>ご案内のリンクから開いてください</h2>' +
      '<p class="lead">メールに書いてあるアドレスをタップすると開きます。</p></div>';
  }
})();
