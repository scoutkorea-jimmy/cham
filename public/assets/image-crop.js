/**
 * 상품 사진 1:1 자르기 — 관리자 상품 등록·수정에서 쓴다 (admin.js 가 import).
 *
 * **왜 1:1 인가.** 제품 목록 카드(`.prod-img`)와 상세 갤러리는 정사각형 자리다. 세로로 긴 병 사진을
 * 그대로 올리면 CSS 가 가운데를 잘라 보여 주고(object-fit: cover) 병목이나 상표가 잘린다 —
 * 무엇이 잘릴지는 올리는 사람이 정해야 한다. 그래서 대표·추가 사진은 정사각형이 아니면 여기서
 * 자르게 한다. 상세 사진은 본문 폭에 그대로 붙으므로 비율을 묻지 않는다.
 *
 * 쓰는 법
 *   isSquare(file)               → Promise<boolean>   (가로세로 차이 1% 이내면 정사각형으로 본다)
 *   cropSquare(file, { title })  → Promise<File|null> (null = 취소)
 *
 * 모달 껍데기는 site.js 의 rawModal/closeModal 을 빌린다 — 관리자 화면의 다른 대화상자와 같은 모양이고,
 * 닫히는 길(✕·바깥 클릭·취소)도 그쪽이 다 처리한다. 여기서는 'site:modal-closed' 신호만 듣는다.
 */
const MAX_OUT = 1600;        // 저장 크기 상한(px). 페이지 사진(resizeToFile 1600)과 같은 값
const JPEG_Q = 0.88;
const SQUARE_TOL = 0.01;     // 이 비율 안의 차이는 정사각형으로 본다

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url, w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 읽을 수 없습니다.')); };
    img.src = url;
  });
}

export async function isSquare(file) {
  const { url, w, h } = await loadImage(file);
  URL.revokeObjectURL(url);
  return Math.abs(w - h) <= SQUARE_TOL * Math.max(w, h);
}

function baseName(name) {
  return String(name || 'photo').replace(/\.[^.]+$/, '').replace(/-1x1$/, '') || 'photo';
}

/**
 * 정사각형으로 자른다. 자르는 자리는 끌어서 옮기고, 크기는 슬라이더로 줄인다(기본은 짧은 변 전체).
 * 결과는 JPEG File 하나 — 긴 변 1600px 을 넘지 않게 줄인다.
 */
export function cropSquare(file, opts) {
  const S = window.Site;
  const o = opts || {};
  if (!S || !S.rawModal) return Promise.resolve(null);

  return loadImage(file).then(({ img, url, w, h }) => new Promise((resolve) => {
    // 화면에 맞는 표시 크기 — 세로로 긴 사진이 대화상자를 넘지 않게
    const maxW = Math.min(560, Math.floor(window.innerWidth * 0.86));
    const maxH = Math.min(440, Math.floor(window.innerHeight * 0.5));
    const scale = Math.min(maxW / w, maxH / h, 1);
    const sw = Math.round(w * scale), sh = Math.round(h * scale);

    // 자르기 상자 — 이미지 픽셀 기준. side 는 한 변, (cx, cy) 는 가운데
    const minSide = Math.min(w, h);
    let side = minSide;
    let cx = w / 2, cy = h / 2;

    S.rawModal(
      '<div class="modal-head"><div><div class="eyebrow">상품 사진</div><h3>' + (o.title || '정사각형으로 자르기') + '</h3>' +
        '<p>제품 카드는 정사각형 자리입니다. 상자를 끌어 남길 부분을 정하고, 크기는 아래에서 줄일 수 있습니다.</p></div>' +
        '<button class="modal-close" data-modal-close aria-label="닫기"><i data-lucide="x"></i></button></div>' +
      '<div class="modal-body">' +
        '<div class="crop-stage" id="cropStage" style="width:' + sw + 'px;height:' + sh + 'px">' +
          '<img id="cropImg" alt="">' +
          '<div class="crop-box" id="cropBox"></div>' +
        '</div>' +
        '<div class="crop-ctl"><label for="cropSize">크기</label><input type="range" id="cropSize" min="25" max="100" value="100"><span id="cropInfo"></span></div>' +
        '<div class="modal-foot"><button type="button" class="btn btn-ghost" data-modal-close>취소</button>' +
        '<button type="button" class="btn btn-point" id="cropApply"><i data-lucide="crop"></i>이대로 자르기</button></div>' +
      '</div>', Math.max(sw + 56, 420));

    const stage = document.getElementById('cropStage');
    const box = document.getElementById('cropBox');
    const info = document.getElementById('cropInfo');
    const range = document.getElementById('cropSize');
    document.getElementById('cropImg').src = url;

    let settled = false;
    const finish = (val) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('site:modal-closed', onClosed);
      URL.revokeObjectURL(url);
      resolve(val);
    };
    const onClosed = () => finish(null);
    window.addEventListener('site:modal-closed', onClosed);

    function clamp() {
      const half = side / 2;
      cx = Math.min(Math.max(cx, half), w - half);
      cy = Math.min(Math.max(cy, half), h - half);
    }
    function paint() {
      clamp();
      const px = (cx - side / 2) * scale, py = (cy - side / 2) * scale, ps = side * scale;
      box.style.left = px + 'px'; box.style.top = py + 'px';
      box.style.width = ps + 'px'; box.style.height = ps + 'px';
      const out = Math.min(Math.round(side), MAX_OUT);
      info.textContent = w + '×' + h + ' → ' + out + '×' + out;
    }
    range.addEventListener('input', () => {
      side = Math.max(64, Math.round(minSide * Number(range.value) / 100));
      paint();
    });

    // 끌기 — 포인터 이벤트 하나로 마우스·손가락을 함께 받는다
    let drag = null;
    stage.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, cx, cy };
      stage.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    stage.addEventListener('pointermove', (e) => {
      if (!drag) return;
      cx = drag.cx + (e.clientX - drag.x) / scale;
      cy = drag.cy + (e.clientY - drag.y) / scale;
      paint();
    });
    const endDrag = () => { drag = null; };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);

    document.getElementById('cropApply').addEventListener('click', () => {
      const out = Math.min(Math.round(side), MAX_OUT);
      const c = document.createElement('canvas');
      c.width = out; c.height = out;
      c.getContext('2d').drawImage(img, Math.round(cx - side / 2), Math.round(cy - side / 2), Math.round(side), Math.round(side), 0, 0, out, out);
      c.toBlob((blob) => {
        if (!blob) { finish(null); return; }
        const cropped = new File([blob], baseName(file.name) + '-1x1.jpg', { type: 'image/jpeg' });
        // 먼저 결과를 넘기고 닫는다 — 닫힘 신호가 '취소'로 읽히지 않게
        finish(cropped);
        if (S.closeModal) S.closeModal();
      }, 'image/jpeg', JPEG_Q);
    });

    paint();
    if (S.icons) S.icons();
  }));
}
