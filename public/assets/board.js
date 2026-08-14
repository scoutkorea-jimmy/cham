/* ============================================================
   board.js — 소식마당 게시판 · 현장 갤러리
   - 글쓰기/수정/삭제·사진 업로드/삭제: 클릭할 때마다 관리자 인증(상태 미저장)
   - 에디터: 공용 RichEditor(editor.js, Tiptap v2 무료 확장 전체)
   - 첨부파일: 최대 10개 · 개당 5MB(site.js MAX_IMAGE_BYTES), 형식 제한 없음
   - 첨부 이미지: 게시글 하단 슬라이드 미리보기
   - 갤러리: 페이지당 최대 10장 페이지네이션
   ============================================================ */
(function () {
  'use strict';
  if (!document.body || document.body.dataset.page !== 'news') return;
  var S = window.Site;
  var esc = S.esc, icons = S.icons, uid = S.uid;

  /* 글쓰기 자격. 서버(GET /api/posts)가 판정한 결과를 그대로 담는다.
       kind  'admin' | 'member' | 'local'(검증용 화면) | null(자격 없음)
       boards 글을 쓸 수 있는 게시판 이름들
       mine   권한 회원이 쓴 자기 글의 id — 공개 목록에 회원 id 를 싣지 않으므로
              '내 글인가'는 이 목록으로 판정한다(이름으로 맞추면 동명이인에서 샌다)
     화면이 버튼을 감추는 것은 편의이지 잠금이 아니다. 통과는 언제나 서버가 다시 본다. */
  var writer = { kind: null, boards: [], mine: [] };

  function canWrite(cat) {
    if (writer.kind === 'admin' || writer.kind === 'local') return true;
    return writer.boards.indexOf(cat) >= 0;
  }
  function canEdit(p) {
    if (writer.kind === 'admin' || writer.kind === 'local') return true;
    if (writer.kind !== 'member' || !p) return false;
    return (writer.mine || []).indexOf(p.id) >= 0;
  }
  /* 검증용 로컬 화면에는 세션이 없다 — 거기서만 옛 관리자 인증 모달을 그대로 쓴다.
     운영에서는 이미 로그인한 사람이므로 한 번 더 묻지 않는다. */
  function gate(fn) {
    if (writer.kind === 'local') { S.requireAdmin(fn); return; }
    fn();
  }
  /* 목록과 자격을 함께 다시 받는다 — 글을 쓰거나 지운 뒤 '내 글' 목록도 달라진다. */
  function refresh() {
    return S.reloadPosts().then(syncWriter).then(function () { renderBoards(); });
  }
  /* 자격을 받아 글쓰기 버튼을 켠다. 권한이 없으면 버튼은 숨은 채로 남는다. */
  function isAdmin() { return writer.kind === 'admin' || writer.kind === 'local'; }

  function syncWriter() {
    return S.postWriter().then(function (w) {
      writer = { kind: w.kind || null, boards: w.boards || [], mine: w.mine || [] };
      [].forEach.call(document.querySelectorAll('[data-write]'), function (b) {
        b.hidden = !canWrite(b.getAttribute('data-write'));
      });
      // 갤러리는 관리자만 — 글쓰기 권한만 받은 회원에게도 보이지 않는다
      [].forEach.call(document.querySelectorAll('[data-gallery-upload]'), function (b) {
        b.hidden = !isAdmin();
      });
      renderGallery();     // 사진마다 붙는 삭제 버튼도 자격을 따른다
      return writer;
    });
  }

  var MAX_FILES = 10;
  // 한도는 site.js 한 곳에서 정한다 — 여기서 따로 적으면 서버와 어긋난다
  var MAX_SIZE = (S && S.MAX_IMAGE_BYTES) || 5 * 1024 * 1024;
                                   // 더 크게 잡으면 여기서 통과시킨 파일을 서버가 거절한다.
  var GAL_PER_PAGE = 10;

  function bytes(n) {
    if (n > 1048576) return (n / 1048576).toFixed(1) + 'MB';
    if (n > 1024) return Math.round(n / 1024) + 'KB';
    return n + 'B';
  }

  /* ================= 게시판 목록 ================= */
  function postsOf(board) {
    return S.getPosts().filter(function (p) {
      return board === 'edu' ? p.cat === '교육' : p.cat !== '교육';
    }).sort(function (a, b) { return (b.at || '').localeCompare(a.at || ''); });
  }

  function renderBoards() {
    [['board-notice', 'notice'], ['board-edu', 'edu']].forEach(function (pair) {
      var box = document.getElementById(pair[0]);
      if (!box) return;
      var list = postsOf(pair[1]);
      box.innerHTML = list.length ? list.map(function (p) {
        return '<div class="board-row" data-post="' + p.id + '" role="button" tabindex="0">' +
          '<span class="tag' + (p.important ? ' point' : '') + '">' + esc(p.badge || (p.important ? '중요' : p.cat)) + '</span>' +
          '<span class="bt">' + esc(p.title) + '</span>' +
          '<span class="bd">' + S.fmtYMD(p.at) + '</span></div>';
      }).join('') : '<div class="board-row" style="cursor:default;color:var(--ink-mute)">등록된 글이 없습니다.</div>';
    });
    icons();
  }

  /* ================= 글 하나의 주소 =================
     글은 모달로 펼쳐질 뿐 주소가 없었다. 그래서 셋을 못 했다 —
     검색 노출(크롤러가 글이 있다는 것조차 모른다) · 링크 공유 · 카톡 미리보기.
     주소는 `/news?id=<글id>` 이고, 그 주소로 들어오면 **서버가 본문을 HTML 에 실어 준다**
     (functions/_shared/post-seo.js). 화면이 뜨면 그 자리를 걷어내고 모달로 연다. */
  function currentPostId() {
    try { return new URLSearchParams(location.search).get('id'); } catch (e) { return null; }
  }
  function pushPost(id) {
    // 주소만 바꾼다(문서를 다시 받지 않는다). 뒤로가기가 목록으로 돌아가게 된다
    try { history.pushState({ post: id }, '', '?id=' + encodeURIComponent(id)); } catch (e) {}
  }
  function popPost() {
    if (!currentPostId()) return;          // 이미 목록 주소면 기록을 더 쌓지 않는다
    try { history.pushState({}, '', location.pathname); } catch (e) {}
  }
  function initPostRoute() {
    /* 서버가 넣어 둔 본문을 걷는다 — 여기부터는 모달이 같은 글을 보여 준다.
       두 곳에 같은 글이 보이면 어느 것이 진짜인지 알 수 없다. */
    var ssr = document.getElementById('post-ssr');
    if (ssr) ssr.innerHTML = '';

    var id = currentPostId();
    if (id) openPost(id, true);

    // 모달이 닫히면 주소도 목록으로. 닫는 길이 여럿이라 site.js 의 신호 하나에 건다
    window.addEventListener('site:modal-closed', popPost);

    // 뒤로·앞으로
    window.addEventListener('popstate', function () {
      var pid = currentPostId();
      if (pid) openPost(pid, true);
      else if (S.closeModal) S.closeModal();
    });
  }

  /* ================= 게시글 보기 ================= */
  /** @param {boolean} [fromRoute] 주소를 보고 여는 경우 — 기록을 다시 쌓지 않는다 */
  function openPost(id, fromRoute) {
    var p = S.getPosts().filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    S.Media.list('post', id).then(function (files) {
      var imgs = files.filter(function (f) { return /^image\//.test(f.type); });
      var docs = files.filter(function (f) { return !/^image\//.test(f.type); });

      var attHtml = '';
      if (docs.length) {
        attHtml = '<div style="margin-top:var(--gap-related)"><b style="font-size:14px">첨부파일</b>' + docs.map(function (f) {
          return '<div class="att-row"><i data-lucide="paperclip"></i><span class="an">' + esc(f.name) + '</span><span class="as">' + bytes(f.size) + '</span><a href="#" data-dl="' + f.id + '">내려받기</a></div>';
        }).join('') + '</div>';
      }
      var sliderHtml = '';
      if (imgs.length) {
        sliderHtml = '<div class="post-slider" id="postSlider">' +
          '<div class="ps-frame"><img id="psImg" alt="첨부 이미지"></div>' +
          (imgs.length > 1
            ? '<button class="ps-nav prev" data-ps="-1" aria-label="이전"><i data-lucide="chevron-left"></i></button>' +
              '<button class="ps-nav next" data-ps="1" aria-label="다음"><i data-lucide="chevron-right"></i></button>' +
              '<div class="ps-dots" id="psDots"></div>'
            : '') +
        '</div>';
      }
      /* 수정·삭제는 이 글을 다룰 수 있는 사람에게만 보인다.
         자격은 열 때 이미 받아 둔 값(writer)으로 판정하고, 실제 통과는 서버가 다시 본다 —
         화면이 버튼을 감추는 것은 편의이지 잠금이 아니다. */
      var adminBtns = canEdit(p)
        ? '<button type="button" class="btn btn-ghost" id="postEdit"><i data-lucide="pen-line"></i>수정</button>' +
          '<button type="button" class="btn btn-ghost" id="postDel" style="color:var(--danger)"><i data-lucide="trash-2"></i>삭제</button>'
        : '';

      S.rawModal(
        '<div class="modal-head"><div>' +
          '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' +
              '<span class="tag' + (p.important ? ' point' : '') + '">' + esc(p.badge || (p.important ? '중요' : p.cat)) + '</span>' +
            '<span class="muted" style="font-size:13px">' + S.fmtYMD(p.at) +
              (p.authorName ? ' · ' + esc(p.authorName) : '') + '</span></div>' +
          '<h3 style="margin-top:var(--gap-tight)">' + esc(p.title) + '</h3></div>' +
          '<button class="modal-close" data-modal-close aria-label="닫기"><i data-lucide="x"></i></button></div>' +
        '<div class="modal-body">' +
          '<div class="rich">' + (p.html || '') + '</div>' +
          sliderHtml + attHtml +
          '<div class="modal-foot">' + adminBtns + '<button type="button" class="btn btn-point" data-modal-close>닫기</button></div>' +
        '</div>', 720);

      /* 주소를 글의 것으로. 열린 **뒤에** 민다 — 글을 못 찾아 위에서 돌아간 경우
         (`if (!p) return`)에는 주소가 바뀌면 안 된다. */
      if (!fromRoute) pushPost(id);

      // 이미지 슬라이더
      if (imgs.length) {
        var urls = imgs.map(function (f) { return f.url; });
        var idx = 0;
        var imgEl = document.getElementById('psImg');
        var dots = document.getElementById('psDots');
        function showSlide(i) {
          idx = (i + urls.length) % urls.length;
          imgEl.src = urls[idx];
          if (dots) dots.innerHTML = urls.map(function (_, j) {
            return '<button class="' + (j === idx ? 'on' : '') + '" data-psgo="' + j + '" aria-label="' + (j + 1) + '번 이미지"></button>';
          }).join('');
        }
        showSlide(0);
        document.getElementById('postSlider').addEventListener('click', function (e) {
          var nav = e.target.closest('[data-ps]');
          if (nav) { showSlide(idx + Number(nav.dataset.ps)); return; }
          var go = e.target.closest('[data-psgo]');
          if (go) showSlide(Number(go.dataset.psgo));
        });
      }
      // 첨부 다운로드
      document.querySelectorAll('[data-dl]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          var f = files.filter(function (x) { return x.id === a.dataset.dl; })[0];
          if (!f) return;
          var link = document.createElement('a');
          link.href = f.url; link.download = f.name; link.click();
        });
      });
      // 수정/삭제 — 자격이 있는 사람에게만 버튼이 있다(위 canEdit)
      var editBtn = document.getElementById('postEdit');
      var delBtn = document.getElementById('postDel');
      if (editBtn) editBtn.addEventListener('click', function () {
        gate(function () { openEditor(p, files); });
      });
      if (delBtn) delBtn.addEventListener('click', function () {
        gate(function () {
          if (!confirm('이 게시글을 삭제할까요? 첨부파일도 함께 삭제됩니다.')) return;
          delBtn.disabled = true;
          S.api('/api/posts/' + encodeURIComponent(p.id), { method: 'DELETE' }).then(function (r) {
            if (!r.ok) {
              delBtn.disabled = false;
              S.toast((r.data && r.data.error) || '삭제하지 못했습니다.');
              return;
            }
            S.Media.delFor('post', p.id);
            S.forgetPostWriter();
            return refresh().then(function () {
              S.closeModal(); S.toast('게시글이 삭제되었습니다.');
            });
          }).catch(function () {
            delBtn.disabled = false;
            S.toast('삭제하지 못했습니다. 인터넷 연결을 확인해 주세요.');
          });
        });
      });
    });
  }

  /* ================= 글쓰기 / 수정 ================= */
  function openEditor(post, existingFiles, defCat) {
    var isEdit = !!post;
    var selCat = post ? post.cat : (defCat || '공지');
    var atts = (existingFiles || []).map(function (f) { return { id: f.id, name: f.name, size: f.size, type: f.type, existing: true }; });
    var removedIds = [];
    var editor = null;

    S.rawModal(
      '<div class="modal-head"><div><div class="eyebrow">소식마당</div><h3>' + (isEdit ? '글 수정' : '글쓰기') + '</h3></div>' +
        '<button class="modal-close" data-modal-close aria-label="닫기"><i data-lucide="x"></i></button></div>' +
      '<div class="modal-body">' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:var(--gap-tight)">' +
          '<select id="edCat" style="padding:11px 13px;border:1.5px solid var(--line);border-radius:var(--r-sm);font:inherit;background:var(--surface)">' +
            ['공지', '언론', '교육'].map(function (c) { return '<option' + (selCat === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') +
          '</select>' +
          '<label style="display:inline-flex;gap:7px;align-items:center;font-size:14px;font-weight:600;cursor:pointer"><input type="checkbox" id="edImp" style="width:16px;height:16px;accent-color:var(--point)"' + (post && post.important ? ' checked' : '') + '>중요 표시</label>' +
          '<input id="edTitle" placeholder="제목을 입력하세요" value="' + esc(post ? post.title : '') + '" style="flex:1;min-width:220px;padding:11px 13px;border:1.5px solid var(--line);border-radius:var(--r-sm);font:inherit;font-weight:700">' +
        '</div>' +
        '<div class="tt-toolbar" id="ttBar"></div>' +
        '<div class="tt-body"><div id="ttEditor"></div></div>' +
        '<div class="tt-meta"><span id="ttCount"></span><span>첨부: 최대 ' + MAX_FILES + '개 · 개당 10MB · 형식 제한 없음</span></div>' +
        '<div style="margin-top:var(--gap-tight)">' +
          '<button type="button" class="btn btn-ghost" id="edAttBtn" style="padding:10px 16px"><i data-lucide="paperclip"></i>파일 첨부</button>' +
          '<input type="file" id="edAttInput" multiple hidden>' +
          '<div id="edAttList"></div>' +
        '</div>' +
        '<div class="modal-foot"><button type="button" class="btn btn-ghost" data-modal-close>취소</button><button type="button" class="btn btn-point" id="edSave" disabled><i data-lucide="check"></i>' + (isEdit ? '수정 완료' : '등록') + '</button></div>' +
      '</div>', 880);
    icons();

    function renderAtts() {
      var box = document.getElementById('edAttList');
      box.innerHTML = atts.map(function (a, i) {
        return '<div class="att-row"><i data-lucide="' + (/^image\//.test(a.type) ? 'image' : 'paperclip') + '"></i>' +
          '<span class="an">' + esc(a.name) + '</span><span class="as">' + bytes(a.size) + '</span>' +
          '<button type="button" data-attdel="' + i + '" title="삭제"><i data-lucide="x"></i></button></div>';
      }).join('');
      icons();
    }
    renderAtts();

    document.getElementById('edAttBtn').addEventListener('click', function () { document.getElementById('edAttInput').click(); });
    document.getElementById('edAttInput').addEventListener('change', function () {
      var files = Array.prototype.slice.call(this.files || []);
      files.forEach(function (f) {
        if (atts.length >= MAX_FILES) { alert('첨부파일은 최대 ' + MAX_FILES + '개까지 등록할 수 있습니다.'); return; }
        if (f.size > MAX_SIZE) { alert(S.tooBigMsg ? S.tooBigMsg(f.name, f.size) : '파일이 너무 큽니다.'); return; }
        atts.push({ name: f.name, size: f.size, type: f.type || 'application/octet-stream', file: f });
      });
      this.value = '';
      renderAtts();
    });
    document.getElementById('edAttList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-attdel]');
      if (!b) return;
      var i = Number(b.dataset.attdel);
      if (atts[i] && atts[i].existing) removedIds.push(atts[i].id);
      atts.splice(i, 1);
      renderAtts();
    });

    window.RichEditor.mount({
      toolbarEl: document.getElementById('ttBar'),
      editorEl: document.getElementById('ttEditor'),
      content: post ? post.html : '',
      placeholder: '내용을 입력하세요…',
      countEl: document.getElementById('ttCount'),
    }).then(function (ed) {
      editor = ed;
      var save = document.getElementById('edSave');
      if (!save) { ed.destroy(); return; } // 모달이 이미 닫힘
      save.disabled = false;
      save.addEventListener('click', function () {
        var title = document.getElementById('edTitle').value.trim();
        if (!title) { alert('제목을 입력해 주세요.'); return; }
        save.disabled = true;
        var body = {
          title: title,
          cat: document.getElementById('edCat').value,
          important: document.getElementById('edImp').checked,
          html: editor.getHTML(),
        };
        /* 목록을 통째로 보내지 않는다. 그 방식은 관리자 전용 창구였고, 무엇보다
           한 사람이 보낸 목록이 그 사이 남이 올린 글을 덮어 지울 수 있다.
           한 건만 보내면 그 사고가 없다 → functions/api/posts */
        var req = isEdit
          ? S.api('/api/posts/' + encodeURIComponent(post.id), { method: 'PATCH', body: body })
          : S.api('/api/posts', { method: 'POST', body: body });

        req.then(function (r) {
          if (!r.ok) {
            save.disabled = false;
            S.toast((r.data && r.data.error) || '저장하지 못했습니다.');
            return null;
          }
          var pid = (r.data && r.data.id) || post.id;
          var jobs = [];
          removedIds.forEach(function (fid) { jobs.push(S.Media.del('post', fid)); });
          atts.forEach(function (a, i) {
            if (a.file) jobs.push(S.Media.put('post', pid, a.file, { ord: i, name: a.name, size: a.size }));
          });
          return Promise.all(jobs).then(function (results) {
            S.forgetPostWriter();
            return refresh().then(function () {
              editor.destroy();
              S.closeModal();
              var fail = results.filter(function (x) { return x === null; }).length;
              S.toast((isEdit ? '게시글이 수정되었습니다.' : '게시글이 등록되었습니다.') +
                      (fail ? ' (첨부 ' + fail + '개는 올리지 못했습니다)' : ''));
            });
          });
        }).catch(function () {
          save.disabled = false;
          S.toast('저장하지 못했습니다. 인터넷 연결을 확인해 주세요.');
        });
      });
    }).catch(function () {
      var holder = document.getElementById('ttEditor');
      if (holder) holder.innerHTML = '<div style="padding:16px 18px;color:var(--danger)">에디터를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.</div>';
    });
  }

  /* ================= 현장 갤러리 (페이지당 10장) ================= */
  var galPage = 1;

  function renderGallery() {
    var grid = document.getElementById('gallery-grid');
    var pager = document.getElementById('gallery-pager');
    if (!grid) return;
    S.Media.list('gallery').then(function (items) {
      items.sort(function (a, b) { return (b.at || '').localeCompare(a.at || ''); });
      if (!items.length) {
        // 사진이 없을 때 예시 자리표시를 깔면 실제로 올린 것처럼 보인다 — 빈 상태로 둔다
        grid.innerHTML = '<p class="muted" style="grid-column:1/-1;text-align:center;padding:40px 0">등록된 사진이 없습니다.</p>';
        pager.innerHTML = '';
        icons();
        return;
      }
      var pages = Math.max(1, Math.ceil(items.length / GAL_PER_PAGE));
      if (galPage > pages) galPage = pages;
      var slice = items.slice((galPage - 1) * GAL_PER_PAGE, galPage * GAL_PER_PAGE);
      grid.innerHTML = slice.map(function (g) {
        return '<figure class="gal-item"><img src="' + g.url + '" alt="' + esc(g.name) + '" loading="lazy">' +
          (isAdmin() ? '<button class="gal-del" data-gdel="' + g.id + '" title="삭제 (관리자)"><i data-lucide="x"></i></button>' : '') +
          '<figcaption>' + esc(g.name) + '</figcaption></figure>';
      }).join('');
      pager.innerHTML = pages > 1
        ? '<button data-gpage="' + (galPage - 1) + '"' + (galPage <= 1 ? ' disabled' : '') + ' aria-label="이전"><i data-lucide="chevron-left"></i></button>' +
          Array.apply(null, Array(pages)).map(function (_, i) {
            return '<button data-gpage="' + (i + 1) + '" class="' + (i + 1 === galPage ? 'on' : '') + '">' + (i + 1) + '</button>';
          }).join('') +
          '<button data-gpage="' + (galPage + 1) + '"' + (galPage >= pages ? ' disabled' : '') + ' aria-label="다음"><i data-lucide="chevron-right"></i></button>'
        : '';
      icons();
    });
  }

  function bindGallery() {
    var pager = document.getElementById('gallery-pager');
    if (pager) pager.addEventListener('click', function (e) {
      var b = e.target.closest('[data-gpage]');
      if (!b || b.disabled) return;
      galPage = Number(b.dataset.gpage);
      renderGallery();
      document.getElementById('gallery').scrollIntoView({ behavior: 'smooth' });
    });
    var grid = document.getElementById('gallery-grid');
    if (grid) grid.addEventListener('click', function (e) {
      var b = e.target.closest('[data-gdel]');
      if (!b) return;
      S.requireAdmin(function () {
        if (!confirm('이 사진을 삭제할까요?')) return;
        S.Media.del('gallery', b.dataset.gdel).then(renderGallery);
      });
    });
    var upBtn = document.querySelector('[data-gallery-upload]');
    if (upBtn) upBtn.addEventListener('click', function () {
      S.requireAdmin(function () {
        var inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
        inp.onchange = function () {
          var files = Array.prototype.slice.call(inp.files || []);
          var jobs = [];
          files.forEach(function (f) {
            if (f.size > MAX_SIZE) { alert(S.tooBigMsg ? S.tooBigMsg(f.name, f.size) : '사진이 너무 큽니다.'); return; }
            jobs.push(S.Media.put('gallery', null, f, { name: f.name.replace(/\.[^.]+$/, '') }));
          });
          if (!jobs.length) return;
          Promise.all(jobs).then(function (results) {
            galPage = 1;
            renderGallery();
            // 올리기가 실패해도 null 로 조용히 끝난다 — 세어서 사실대로 알린다
            var ok = results.filter(function (x) { return x && !x.error; }).length;
            var fail = results.length - ok;
            var why = (results.find(function (x) { return x && x.error; }) || {}).error;
            if (fail) S.toast((ok ? ok + '장 등록 · ' + fail + '장 실패 — ' : '') + (why || '사진을 올리지 못했습니다.'), 5000);
            else S.toast(ok + '장의 사진이 등록되었습니다.');
          });
        };
        inp.click();
      });
    });
  }

  /* ================= init ================= */
  // Site.ready 는 DOM 과 데이터(서버 모드의 /api/bootstrap)를 모두 기다린다
  function ready(fn){
    if (S.ready) { S.ready(fn); return; }
    if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn);
  }
  ready(function () {
    renderBoards();
    renderGallery();
    bindGallery();
    /* 자격을 물어 글쓰기 버튼을 켠다. 답이 오기 전까지 버튼은 숨은 채다(news.html 이 hidden) —
       잠깐 보였다 사라지면 비회원에게 '있었는데 막혔다'로 읽힌다. */
    syncWriter();
    document.addEventListener('click', function (e) {
      var w = e.target.closest('[data-write]');
      if (w) {
        var cat = w.getAttribute('data-write');
        /* 버튼이 숨겨져 있어도 눌릴 수 있는 경로(개발자도구 등)가 있으므로 여기서 한 번 더 본다.
           서버가 최종 판정하지만, 쓸 수 없는 글을 다 적고 나서 거절당하는 것보다 낫다. */
        if (!canWrite(cat)) { S.toast('이 게시판에 글을 쓸 권한이 없습니다.'); return; }
        gate(function () { openEditor(null, null, cat); });
        return;
      }
      var row = e.target.closest('[data-post]');
      if (row) openPost(row.dataset.post);
    });

    initPostRoute();
  });
})();
