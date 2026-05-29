/* ===================================================
   作品集网站 · 主交互脚本
   支持从 localStorage (key=portfolio_data) 加载装修数据
   =================================================== */

const STORAGE_KEY = 'portfolio_data';

// ── 打字机效果 ──────────────────────────────────────
const typedEl = document.getElementById('typedText');
let phrases = [
  '前端开发工程师',
  'UI/UX 设计师',
  '全栈开发者',
  '创意工作者',
];
let phraseIndex = 0;
let charIndex = 0;
let isDeleting = false;

function type() {
  const currentPhrases = window.phrases || phrases || [];
  if (!currentPhrases.length) return;
  if (phraseIndex >= currentPhrases.length) phraseIndex = 0;
  const current = currentPhrases[phraseIndex];
  if (!current) return;
  typedEl.textContent = isDeleting
    ? current.slice(0, --charIndex)
    : current.slice(0, ++charIndex);

  let delay = isDeleting ? 60 : 110;
  if (!isDeleting && charIndex === current.length) { delay = 1800; isDeleting = true; }
  else if (isDeleting && charIndex === 0) { isDeleting = false; phraseIndex = (phraseIndex + 1) % currentPhrases.length; delay = 400; }
  setTimeout(type, delay);
}

// ── 导航栏滚动 ──────────────────────────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });


// ╞═════════════════════════════════════════════
//  人物图：仅保留上传功能，去掉所有调整效果
// ╞═════════════════════════════════════════════

const imgUpload    = document.getElementById('imgUpload');
const characterImg = document.getElementById('characterImg');

// 清除人物图所有调整效果
function resetCharacterStyle() {
  if (!characterImg) return;
  characterImg.style.removeProperty('--char-scale');
  characterImg.style.removeProperty('--offset-x');
  characterImg.style.removeProperty('--offset-y');
  characterImg.style.opacity = '';
  characterImg.style.filter = '';
  characterImg.classList.remove('blend-fused');
  characterImg.classList.add('blend-natural');
}

// 图片加载完成：只标记 loaded，不做任何调整
function onImageLoaded() {
  characterImg.classList.add('loaded');
  const figurePlaceholder = document.getElementById('figurePlaceholder');
  if (figurePlaceholder) figurePlaceholder.classList.add('hidden');
  resetCharacterStyle();
}

if (characterImg) {
  if (characterImg.complete && characterImg.naturalWidth > 0) {
    onImageLoaded();
  } else {
    characterImg.addEventListener('load', onImageLoaded, { once: true });
  }
}

// 图片上传（仅换图，不调整）
if (imgUpload) {
  imgUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      characterImg.src = ev.target.result;
      characterImg.classList.add('loaded');
      const figurePlaceholder = document.getElementById('figurePlaceholder');
      if (figurePlaceholder) figurePlaceholder.classList.add('hidden');
      resetCharacterStyle();
    };
    reader.readAsDataURL(file);
  });
}


// ╞═════════════════════════════════════════════
//  从 localStorage 加载装修数据
// ╞═════════════════════════════════════════════

function loadPortfolioData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    applyPortfolioData(data);
  } catch (e) {
    console.warn('加载装修数据失败：', e);
  }
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

    const actionBtns = document.querySelectorAll('.hero-actions .btn');
    if (actionBtns[0] && h.btn1) actionBtns[0].textContent = h.btn1;
    if (actionBtns[1] && h.btn2) actionBtns[1].textContent = h.btn2;

    // 社交链接
    if (h.socials && h.socials.length) {
      const socials = document.querySelectorAll('.hero-socials .social-link');
      h.socials.forEach((s, i) => {
        if (socials[i]) socials[i].href = s || '#';
      });
    }
  }

  // 注意：人物图调整状态（character）已不再加载，保持原始效果

  // ── 页脚 ─
  if (data.footer) {
    const footerP = document.querySelector('.footer p');
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
  // 清除人物图可能存在的旧调整效果
  resetCharacterStyle();
  // 加载装修数据
  loadPortfolioData();
  type();
  navbar.classList.toggle('scrolled', window.scrollY > 20);
});

// ── 暴露给 dec.js（仅保留 phrases）────────────────────
try {
  window.phrases = phrases;
} catch(e) {}
