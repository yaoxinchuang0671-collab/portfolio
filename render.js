/* ==================================================
   从 data.json 加载数据并渲染页面（含分类筛选）
   ================================================== */
(async function () {
  let DATA = {};

  // ---------- 默认数据（无案例作品） ----------
  const DEFAULT_DATA = {
    hero: {
      greeting: '你好，我是',
      name: '你的名字',
      typedTexts: ['UI/UX 设计师', '前端开发者', '数字产品设计师'],
      bio: '这里是一段简短的自我介绍，描述你的专业方向、热情所在，以及你能带来的价值。'
    },
    categories: [
      { id: 'cat1', label: '分类一' },
      { id: 'cat2', label: '分类二' },
      { id: 'cat3', label: '分类三' },
      { id: 'cat4', label: '分类四' }
    ],
    works: [] // 默认无案例作品
  };

  // ---------- 加载数据（data.json 为基准 + localStorage 补丁覆盖）----------
  const STORAGE_KEY = 'portfolio_data';

  async function loadData() {
    // 1. 始终先从 data.json 加载完整数据作为基准
    let serverData = null;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(function () { ctrl.abort(); }, 2000);
      const res = await fetch('data.json?t=' + Date.now(), { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) {
        serverData = await res.json();
        console.log('[render] data.json 加载成功（基准数据）');
      }
    } catch (e) {
      console.warn('[render] data.json 不可用:', e.message);
    }

    // 2. 读取 localStorage 作为补丁
    let localData = null;
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        localData = JSON.parse(stored);
        console.log('[render] localStorage 数据读取成功（补丁数据）');
      }
    } catch (e) {
      console.warn('[render] localStorage 数据解析失败');
      localStorage.removeItem(STORAGE_KEY);
    }

    // 3. 合并策略：data.json 始终优先，localStorage 只补填空字段
    if (serverData) {
      DATA = serverData;

      // 版本检测：data.json  version > 本地缓存版本时，自动清除过期 localStorage
      if (serverData.version) {
        var localVer = parseInt(localStorage.getItem('portfolio_version') || '0', 10);
        if (serverData.version > localVer) {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.setItem('portfolio_version', String(serverData.version));
          console.log('[render] 检测到 data.json 版本更新(v' + localVer + '→v' + serverData.version + ')，已自动清除过期缓存');
          localData = null; // 跳过本次 localStorage 合并
        }
      }

      if (localData) {
        // hero：只补填 data.json 中为空的字段
        if (localData.hero && DATA.hero) {
          var lh = localData.hero;
          if (DATA.hero.greeting == null && lh.greeting != null) DATA.hero.greeting = lh.greeting;
          if (DATA.hero.name == null && lh.name != null) DATA.hero.name = lh.name;
          if (DATA.hero.bio == null && lh.bio != null) DATA.hero.bio = lh.bio;
          if ((!DATA.hero.typedTexts || DATA.hero.typedTexts.length === 0) && Array.isArray(lh.typedTexts)) {
            DATA.hero.typedTexts = lh.typedTexts;
          }
        }
        // 分类：按 id 合并，data.json 字段优先（已有逻辑正确）
        if (localData.categories && localData.categories.length > 0 && DATA.categories) {
          var serverCats = {};
          DATA.categories.forEach(function(c) { serverCats[c.id] = c; });
          localData.categories.forEach(function(lc) {
            if (serverCats[lc.id]) {
              Object.keys(lc).forEach(function(k) {
                if (serverCats[lc.id][k] == null) serverCats[lc.id][k] = lc[k];
              });
            } else {
              DATA.categories.push(lc);
            }
          });
        }
        // 作品：按 id 合并，data.json 字段优先（已有逻辑正确）
        if (localData.works && localData.works.length > 0 && DATA.works) {
          var serverWorks = {};
          DATA.works.forEach(function(w) { serverWorks[w.id] = w; });
          localData.works.forEach(function(lw) {
            if (serverWorks[lw.id]) {
              Object.keys(lw).forEach(function(k) {
                if (serverWorks[lw.id][k] == null) serverWorks[lw.id][k] = lw[k];
              });
            } else {
              DATA.works.push(lw);
            }
          });
        }
        // logo/navLinks/footer：data.json 有值时不覆盖
        if (localData.logo && !DATA.logo) DATA.logo = localData.logo;
        if (localData.navLinks && (!DATA.navLinks || DATA.navLinks.length === 0)) DATA.navLinks = localData.navLinks;
        if (localData.footer && !DATA.footer) DATA.footer = localData.footer;
        console.log('[render] 数据合并完成: data.json(优先) + localStorage(仅补空)');
      } else {
        console.log('[render] 仅使用 data.json 数据');
      }
    } else {
      // data.json 不可用 → localStorage → 内联 → 默认
      if (localData) {
        DATA = localData;
        console.log('[render] 使用 localStorage 数据（data.json 不可用）');
      } else {
        console.warn('无法加载 data.json，使用内联默认数据。');
        const inline = document.getElementById('inlineData');
        if (inline) {
          try { DATA = JSON.parse(inline.textContent); console.log('[render] 使用内联数据'); return; } catch(e2) {}
        }
        DATA = JSON.parse(JSON.stringify(DEFAULT_DATA));
      }
    }
  }

  // ---------- 渲染 Hero ----------
  function renderHero() {
    const h = DATA.hero;
    if (!h) return;
    const elGreeting = document.getElementById('heroGreeting');
    const elName     = document.getElementById('heroName');
    const elBio      = document.getElementById('heroBio');
    if (elGreeting) elGreeting.textContent = h.greeting || '';
    if (elName)     elName.textContent     = h.name || '';
    if (elBio)      elBio.textContent      = h.bio || '';

    // 背景图 — 根据图片真实比例自适应卡片高度
    const heroCard   = document.getElementById('heroCard');
    const heroCardBg = document.getElementById('heroCardBg');
    if (heroCardBg) {
      if (h.bg) {
        heroCardBg.style.backgroundImage = 'url("' + h.bg + '")';
        setHeroHeightFromImage(h.bg);
      } else {
        heroCardBg.style.backgroundImage = '';
        if (heroCard) { heroCard.style.height = ''; }
      }
    }

    // 打字机效果（完全重写，稳定可靠）
    const typedWrap = document.getElementById('typedWrap');
    if (typedWrap && Array.isArray(h.typedTexts) && h.typedTexts.length > 0) {
      const texts = h.typedTexts;
      let ti = 0;   // 当前词索引
      let ci = 0;   // 当前字符位置（0 = 还没开始打）
      let isDeleting = false;
      let timer = null;

      // 确保容器为空
      typedWrap.textContent = '';

      function step() {
        const cur = texts[ti];

        if (!isDeleting) {
          // —— 打字阶段 ——
          ci++;
          typedWrap.textContent = cur.slice(0, ci);

          if (ci === cur.length) {
            // 打完一个完整词，等待后开始删除
            isDeleting = true;
            timer = setTimeout(step, 2000);
            return;
          }
          timer = setTimeout(step, 200);
        } else {
          // —— 删除阶段 ——
          ci--;
          typedWrap.textContent = cur.slice(0, ci);

          if (ci === 0) {
            // 全部删除完毕，切换到下一个词
            isDeleting = false;
            ti = (ti + 1) % texts.length;
            timer = setTimeout(step, 600);
            return;
          }
          timer = setTimeout(step, 100);
        }
      }

      // 等待 hero 动画结束后开始（约 1 秒后）
      timer = setTimeout(step, 1200);
    }
  }

  // ---------- Hero 背景图高度自适应 ----------
  let heroBgAspectRatio = null;
  let heroResizeTimer = null;

  function setHeroHeightFromImage(bgPath) {
    const heroCard = document.getElementById('heroCard');
    if (!heroCard || !bgPath) return;

    var img = new Image();
    img.onload = function() {
      heroBgAspectRatio = img.naturalHeight / img.naturalWidth;
      applyHeroHeight();
    };
    img.onerror = function() {
      // 图片加载失败，恢复默认高度
      heroCard.style.height = '';
      heroBgAspectRatio = null;
    };
    img.src = bgPath;
  }

  function applyHeroHeight() {
    var heroCard = document.getElementById('heroCard');
    if (!heroCard || !heroBgAspectRatio) return;
    var w = heroCard.offsetWidth;
    heroCard.style.height = Math.round(w * heroBgAspectRatio) + 'px';
  }

  window.addEventListener('resize', function() {
    clearTimeout(heroResizeTimer);
    heroResizeTimer = setTimeout(function() {
      if (heroBgAspectRatio) applyHeroHeight();
    }, 150);
  });

  // ---------- 渲染导航链接 ----------
  function renderNav() {
    var navEl = document.querySelector('.nav-links');
    if (!navEl) return;
    navEl.innerHTML = '';

    var links = DATA.navLinks;
    if (!Array.isArray(links) || links.length === 0) return;

    links.forEach(function(link) {
      var a = document.createElement('a');
      a.href = '#';  // 阻止跳转
      a.textContent = link.text || '';

      if (link.image) {
        // 有图片 → 点击弹出图片弹窗
        (function(imgSrc, titleText) {
          a.addEventListener('click', function(e) {
            e.preventDefault();
            openNavImgModal(imgSrc, titleText);
          });
        })(link.image, link.text);
      } else if (link.href && link.href !== '#') {
        // 无图片但有锚点 → 滚动到锚点
        (function(href) {
          a.addEventListener('click', function(e) {
            e.preventDefault();
            var target = document.querySelector(href);
            if (target) target.scrollIntoView({ behavior: 'smooth' });
          });
        })(link.href);
      }

      navEl.appendChild(a);
    });
  }

  // ---------- 导航图片弹窗 ----------
  function openNavImgModal(imgSrc, title) {
    var overlay = document.getElementById('navImgOverlay');
    var img     = document.getElementById('navImgModal');
    var ttl     = document.getElementById('navImgTitle');
    if (!overlay || !img) return;
    img.src = imgSrc;
    if (ttl) ttl.textContent = title || '';
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeNavImgModal() {
    var overlay = document.getElementById('navImgOverlay');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
  }



  // ---------- 渲染分类筛选栏 ----------
  function renderCategories() {
    const bar = document.getElementById('filterBar');
    if (!bar || !Array.isArray(DATA.categories)) return;
    bar.innerHTML = '';

    // 全部按钮
    const allBtn = document.createElement('button');
    allBtn.className = 'filter-btn active';
    allBtn.dataset.filter = 'all';
    allBtn.textContent = '全部';
    bar.appendChild(allBtn);

    // 统计每个分类下的作品数量
    var catWorkCounts = {};
    if (Array.isArray(DATA.works)) {
      DATA.works.forEach(function(w) {
        var cat = w.category || '';
        if (cat) catWorkCounts[cat] = (catWorkCounts[cat] || 0) + 1;
      });
    }

    // 只显示有作品的分类按钮
    DATA.categories.forEach(function(cat) {
      if (!catWorkCounts[cat.id]) return; // 无作品，跳过
      const btn = document.createElement('button');
      btn.className = 'filter-btn';
      btn.dataset.filter = cat.id;
      btn.textContent = cat.label;
      bar.appendChild(btn);
    });
  }

  // ---------- 渲染作品瀑布流 ----------
  function renderWorks() {
    const wf = document.getElementById('waterfall');
    if (!wf || !Array.isArray(DATA.works)) return;
    wf.innerHTML = '';
    DATA.works.forEach((w, idx) => {
      const div = document.createElement('div');
      div.className = 'waterfall-item';
      div.dataset.caption = w.caption || '';
      div.dataset.category = w.category || '';
      div.dataset.order = String(idx);

      // 前 KEY_COUNT 张立即加载（首屏可见），其余懒加载
      var isKey = idx < KEY_COUNT;
      var loadingAttr = isKey
        ? 'loading="eager" fetchpriority="high"'
        : 'loading="lazy"';

      div.innerHTML = `
        <img src="${w.src}" alt="${w.caption || ''}" ${loadingAttr} />
        <div class="item-overlay">
          <span class="item-caption">${w.caption || ''}</span>
          <button class="item-zoom" aria-label="查看大图">&#11170;</button>
        </div>`;
      wf.appendChild(div);
    });
    // 重新绑定图片点击（lightbox）
    if (typeof bindNewItems === 'function') bindNewItems();
    // 首次 masonry，再等图片加载完精确重排
    requestAnimationFrame(function () {
      if (typeof window.applyMasonry === 'function') window.applyMasonry();
      if (typeof window.waitImagesAndReflow === 'function') window.waitImagesAndReflow();
    });
  }

  // ---------- 分类筛选逻辑（内置，确保在渲染后绑定） ----------
  function initFilter() {
    const filterBar = document.getElementById('filterBar');
    const waterfall = document.getElementById('waterfall');
    if (!filterBar || !waterfall) return;

    filterBar.addEventListener('click', function (e) {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;

      // 切换 active 高亮状态
      filterBar.querySelectorAll('.filter-btn').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');

      // 获取筛选分类
      const cat = btn.dataset.filter;
      const items = waterfall.querySelectorAll('.waterfall-item');

      items.forEach(function (item) {
        if (cat === 'all' || item.dataset.category === cat) {
          // 显示
          item.style.display = '';

          // 强制重新播放 GIF/WebP 动图：cloneNode 替换（图片已预加载，秒开）
          var img = item.querySelector('img');
          if (img) {
            var src = img.getAttribute('src') || img.src;
            var baseSrc = src.split('?')[0];
            if (baseSrc.match(/\.(gif|webp)(\?|$)/i)) {
              var clone = img.cloneNode(true);
              clone.src = baseSrc;  // 不用 cache-buster，浏览器从预加载缓存服务
              img.parentNode.replaceChild(clone, img);
            }
          }

          item.style.opacity = '0';
          item.style.transform = 'translateY(16px) scale(0.96)';
          requestAnimationFrame(function () {
            item.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            item.style.opacity = '1';
            item.style.transform = 'translateY(0) scale(1)';
          });
        } else {
          // 隐藏
          item.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
          item.style.opacity = '0';
          item.style.transform = 'translateY(8px) scale(0.98)';
          setTimeout(function () {
            item.style.display = 'none';
          }, 250);
        }
      });

      // 筛选动画完成后 masonry 重排
      setTimeout(function () {
        if (typeof window.applyMasonry === 'function') window.applyMasonry();
        if (typeof window.waitImagesAndReflow === 'function') window.waitImagesAndReflow();
      }, 260);
    });
  }

  // ---------- 预加载动图（加速切换分类） ----------
  function preloadAnimatedImages() {
    var imgs = document.querySelectorAll('.waterfall-item img');
    var preloaded = 0;
    imgs.forEach(function (img) {
      var src = img.getAttribute('src') || img.src;
      var baseSrc = src.split('?')[0];
      if (baseSrc.match(/\.(gif|webp)(\?|$)/i)) {
        // 创建一个隐藏的 Image 对象预加载到浏览器缓存
        var preloader = new Image();
        preloader.src = baseSrc;
        preloader.onload = function () {
          preloaded++;
          // console.log('[preload] ' + baseSrc + ' ready');
        };
        preloader.onerror = function () {
          // console.log('[preload] failed: ' + baseSrc);
        };
      }
    });
  }

  // ---------- 预加载关键图片（首屏可见） ----------
  function preloadImages(urls, onProgress) {
    return new Promise(function(resolve) {
      var loaded = 0;
      var total = urls.length;
      if (total === 0) { resolve(); return; }
      urls.forEach(function(url) {
        var img = new Image();
        img.onload = img.onerror = function() {
          loaded++;
          if (onProgress) onProgress(Math.round(loaded / total * 100));
          if (loaded >= total) resolve();
        };
        img.src = url;
      });
    });
  }

  // ---------- 在 <head> 动态插入 preload link ----------
  function addPreloadLink(href, asType) {
    if (!href) return;
    var id = 'preload-' + href.replace(/[^a-zA-Z0-9]/g, '_');
    if (document.getElementById(id)) return;
    var link = document.createElement('link');
    link.id = id;
    link.rel = 'preload';
    link.as = asType || 'image';
    link.href = href;
    document.head.appendChild(link);
  }

  // ═══════════════════════════════════════════════════
  // 主流程：先加载数据 → 预加载关键图片 → 完成后渲染
  // ═══════════════════════════════════════════════════
  await loadData();

  // 收集关键图片（hero 背景 + 前 8 张作品 = 首屏可见）
  var KEY_COUNT = 8;
  var keyUrls = [];
  if (DATA.hero && DATA.hero.bg) {
    keyUrls.push(DATA.hero.bg);
    addPreloadLink(DATA.hero.bg, 'image');
  }
  if (Array.isArray(DATA.works)) {
    DATA.works.slice(0, KEY_COUNT).forEach(function(w) {
      if (w.src) keyUrls.push(w.src);
    });
  }

  // 预加载关键图片 + 更新进度条 + 5 秒超时兜底
  var preloadDone = false;
  var preloadTimeout = setTimeout(function() {
    if (!preloadDone) {
      preloadDone = true;
      if (typeof window.hidePreloader === 'function') window.hidePreloader();
      startRender();
    }
  }, 5000);  // 最多等 5 秒

  if (typeof window.updatePreloader === 'function') {
    window.updatePreloader(0, '正在加载作品…');
  }

  preloadImages(keyUrls, function(pct) {
    if (typeof window.updatePreloader === 'function') {
      window.updatePreloader(pct, '\u52A0\u8F7D\u4E2D ' + pct + '%');
    }
  }).then(function() {
    if (preloadDone) return;
    preloadDone = true;
    clearTimeout(preloadTimeout);
    if (typeof window.hidePreloader === 'function') window.hidePreloader();
    startRender();
  });

  // 预加载完成后才开始渲染
  function startRender() {
    renderNav();
    renderHero();
    renderCategories();
    renderWorks();
    // 预加载所有动图到浏览器缓存（加速切换分类）
    preloadAnimatedImages();
    setTimeout(preloadAnimatedImages, 2000);
    initFilter();
  }
})();
