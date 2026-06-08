/**
 * 装修数据加载与渲染
 * 从 localStorage (key=portfolio_data) 加载并应用到页面
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'portfolio_data';

  function loadPortfolioData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      applyPortfolioData(data);
    } catch (e) {
      // 静默处理解析错误
    }
  }

  function applyPortfolioData(data) {
    if (!data) return;

    // 导航栏
    if (data.logo) {
      var logo = document.querySelector('.nav-inner .logo');
      if (logo) logo.innerHTML = escapeHtml(data.logo);
    }
    if (data.navLinks && data.navLinks.length) {
      var navLinks = document.querySelector('.nav-links');
      if (navLinks) {
        navLinks.innerHTML = data.navLinks
          .map(function (l) {
            return '<a href="' + escapeAttr(l.href || '#') + '">' + escapeHtml(l.text || '') + '</a>';
          })
          .join('');
      }
    }

    // Hero 文字
    if (data.hero) {
      var h = data.hero;
      var greetingEl = document.querySelector('.hero-greeting');
      if (greetingEl) greetingEl.textContent = h.greeting || '';

      var nameEl = document.querySelector('.hero-name');
      if (nameEl) {
        nameEl.textContent = h.name || '';
        nameEl.setAttribute('data-text', h.name || '');
      }

      if (h.titles && h.titles.length) {
        window.phrases = h.titles;
        var typedWrap = document.getElementById('typedWrap');
        if (typedWrap) typedWrap.textContent = '';
      }

      var bioEl = document.querySelector('.hero-bio');
      if (bioEl) bioEl.textContent = h.bio || '';

      var actionBtns = document.querySelectorAll('.hero-actions .btn-tech');
      if (actionBtns[0] && h.btn1) actionBtns[0].textContent = h.btn1;
      if (actionBtns[1] && h.btn2) actionBtns[1].textContent = h.btn2;
    }

    // 页脚
    if (data.footer) {
      var footerP = document.querySelector('.footer-copy') || document.querySelector('.site-end');
      if (footerP) footerP.textContent = data.footer;
    }
  }

  // 兼容全局暴露
  window.loadPortfolioData = loadPortfolioData;
  window.applyPortfolioData = applyPortfolioData;
})();
