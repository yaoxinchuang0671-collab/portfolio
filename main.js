/* ===================================================
   作品集网站 · 主交互脚本
   支持从 localStorage (key=portfolio_data) 加载装修数据
   注意：打字机效果和 Hero 渲染已由 render.js 接管
   =================================================== */

const STORAGE_KEY = 'portfolio_data';

// ── 导航栏滚动 + 进度条 ─────────────────────────────
const navbar = document.getElementById('navbar');
var scrollProgress = document.getElementById('scrollProgress');
window.addEventListener('scroll', () => {
  var sy = window.scrollY;
  navbar.classList.toggle('scrolled', sy > 20);
  // 更新滚动进度条
  if (scrollProgress) {
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    var pct = docHeight > 0 ? (sy / docHeight) * 100 : 0;
    scrollProgress.style.width = pct + '%';
  }
}, { passive: true });


// ╞═════════════════════════════════════════════
//  从 localStorage 加载装修数据
// ╞═════════════════════════════════════════════

function loadPortfolioData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    applyPortfolioData(data);
  } catch (e) {}
}

function applyPortfolioData(data) {
  if (!data) return;

  // ── 导航栏 ─
  if (data.logo) {
    const logo = document.querySelector('.nav-inner .logo');
    if (logo) logo.innerHTML = escapeHtml(data.logo);
  }
  if (data.navLinks && data.navLinks.length) {
    const navLinks = document.querySelector('.nav-links');
    if (navLinks) {
      navLinks.innerHTML = data.navLinks.map(l =>
        `<a href="${escapeAttr(l.href || '#')}">${escapeHtml(l.text || '')}</a>`
      ).join('');
    }
  }

  // ── Hero 文字 ─
  if (data.hero) {
    const h = data.hero;
    const greetingEl = document.querySelector('.hero-greeting');
    if (greetingEl) greetingEl.textContent = h.greeting || '';

    const nameEl = document.querySelector('.hero-name');
    if (nameEl) nameEl.textContent = h.name || '';

    if (h.titles && h.titles.length) {
      phrases = h.titles;
      window.phrases = phrases;
      if (typedEl) typedEl.textContent = '';
    }

    const bioEl = document.querySelector('.hero-bio');
    if (bioEl) bioEl.textContent = h.bio || '';

    const actionBtns = document.querySelectorAll('.hero-actions .btn-tech');
    if (actionBtns[0] && h.btn1) actionBtns[0].textContent = h.btn1;
    if (actionBtns[1] && h.btn2) actionBtns[1].textContent = h.btn2;
  }

  // ── 页脚 ─
  if (data.footer) {
    const footerP = document.querySelector('.footer-copy');
    if (footerP) footerP.textContent = data.footer;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return escapeHtml(str);
}


// ── 初始化 ──────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // 加载装修数据
  loadPortfolioData();
  navbar.classList.toggle('scrolled', window.scrollY > 20);

  // 初始化粒子背景
  initParticles();

  // 滚动触发动画
  setupScrollReveal();
});

// ── Hero 粒子背景 ───────────────────────────────────
function initParticles() {
  var canvas = document.getElementById('heroParticles');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W, H;
  var particles = [];
  var mouse = { x: null, y: null };
  var isActive = true;

  function resize() {
    var hero = document.getElementById('home');
    if (!hero) return;
    W = canvas.width = hero.offsetWidth;
    H = canvas.height = hero.offsetHeight;
  }

  function createParticles() {
    particles = [];
    var count = Math.min(80, Math.floor((W * H) / 12000));
    for (var i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 1.5 + 0.5,
        color: Math.random() > 0.5 ? 'rgba(0,240,255,' : 'rgba(157,141,245,'
      });
    }
  }

  function draw() {
    if (!isActive) return;
    ctx.clearRect(0, 0, W, H);

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      // 鼠标交互：轻微磁吸
      if (mouse.x !== null) {
        var dx = mouse.x - p.x;
        var dy = mouse.y - p.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
          p.vx += dx * 0.00005;
          p.vy += dy * 0.00005;
        }
      }
      p.x += p.vx;
      p.y += p.vy;
      // 边界反弹
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
      // 速度衰减
      p.vx *= 0.99;
      p.vy *= 0.99;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color + (0.3 + Math.random() * 0.2) + ')';
      ctx.fill();
    }

    // 连线
    for (var i = 0; i < particles.length; i++) {
      for (var j = i + 1; j < particles.length; j++) {
        var dx = particles[i].x - particles[j].x;
        var dy = particles[i].y - particles[j].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = 'rgba(0,240,255,' + (0.08 * (1 - dist / 150)) + ')';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(draw);
  }

  resize();
  createParticles();
  draw();

  window.addEventListener('resize', function() {
    resize();
    createParticles();
  });

  canvas.addEventListener('mousemove', function(e) {
    var rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  canvas.addEventListener('mouseleave', function() {
    mouse.x = null;
    mouse.y = null;
  });

  // 页面不可见时暂停
  document.addEventListener('visibilitychange', function() {
    isActive = !document.hidden;
    if (isActive) draw();
  });
}

function setupScrollReveal() {
  var revealEls = document.querySelectorAll('.reveal, .fade-up, .fade-scale');
  if (!revealEls.length) return;

  function markVisible(el) {
    el.classList.add('visible');
  }

  // 初始化：立即标记已在视口内的元素
  revealEls.forEach(function(el) {
    var rect = el.getBoundingClientRect();
    var winH = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top < winH && rect.bottom > 0) {
      markVisible(el);
    }
  });

  // IntersectionObserver 监听后续进入视口的元素
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        markVisible(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -40px 0px', threshold: 0.05 });

  revealEls.forEach(function(el) {
    if (!el.classList.contains('visible')) {
      observer.observe(el);
    }
  });
}

// ── 返回顶部 ──────────────────────────────────────
var backToTopBtn = document.getElementById('backToTop');
var backToTopFill = document.querySelector('.back-to-top-fill');
var scrollDocHeight = 0;

function updateBackToTop() {
  var scrollY = window.scrollY || document.documentElement.scrollTop;
  var showThreshold = 120; // 调低阈值，进入分类栏区域即显示

  // 右下角按钮
  if (backToTopBtn) {
    backToTopBtn.classList.toggle('visible', scrollY > showThreshold);
  }

  // 进度环
  if (backToTopFill) {
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight > 0) {
      var progress = scrollY / docHeight;
      var circumference = 125.6; // 2 * PI * 20
      backToTopFill.style.strokeDashoffset = circumference * (1 - progress);
    }
  }
}

window.addEventListener('scroll', updateBackToTop, { passive: true });

window.scrollToTop = function() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

