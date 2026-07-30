/* ============================================================
   jump.js — 긴 페이지의 섹션 이동 바(.jump) 현재 위치 표시
   .jump a[href^="#"] 가 가리키는 섹션이 화면에 들어오면 해당 링크에 .on 을 준다.
   ============================================================ */
(function () {
  'use strict';

  function initJumpNav() {
    var bar = document.querySelector('.jump');
    if (!bar) return;

    var links = [].slice.call(bar.querySelectorAll('a[href^="#"]'));
    if (!links.length) return;

    var targets = links
      .map(function (a) {
        var el = document.getElementById(a.getAttribute('href').slice(1));
        return el ? { link: a, section: el } : null;
      })
      .filter(Boolean);
    if (!targets.length) return;

    function setActive(entry) {
      links.forEach(function (a) { a.classList.remove('on'); });
      entry.link.classList.add('on');
      // 활성 항목이 가로 스크롤 밖에 있으면 보이도록 당겨온다 (모바일)
      var row = entry.link.parentElement;
      if (row && row.scrollWidth > row.clientWidth) {
        var l = entry.link.offsetLeft, w = entry.link.offsetWidth;
        row.scrollTo({ left: l - (row.clientWidth - w) / 2, behavior: 'smooth' });
      }
    }

    // 섹션 상단이 이동 바 바로 아래를 지날 때를 기준으로 판정
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var hit = targets.filter(function (t) { return t.section === e.target; })[0];
        if (hit) setActive(hit);
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    targets.forEach(function (t) { observer.observe(t.section); });
  }

  if (document.readyState !== 'loading') initJumpNav();
  else document.addEventListener('DOMContentLoaded', initJumpNav);
})();
