/* ============================================================
   board.js — 소식마당 게시판 · 현장 갤러리
   - 글쓰기/수정/삭제·사진 업로드/삭제: 클릭할 때마다 관리자 인증(상태 미저장)
   - 에디터: 공용 RichEditor(editor.js, Tiptap v2 무료 확장 전체)
   - 첨부파일: 최대 10개 × 개당 10MB, 형식 제한 없음 (IndexedDB)
   - 첨부 이미지: 게시글 하단 슬라이드 미리보기
   - 갤러리: 페이지당 최대 10장 페이지네이션
   ============================================================ */
(function () {
  'use strict';
  if (!document.body || document.body.dataset.page !== 'news') return;
  var S = window.Site;
  var esc = S.esc, icons = S.icons, uid = S.uid;

  var MAX_FILES = 10;
  var MAX_SIZE = 10 * 1024 * 1024; // 10MB
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
          (p.sample ? '<span class="tag sample">샘플</span>' : '') +
          '<span class="tag' + (p.important ? ' point' : '') + '">' + esc(p.badge || (p.important ? '중요' : p.cat)) + '</span>' +
          '<span class="bt">' + esc(p.title) + '</span>' +
          '<span class="bd">' + S.fmtYMD(p.at) + '</span></div>';
      }).join('') : '<div class="board-row" style="cursor:default;color:var(--ink-mute)">등록된 글이 없습니다.</div>';
    });
    icons();
  }

  /* ================= 게시글 보기 ================= */
  function openPost(id) {
    var p = S.getPosts().filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    S.idb.byIndex('files', 'postId', id).then(function (files) {
      var imgs = files.filter(function (f) { return /^image\//.test(f.type); });
      var docs = files.filter(function (f) { return !/^image\//.test(f.type); });

      var attHtml = '';
      if (docs.length) {
        attHtml = '<div style="margin-top:18px"><b style="font-size:14px">첨부파일</b>' + docs.map(function (f) {
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
      // 관리자 수정/삭제 버튼은 항상 노출하되, 클릭 시 새로 인증
      var adminBtns =
        '<button type="button" class="btn btn-ghost" id="postEdit"><i data-lucide="pen-line"></i>수정</button>' +
        '<button type="button" class="btn btn-ghost" id="postDel" style="color:var(--danger)"><i data-lucide="trash-2"></i>삭제</button>';

      S.rawModal(
        '<div class="modal-head"><div>' +
          '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' +
            (p.sample ? '<span class="tag sample">샘플</span>' : '') +
            '<span class="tag' + (p.important ? ' point' : '') + '">' + esc(p.badge || (p.important ? '중요' : p.cat)) + '</span>' +
            '<span class="muted" style="font-size:13px">' + S.fmtYMD(p.at) + '</span></div>' +
          '<h3 style="margin-top:10px">' + esc(p.title) + '</h3></div>' +
          '<button class="modal-close" data-modal-close aria-label="닫기"><i data-lucide="x"></i></button></div>' +
        '<div class="modal-body">' +
          '<div class="rich">' + (p.html || '') + '</div>' +
          sliderHtml + attHtml +
          '<div class="modal-foot">' + adminBtns + '<button type="button" class="btn btn-point" data-modal-close>닫기</button></div>' +
        '</div>', 720);

      // 이미지 슬라이더
      if (imgs.length) {
        var urls = imgs.map(function (f) { return URL.createObjectURL(f.blob); });
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
          var u = URL.createObjectURL(f.blob);
          var link = document.createElement('a');
          link.href = u; link.download = f.name; link.click();
          setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
        });
      });
      // 관리자 수정/삭제 — 클릭할 때마다 인증
      document.getElementById('postEdit').addEventListener('click', function () {
        S.requireAdmin(function () { openEditor(p, files); });
      });
      document.getElementById('postDel').addEventListener('click', function () {
        S.requireAdmin(function () {
          if (!confirm('이 게시글을 삭제할까요? 첨부파일도 함께 삭제됩니다.')) return;
          S.setPosts(S.getPosts().filter(function (x) { return x.id !== p.id; }));
          files.forEach(function (f) { S.idb.del('files', f.id); });
          S.closeModal(); renderBoards(); S.toast('게시글이 삭제되었습니다.');
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
        '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px">' +
          '<select id="edCat" style="padding:11px 13px;border:1.5px solid var(--line);border-radius:var(--r-sm);font:inherit;background:var(--surface)">' +
            ['공지', '언론', '교육'].map(function (c) { return '<option' + (selCat === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') +
          '</select>' +
          '<label style="display:inline-flex;gap:7px;align-items:center;font-size:14px;font-weight:600;cursor:pointer"><input type="checkbox" id="edImp" style="width:16px;height:16px;accent-color:var(--point)"' + (post && post.important ? ' checked' : '') + '>중요 표시</label>' +
          '<input id="edTitle" placeholder="제목을 입력하세요" value="' + esc(post ? post.title : '') + '" style="flex:1;min-width:220px;padding:11px 13px;border:1.5px solid var(--line);border-radius:var(--r-sm);font:inherit;font-weight:700">' +
        '</div>' +
        '<div class="tt-toolbar" id="ttBar"></div>' +
        '<div class="tt-body"><div id="ttEditor"></div></div>' +
        '<div class="tt-meta"><span id="ttCount"></span><span>첨부: 최대 ' + MAX_FILES + '개 · 개당 10MB · 형식 제한 없음</span></div>' +
        '<div style="margin-top:12px">' +
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
        if (f.size > MAX_SIZE) { alert('"' + f.name + '" — 파일당 최대 10MB까지 첨부할 수 있습니다.'); return; }
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
        var posts = S.getPosts();
        var rec;
        if (isEdit) {
          rec = posts.filter(function (x) { return x.id === post.id; })[0];
          if (!rec) { rec = { id: post.id, at: post.at }; posts.unshift(rec); }
        } else {
          rec = { id: uid(), at: new Date().toISOString() };
          posts.unshift(rec);
        }
        rec.title = title;
        rec.cat = document.getElementById('edCat').value;
        rec.important = document.getElementById('edImp').checked;
        rec.html = editor.getHTML();
        rec.sample = false;
        rec.updatedAt = new Date().toISOString();
        S.setPosts(posts);

        var jobs = [];
        removedIds.forEach(function (fid) { jobs.push(S.idb.del('files', fid)); });
        atts.forEach(function (a) {
          if (a.file) jobs.push(S.idb.put('files', { id: uid(), postId: rec.id, name: a.name, size: a.size, type: a.type, blob: a.file }));
        });
        Promise.all(jobs).then(function () {
          editor.destroy();
          S.closeModal();
          renderBoards();
          S.toast(isEdit ? '게시글이 수정되었습니다.' : '게시글이 등록되었습니다.');
        });
      });
    }).catch(function () {
      var holder = document.getElementById('ttEditor');
      if (holder) holder.innerHTML = '<div style="padding:16px 18px;color:var(--danger)">에디터를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.</div>';
    });
  }

  /* ================= 현장 갤러리 (페이지당 10장) ================= */
  var galPage = 1;
  var galUrls = [];
  var GAL_SAMPLES = [
    ['tone-oat', '[샘플] 장 담그기 체험'], ['tone-main', '[샘플] 장독대 풍경'], ['tone-deep', '[샘플] 지도사 교육 현장'],
    ['tone-point', '[샘플] 메주 띄우기'], ['tone-main', '[샘플] 씨장 체험'], ['tone-oat', '[샘플] 수료식 단체사진'],
  ];

  function renderGallery() {
    var grid = document.getElementById('gallery-grid');
    var pager = document.getElementById('gallery-pager');
    if (!grid) return;
    galUrls.forEach(function (u) { URL.revokeObjectURL(u); });
    galUrls = [];
    S.idb.all('gallery').then(function (items) {
      items.sort(function (a, b) { return (b.at || '').localeCompare(a.at || ''); });
      if (!items.length) {
        grid.innerHTML = GAL_SAMPLES.map(function (s) {
          return '<div class="ph ' + s[0] + ' ratio-43" data-label="' + s[1] + '"><i data-lucide="image"></i></div>';
        }).join('');
        pager.innerHTML = '';
        icons();
        return;
      }
      var pages = Math.max(1, Math.ceil(items.length / GAL_PER_PAGE));
      if (galPage > pages) galPage = pages;
      var slice = items.slice((galPage - 1) * GAL_PER_PAGE, galPage * GAL_PER_PAGE);
      grid.innerHTML = slice.map(function (g) {
        var u = URL.createObjectURL(g.blob);
        galUrls.push(u);
        return '<figure class="gal-item"><img src="' + u + '" alt="' + esc(g.name) + '" loading="lazy">' +
          '<button class="gal-del" data-gdel="' + g.id + '" title="삭제 (관리자)"><i data-lucide="x"></i></button>' +
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
        S.idb.del('gallery', b.dataset.gdel).then(renderGallery);
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
            if (f.size > MAX_SIZE) { alert('"' + f.name + '" — 사진은 10MB 이하만 올릴 수 있습니다.'); return; }
            jobs.push(S.idb.put('gallery', { id: uid(), name: f.name.replace(/\.[^.]+$/, ''), at: new Date().toISOString(), blob: f }));
          });
          Promise.all(jobs).then(function () {
            galPage = 1;
            renderGallery();
            if (jobs.length) S.toast(jobs.length + '장의 사진이 등록되었습니다.');
          });
        };
        inp.click();
      });
    });
  }

  /* ================= init ================= */
  function ready(fn){ if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function () {
    renderBoards();
    renderGallery();
    bindGallery();
    document.addEventListener('click', function (e) {
      var w = e.target.closest('[data-write]');
      if (w) { var cat = w.getAttribute('data-write'); S.requireAdmin(function () { openEditor(null, null, cat); }); return; }
      var row = e.target.closest('[data-post]');
      if (row) openPost(row.dataset.post);
    });
  });
})();
