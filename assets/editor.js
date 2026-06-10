/* ============================================================
   editor.js — 공용 Tiptap v2 리치 텍스트 에디터
   소식마당 게시글(board.js) · 관리자 상품 상세설명(admin.js) 공용
   - Tiptap v2 무료 확장 전체 활성화 (esm.sh 동적 로드)
   - window.RichEditor.mount({toolbarEl, editorEl, content, ...}) → Promise<editor>
   ============================================================ */
(function () {
  'use strict';
  var MAX_IMG = 10 * 1024 * 1024; // 본문 삽입 이미지 10MB

  /* ---------- 툴바 정의 ---------- */
  var TOOLBAR = [
    { act: 'undo', icon: 'undo-2', tip: '실행 취소' },
    { act: 'redo', icon: 'redo-2', tip: '다시 실행' },
    { sep: true },
    { act: 'h1', text: 'H1', tip: '제목 1', on: ['heading', { level: 1 }] },
    { act: 'h2', text: 'H2', tip: '제목 2', on: ['heading', { level: 2 }] },
    { act: 'h3', text: 'H3', tip: '제목 3', on: ['heading', { level: 3 }] },
    { sep: true },
    { act: 'bold', icon: 'bold', tip: '굵게', on: ['bold'] },
    { act: 'italic', icon: 'italic', tip: '기울임', on: ['italic'] },
    { act: 'underline', icon: 'underline', tip: '밑줄', on: ['underline'] },
    { act: 'strike', icon: 'strikethrough', tip: '취소선', on: ['strike'] },
    { act: 'code', icon: 'code', tip: '인라인 코드', on: ['code'] },
    { act: 'highlight', icon: 'highlighter', tip: '형광펜', on: ['highlight'] },
    { act: 'sub', icon: 'subscript', tip: '아래 첨자', on: ['subscript'] },
    { act: 'sup', icon: 'superscript', tip: '위 첨자', on: ['superscript'] },
    { color: true },
    { sep: true },
    { act: 'al', icon: 'align-left', tip: '왼쪽 정렬', on: [{ textAlign: 'left' }] },
    { act: 'ac', icon: 'align-center', tip: '가운데 정렬', on: [{ textAlign: 'center' }] },
    { act: 'ar', icon: 'align-right', tip: '오른쪽 정렬', on: [{ textAlign: 'right' }] },
    { act: 'aj', icon: 'align-justify', tip: '양쪽 정렬', on: [{ textAlign: 'justify' }] },
    { sep: true },
    { act: 'ul', icon: 'list', tip: '글머리 목록', on: ['bulletList'] },
    { act: 'ol', icon: 'list-ordered', tip: '번호 목록', on: ['orderedList'] },
    { act: 'task', icon: 'list-checks', tip: '체크 목록', on: ['taskList'] },
    { sep: true },
    { act: 'quote', icon: 'text-quote', tip: '인용', on: ['blockquote'] },
    { act: 'codeblock', icon: 'square-code', tip: '코드 블록', on: ['codeBlock'] },
    { act: 'hr', icon: 'minus', tip: '구분선' },
    { sep: true },
    { act: 'link', icon: 'link', tip: '링크', on: ['link'] },
    { act: 'img', icon: 'image', tip: '이미지 삽입' },
    { act: 'yt', icon: 'youtube', tip: '유튜브 영상' },
    { sep: true },
    { act: 'table', icon: 'table', tip: '표 삽입' },
    { act: 'rowAdd', text: '행+', tip: '행 추가' },
    { act: 'colAdd', text: '열+', tip: '열 추가' },
    { act: 'tableDel', text: '표×', tip: '표 삭제' },
    { sep: true },
    { act: 'clear', icon: 'eraser', tip: '서식 지우기' },
  ];

  function toolbarHTML() {
    return TOOLBAR.map(function (b) {
      if (b.sep) return '<span class="tt-sep"></span>';
      if (b.color) return '<input type="color" class="tt-color" title="글자색" value="#2A2723">';
      var inner = b.icon ? '<i data-lucide="' + b.icon + '"></i>' : b.text;
      return '<button type="button" class="tt-btn" data-tt="' + b.act + '" title="' + b.tip + '">' + inner + '</button>';
    }).join('');
  }

  /* ---------- Tiptap 동적 로드 ---------- */
  var ttPromise = null;
  function load() {
    if (ttPromise) return ttPromise;
    var u = function (p) { return 'https://esm.sh/@tiptap/' + p + '@2'; };
    ttPromise = Promise.all([
      import(u('core')), import(u('starter-kit')), import(u('extension-underline')),
      import(u('extension-link')), import(u('extension-image')), import(u('extension-text-align')),
      import(u('extension-highlight')), import(u('extension-subscript')), import(u('extension-superscript')),
      import(u('extension-task-list')), import(u('extension-task-item')),
      import(u('extension-table')), import(u('extension-table-row')), import(u('extension-table-header')), import(u('extension-table-cell')),
      import(u('extension-text-style')), import(u('extension-color')),
      import(u('extension-placeholder')), import(u('extension-character-count')), import(u('extension-youtube')),
    ]).then(function (m) {
      return {
        Editor: m[0].Editor, StarterKit: m[1].default, Underline: m[2].default,
        Link: m[3].default, Image: m[4].default, TextAlign: m[5].default,
        Highlight: m[6].default, Subscript: m[7].default, Superscript: m[8].default,
        TaskList: m[9].default, TaskItem: m[10].default,
        Table: m[11].default, TableRow: m[12].default, TableHeader: m[13].default, TableCell: m[14].default,
        TextStyle: m[15].default, Color: m[16].default,
        Placeholder: m[17].default, CharacterCount: m[18].default, Youtube: m[19].default,
      };
    });
    return ttPromise;
  }

  /* ---------- 마운트 ---------- */
  // opts: { toolbarEl, editorEl, content, placeholder, countEl }
  function mount(opts) {
    var bar = opts.toolbarEl, holder = opts.editorEl;
    bar.className = 'tt-toolbar';
    bar.innerHTML = toolbarHTML();
    if (window.lucide) window.lucide.createIcons();
    holder.innerHTML = '<div style="padding:16px 18px;color:var(--ink-mute)">에디터를 불러오는 중…</div>';

    return load().then(function (T) {
      holder.innerHTML = '';
      var editor = new T.Editor({
        element: holder,
        extensions: [
          T.StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
          T.Underline,
          T.Link.configure({ openOnClick: false }),
          T.Image,
          T.TextAlign.configure({ types: ['heading', 'paragraph'] }),
          T.Highlight,
          T.Subscript, T.Superscript,
          T.TaskList, T.TaskItem.configure({ nested: true }),
          T.Table.configure({ resizable: false }), T.TableRow, T.TableHeader, T.TableCell,
          T.TextStyle, T.Color,
          T.Placeholder.configure({ placeholder: opts.placeholder || '내용을 입력하세요…' }),
          T.CharacterCount,
          T.Youtube.configure({ width: 640, height: 360 }),
        ],
        content: opts.content || '',
        editorProps: { attributes: { class: 'rich' } },
        onTransaction: function () { updateBar(); },
      });

      function updateBar() {
        TOOLBAR.forEach(function (b) {
          if (!b.on) return;
          var btn = bar.querySelector('[data-tt="' + b.act + '"]');
          if (btn) btn.classList.toggle('on', editor.isActive.apply(editor, b.on));
        });
        if (opts.countEl) opts.countEl.textContent = editor.storage.characterCount.characters() + '자';
      }
      updateBar();

      bar.addEventListener('click', function (e) {
        var b = e.target.closest('[data-tt]');
        if (!b) return;
        var ch = editor.chain().focus();
        switch (b.dataset.tt) {
          case 'undo': ch.undo().run(); break;
          case 'redo': ch.redo().run(); break;
          case 'h1': ch.toggleHeading({ level: 1 }).run(); break;
          case 'h2': ch.toggleHeading({ level: 2 }).run(); break;
          case 'h3': ch.toggleHeading({ level: 3 }).run(); break;
          case 'bold': ch.toggleBold().run(); break;
          case 'italic': ch.toggleItalic().run(); break;
          case 'underline': ch.toggleUnderline().run(); break;
          case 'strike': ch.toggleStrike().run(); break;
          case 'code': ch.toggleCode().run(); break;
          case 'highlight': ch.toggleHighlight().run(); break;
          case 'sub': ch.toggleSubscript().run(); break;
          case 'sup': ch.toggleSuperscript().run(); break;
          case 'al': ch.setTextAlign('left').run(); break;
          case 'ac': ch.setTextAlign('center').run(); break;
          case 'ar': ch.setTextAlign('right').run(); break;
          case 'aj': ch.setTextAlign('justify').run(); break;
          case 'ul': ch.toggleBulletList().run(); break;
          case 'ol': ch.toggleOrderedList().run(); break;
          case 'task': ch.toggleTaskList().run(); break;
          case 'quote': ch.toggleBlockquote().run(); break;
          case 'codeblock': ch.toggleCodeBlock().run(); break;
          case 'hr': ch.setHorizontalRule().run(); break;
          case 'link': (function () {
            var prev = editor.getAttributes('link').href || '';
            var url = prompt('링크 URL을 입력하세요 (비우면 링크 해제)', prev || 'https://');
            if (url === null) return;
            if (!url || url === 'https://') ch.unsetLink().run();
            else ch.extendMarkRange('link').setLink({ href: url }).run();
          })(); break;
          case 'img': (function () {
            var inp = document.createElement('input');
            inp.type = 'file'; inp.accept = 'image/*';
            inp.onchange = function () {
              var f = inp.files[0]; if (!f) return;
              if (f.size > MAX_IMG) { alert('이미지는 10MB 이하만 삽입할 수 있습니다.'); return; }
              var rd = new FileReader();
              rd.onload = function () { editor.chain().focus().setImage({ src: rd.result }).run(); };
              rd.readAsDataURL(f);
            };
            inp.click();
          })(); break;
          case 'yt': (function () {
            var url = prompt('유튜브 영상 URL을 입력하세요');
            if (url) ch.setYoutubeVideo({ src: url }).run();
          })(); break;
          case 'table': ch.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); break;
          case 'rowAdd': ch.addRowAfter().run(); break;
          case 'colAdd': ch.addColumnAfter().run(); break;
          case 'tableDel': ch.deleteTable().run(); break;
          case 'clear': ch.unsetAllMarks().clearNodes().run(); break;
        }
        updateBar();
      });

      var colorIn = bar.querySelector('.tt-color');
      if (colorIn) colorIn.addEventListener('input', function () { editor.chain().focus().setColor(colorIn.value).run(); });

      return editor;
    });
  }

  window.RichEditor = { load: load, mount: mount, MAX_IMG: MAX_IMG };
})();
