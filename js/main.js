/**
 * 主入口文件 — 干净版本
 * 自然滚动，无滚轮拦截/吸附
 */

(function () {
  'use strict';

  window.addEventListener('DOMContentLoaded', function () {
    // 1. 加载装修数据
    if (typeof loadPortfolioData === 'function') {
      loadPortfolioData();
    }

    // 2. 初始化粒子背景
    if (typeof initParticles === 'function') {
      initParticles();
    }

    // 3. 滚动触发动画
    if (typeof setupScrollReveal === 'function') {
      setupScrollReveal();
    }
  });
})();
