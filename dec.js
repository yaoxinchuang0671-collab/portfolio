/* ===================================================
   装修面板交互逻辑（优化版）
   =================================================== */

(function () {
  const STORAGE_KEY = 'portfolio_data';

  // ── DOM 引用 ──────────────────────────────────────
  const decBtn     = document.getElementById('decBtn');
  const decPanel   = document.getElementById('decPanel');
  const decClose   = document.getElementById('decClose');
  const decSave    = document.getElementById('decSave');
  const decReset   = document.getElementById('decReset');

  // 字段
  const decLogo     = document.getElementById('dec-logo');
  const decNavLinks = document.getElementById('dec-navLinks');
  const decGreeting = document.getElementById('dec-greeting');
  const decName     = document.getElementById('dec-name');
  const decTitles   = document.getElementById('dec-titles');
  const decBio      = document.getElementById('dec-bio');
  const decBtn1     = document.getElementById('dec-btn1');
  const decBtn2     = document.getElementById('dec-btn2');
  const decSocialGh = document.getElementById('dec-social-gh');
  const decSocialLi = document.getElementById('dec-social-li');
  const decSocialTw = document.getElementById('dec-social-tw');
  const decFooter   = document.getElementById('dec-footer');

  // 遮罩层
  let decOverlay = document.createElement('div');
  decOverlay.className = 'dec-overlay';
  decOverlay.id = 'decOverlay';

  let decOpen = false;
  let scrollY = 0;

  // ── 打开 / 关闭面板 ──────────────────────────────────────
  function openPanel() {
    decOpen = true;
    scrollY = window.scrollY;

    // 锁定背景滚动（兼容移动端）
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + scrollY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.overflow = 'hidden';

    decPanel.classList.add('open');
    document.body.appendChild(decOverlay);
    requestAnimationFrame(function () { decOverlay.classList.add('visible'); });
    populatePanel();
  }

  function closePanel() {
    decOpen = false;
    decPanel.classList.remove('open');
    decOverlay.classList.remove('visible');

    // 恢复背景滚动
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.overflow = '';
    window.scrollTo(0, scrollY);

    setTimeout(function () {
      if (decOverlay.parentNode) decOverlay.parentNode.removeChild(decOverlay);
    }, 400);
  }

  if (decBtn)  decBtn.addEventListener('click', function () { if (!decOpen) openPanel(); });
  if (decClose) decClose.addEventListener('click', closePanel);
  decOverlay.addEventListener('click', function (e) { if (e.target === decOverlay) closePanel(); });

  // ── 填充面板（从 DOM 读取当前值）────────────────────
  function populatePanel() {
    // Logo
    var logoEl = document.querySelector('.nav-inner .logo');
    if (decLogo && logoEl) {
      var t = logoEl.textContent.replace(/[\.\s]*$/, '').trim();
      decLogo.value = t;
    }

    // 导航链接
    var navAs = document.querySelectorAll('.nav-links a');
    if (decNavLinks && navAs.length) {
      decNavLinks.value = Array.from(navAs).map(function (a) {
        return (a.textContent || '') + '|' + (a.getAttribute('href') || '#');
      }).join('\n');
    }

    // Hero
    var gEl = document.querySelector('.hero-greeting');
    if (decGreeting && gEl) decGreeting.value = gEl.textContent;

    var nEl = document.querySelector('.hero-name');
    if (decName && nEl) decName.value = nEl.textContent;

    // 打字机标题（从全局 phrases 读取）
    if (decTitles && window.phrases && window.phrases.length) {
      decTitles.value = window.phrases.join('\n');
    }

    var bioEl = document.querySelector('.hero-bio');
    if (decBio && bioEl) decBio.value = bioEl.textContent;

    var actionBtns = document.querySelectorAll('.hero-actions .btn');
    if (decBtn1 && actionBtns[0]) decBtn1.value = actionBtns[0].textContent;
    if (decBtn2 && actionBtns[1]) decBtn2.value = actionBtns[1].textContent;

    var socialLinks = document.querySelectorAll('.hero-socials .social-link');
    if (decSocialGh && socialLinks[0]) decSocialGh.value = socialLinks[0].href;
    if (decSocialLi && socialLinks[1]) decSocialLi.value = socialLinks[1].href;
    if (decSocialTw && socialLinks[2]) decSocialTw.value = socialLinks[2].href;

    // 页脚
    var footerP = document.querySelector('.footer p');
    if (decFooter && footerP) decFooter.value = footerP.textContent;
  }

  // ── 实时预览绑定 ──────────────────────────────────────
  function bindLivePreview() {
    // Logo
    if (decLogo) {
      decLogo.addEventListener('input', function () {
        var el = document.querySelector('.nav-inner .logo');
        if (el) el.innerHTML = escapeHtml(decLogo.value) + '<span class="dot">.</span>';
      });
    }

    // 打招呼
    if (decGreeting) {
      decGreeting.addEventListener('input', function () {
        var el = document.querySelector('.hero-greeting');
        if (el) el.textContent = decGreeting.value;
      });
    }

    // 姓名
    if (decName) {
      decName.addEventListener('input', function () {
        var el = document.querySelector('.hero-name');
        if (el) el.textContent = decName.value;
      });
    }

    // 打字机标题
    if (decTitles) {
      decTitles.addEventListener('input', function () {
        if (window.phrases) {
          window.phrases = decTitles.value.split('\n').filter(function (l) { return l.trim(); });
        }
      });
    }

    // 简介
    if (decBio) {
      decBio.addEventListener('input', function () {
        var el = document.querySelector('.hero-bio');
        if (el) el.textContent = decBio.value;
      });
    }

    // 按钮文字
    if (decBtn1) {
      decBtn1.addEventListener('input', function () {
        var btns = document.querySelectorAll('.hero-actions .btn');
        if (btns[0]) btns[0].textContent = decBtn1.value;
      });
    }
    if (decBtn2) {
      decBtn2.addEventListener('input', function () {
        var btns = document.querySelectorAll('.hero-actions .btn');
        if (btns[1]) btns[1].textContent = decBtn2.value;
      });
    }

    // 社交链接
    function updateSocial() {
      var links = document.querySelectorAll('.hero-socials .social-link');
      if (decSocialGh && links[0]) links[0].href = decSocialGh.value;
      if (decSocialLi && links[1]) links[1].href = decSocialLi.value;
      if (decSocialTw && links[2]) links[2].href = decSocialTw.value;
    }
    if (decSocialGh) decSocialGh.addEventListener('input', updateSocial);
    if (decSocialLi) decSocialLi.addEventListener('input', updateSocial);
    if (decSocialTw) decSocialTw.addEventListener('input', updateSocial);

    // 页脚
    if (decFooter) {
      decFooter.addEventListener('input', function () {
        var el = document.querySelector('.footer p');
        if (el) el.textContent = decFooter.value;
      });
    }

    // 导航链接
    if (decNavLinks) {
      decNavLinks.addEventListener('input', function () {
        var nav = document.querySelector('.nav-links');
        if (!nav) return;
        var lines = decNavLinks.value.split('\n').filter(function (l) { return l.trim(); });
        nav.innerHTML = lines.map(function (l) {
          var parts = l.split('|');
          var text = parts[0] || '';
          var href = parts[1] || '#';
          return '<a href="' + escapeAttr(href) + '">' + escapeHtml(text) + '</a>';
        }).join('');
      });
    }
  }

  // ── 保存 / 重置 ──────────────────────────────────────
  function collectData() {
    var data = {};

    if (decLogo && decLogo.value) data.logo = decLogo.value;

    if (decNavLinks && decNavLinks.value.trim()) {
      data.navLinks = decNavLinks.value.split('\n').filter(function (l) { return l.trim(); }).map(function (l) {
        var parts = l.split('|');
        return { text: parts[0] || '', href: parts[1] || '#' };
      });
    }

    var hero = {};
    var hasHero = false;
    if (decGreeting && decGreeting.value) { hero.greeting = decGreeting.value; hasHero = true; }
    if (decName && decName.value) { hero.name = decName.value; hasHero = true; }
    if (decTitles && decTitles.value.trim()) { hero.titles = decTitles.value.split('\n').filter(function (l) { return l.trim(); }); hasHero = true; }
    if (decBio && decBio.value) { hero.bio = decBio.value; hasHero = true; }
    if (decBtn1 && decBtn1.value) { hero.btn1 = decBtn1.value; hasHero = true; }
    if (decBtn2 && decBtn2.value) { hero.btn2 = decBtn2.value; hasHero = true; }
    var socials = [];
    if (decSocialGh && decSocialGh.value) socials.push(decSocialGh.value);
    if (decSocialLi && decSocialLi.value) socials.push(decSocialLi.value);
    if (decSocialTw && decSocialTw.value) socials.push(decSocialTw.value);
    if (socials.length) { hero.socials = socials; hasHero = true; }
    if (hasHero) data.hero = hero;

    if (decFooter && decFooter.value) data.footer = decFooter.value;

    return data;
  }

  // 保存（带容错）
  if (decSave) {
    decSave.addEventListener('click', function () {
      var data = collectData();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        showToast('✅ 已保存到本地', 'success');
        // 2 秒后自动关闭面板
        setTimeout(closePanel, 2000);
      } catch (e) {
        if (e.name === 'QuotaExceededError') {
          showToast('❌ 存储空间不足，请清理后重试', 'error');
        } else {
          showToast('❌ 保存失败：' + e.message, 'error');
        }
      }
    });
  }

  // 重置
  if (decReset) {
    decReset.addEventListener('click', function () {
      if (!confirm('确定要重置所有装修内容吗？此操作不可撤销。')) return;
      try {
        localStorage.removeItem(STORAGE_KEY);
        showToast('↺ 已重置，正在刷新…', 'info');
        setTimeout(function () { location.reload(); }, 1000);
      } catch (e) {
        showToast('❌ 重置失败：' + e.message, 'error');
      }
    });
  }

  // ── Toast 提示（优化版，支持类型）────────────────────
  function showToast(msg, type) {
    var toast = document.getElementById('dec-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'dec-toast';
      document.body.appendChild(toast);
    }

    // 根据类型设置颜色
    var bgColor = '#1e1e24';
    var textColor = '#f0f0f5';
    if (type === 'success') { bgColor = '#1a3a2a'; textColor = '#50d8a4'; }
    if (type === 'error')   { bgColor = '#3a1a1a'; textColor = '#f5816a'; }
    if (type === 'info')    { bgColor = '#1a2a3a'; textColor = '#7c6af5'; }

    toast.style.cssText = 'position:fixed;z-index:10001;' +
      'padding:10px 20px;border-radius:10px;' +
      'font-size:0.85rem;font-weight:600;' +
      'box-shadow:0 6px 24px rgba(0,0,0,0.4);' +
      'transition:opacity 0.3s,transform 0.3s;' +
      'pointer-events:none;' +
      'background:' + bgColor + ';' +
      'color:' + textColor + ';';

    toast.textContent = msg;
    // 强制回流使 transition 生效
    void toast.offsetWidth;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    // 移动端靠下居中
    if (window.innerWidth < 480) {
      toast.style.bottom = '80px';
      toast.style.left = '50%';
      toast.style.right = 'auto';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    } else {
      toast.style.bottom = '80px';
      toast.style.right = '28px';
      toast.style.left = 'auto';
      toast.style.transform = 'translateY(0)';
    }

    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transform = window.innerWidth < 480
        ? 'translateX(-50%) translateY(8px)'
        : 'translateY(8px)';
    }, 2500);
  }

  // ── 工具函数 ──────────────────────────────────────
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escapeAttr(str) {
    return escapeHtml(str);
  }

  // ── 初始化 ──────────────────────────────────────
  bindLivePreview();

})();
