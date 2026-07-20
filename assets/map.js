/* ============================================================
   map.js — 오시는 길 약도 (OpenStreetMap + Leaflet)
   #osmMap 이 있는 페이지에서만 동작한다. (협동조합 소개 · 문의하기 공용)
   정확한 핀 위치는 실제 측량 후 LAT/LNG 두 값만 교체하면 된다.
   ============================================================ */
(function () {
  'use strict';

  var LAT = 37.50331, LNG = 126.88262;
  var ADDRESS = '서울특별시 구로구 구로동로 240, 세일빌딩 701호';
  var NAME = '한국참전통발효식품협동조합';

  function renderMap() {
    var mapEl = document.getElementById('osmMap');
    if (!mapEl) return;

    // Leaflet CDN이 차단된 환경(폐쇄망 등)에서도 주소는 읽히도록 폴백을 둔다
    if (!window.L) {
      mapEl.innerHTML =
        '<div style="display:flex;flex-direction:column;gap:6px;align-items:center;justify-content:center;' +
        'height:100%;min-height:280px;padding:24px;text-align:center;color:var(--ink-mute);line-height:1.6">' +
        '<b style="color:var(--ink)">지도를 불러올 수 없습니다</b><span>' + ADDRESS + '</span></div>';
      return;
    }

    var map = L.map('osmMap', { scrollWheelZoom: false, attributionControl: true }).setView([LAT, LNG], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 기여자'
    }).addTo(map);
    L.marker([LAT, LNG]).addTo(map)
      .bindPopup('<b>' + NAME + '</b><br>' + ADDRESS)
      .openPopup();
    // 페이지 스크롤을 방해하지 않도록, 지도를 한 번 클릭한 뒤에만 휠 줌을 켠다
    map.on('click', function () { map.scrollWheelZoom.enable(); });
  }

  if (document.readyState !== 'loading') renderMap();
  else document.addEventListener('DOMContentLoaded', renderMap);
})();
