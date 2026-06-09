/**
 * 导航栏交互
 * - 滚动时添加背景模糊
 * - 滚动进度条
 */

(function () {
  'use strict';

  var navbar = document.getElementById('navbar');
  var scrollProgress = document.getElementById('scrollProgress');

  function updateNavbar() {
    var sy = window.scrollY;
    if (navbar) {
      navbar.classList.toggle('scrolled', sy > 20);
    }
    if (scrollProgress) {
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var pct = docHeight > 0 ? (sy / docHeight) * 100 : 0;
      scrollProgress.style.width = pct + '%';
    }
  }

  // 使用 throttle 优化滚动性能（16ms ≈ 60fps）
  var ticking = false;
  window.addEventListener(
    'scroll',
    function () {
      if (!ticking) {
        requestAnimationFrame(function () {
          updateNavbar();
          ticking = false;
        });
        ticking = true;
      }
    },
    { passive: true }
  );

  // 初始化状态
  if (navbar) {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  }
})();
