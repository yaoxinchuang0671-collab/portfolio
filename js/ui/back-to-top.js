/**
 * 返回顶部按钮
 * - 滚动进度环
 * - 平滑回到顶部
 */

(function () {
  'use strict';

  var backToTopBtn = document.getElementById('backToTop');
  var backToTopFill = document.querySelector('.back-to-top-fill');
  var SHOW_THRESHOLD = 300;
  var CIRCUMFERENCE = 125.6; // 2 * PI * 20

  function updateBackToTop() {
    var scrollY = window.scrollY || document.documentElement.scrollTop;

    if (backToTopBtn) {
      backToTopBtn.classList.toggle('visible', scrollY > SHOW_THRESHOLD);
    }

    if (backToTopFill) {
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        var progress = scrollY / docHeight;
        backToTopFill.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);
      }
    }
  }

  // 使用 rAF throttle 优化
  var ticking = false;
  window.addEventListener(
    'scroll',
    function () {
      if (!ticking) {
        requestAnimationFrame(function () {
          updateBackToTop();
          ticking = false;
        });
        ticking = true;
      }
    },
    { passive: true }
  );

  window.scrollToTop = function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
})();
