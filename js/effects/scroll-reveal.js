/**
 * 滚动触发动画（ScrollReveal）
 * 使用 IntersectionObserver 实现高性能滚动动画
 */

(function () {
  'use strict';

  var observer = null;

  function markVisible(el) {
    el.classList.add('visible');
  }

  function setupScrollReveal() {
    // 清理旧的 observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    var revealEls = document.querySelectorAll('.reveal, .fade-up, .fade-scale');
    if (!revealEls.length) return;

    // 初始化：立即标记已在视口内的元素
    revealEls.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      var winH = window.innerHeight || document.documentElement.clientHeight;
      if (rect.top < winH && rect.bottom > 0) {
        markVisible(el);
      }
    });

    // IntersectionObserver 监听后续进入视口的元素
    observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            markVisible(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -40px 0px', threshold: 0.05 }
    );

    revealEls.forEach(function (el) {
      if (!el.classList.contains('visible')) {
        observer.observe(el);
      }
    });
  }

  // 暴露 cleanup 接口（供动态内容更新时调用）
  window.setupScrollReveal = setupScrollReveal;
  window._cleanupScrollReveal = function () {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  };
})();
