/* ==================================================
   从 data.json 加载数据并渲染页面（含分类筛选）
   ================================================== */
(async function () {
  let DATA = {};

  // ── 渲染状态 ─────────────────────────────
  let currentFilter  = 'all';
  const KEY_COUNT    = 4;           // 前 4 张 eager 加载

  // ── 分类隔离渲染缓存 ────────────────────────
  // 点击分类时只保留该分类节点在 DOM 中，其他分类从文档移除但保留引用
  var _allNodesCache   = null;  // 全部作品节点的引用数组
  var _currentCatNodes = null;  // 当前分类的节点数组

  // ── 后台预加载队列 ──────────────────────────
  var _preloadQueue    = [];      // 预加载分类队列 [{catId, nodes, priority}]
  var _isPreloading    = false;   // 是否正在后台预加载
  var _preloadAbort    = false;   // 切换分类时中止当前预加载
  var _preloadPhase    = 'first'; // 预加载阶段：'first' = 每分类前7张, 'rest' = 剩余全部

  // ── CDN 配置（图片加速） ───────────────────────────
  const CDN_BASE = 'https://portfolio-images-1438664071.cos.ap-guangzhou.myqcloud.com/';
  const IS_LOCAL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '119.91.147.180');

  /** 将本地图片路径转为 CDN URL（如果 CDN_BASE 已配置） */
  function toCdnUrl(src) {
    if (!CDN_BASE || !src) return src;
    // 本地预览不走 CDN，避免新文件未上传导致 404
    if (IS_LOCAL) return src;
    // 已经是完整 URL，直接返回
    if (src.substring(0, 7) === 'http://' || src.substring(0, 8) === 'https://') return src;
    // 移除开头的 ./  前缀
    // （全部用字符串操作，不用正则，避免 build.py minify 对 // 的误处理）
    var clean = src;
    if (clean.substring(0, 2) === './' || clean.substring(0, 2) === '.\\') clean = clean.substring(2);
    // data.json 存 img/xxx.webp，COS 上对应 portfolio/xxx.webp
    if (clean.substring(0, 4) === 'img/' || clean.substring(0, 4) === 'img\\') {
      clean = 'portfolio/' + clean.substring(4);
    }
    return CDN_BASE + clean;
  }
  // 暴露给 gallery.js（灯箱预览也需要 CDN URL）
  window.toCdnUrl = toCdnUrl;

  // ── 动图标记（15 张多帧 WebP） ──────────────────────
  var ANIMATED_SET = {};
  [
    'img/01电竞俱乐部_1780440296230.webp',
    'img/024电竞_1780440300814.webp',
    'img/今彩电竞_1780440348444.webp',
    'img/四风电竞俱乐部_1780440373519.webp',
    'img/小狐白电竞_1780440380593.webp',
    'img/星禾互娱电竞_1780440396593.webp',
    'img/源初电竞_1780440403613.webp',
    'img/白苏电竞_1780440321108.webp',
    'img/肥撤电竞_1780440345982.webp',
    'img/菠萝电竞_1780440341774.webp',
    'img/落魄山电竞俱乐部_1780440362450.webp',
    'img/金凰电竞_1780440350647.webp',
    'img/饱了么电竞_1780440336841.webp',
    'img/香蕉电竞_1780440374283.webp',
    'img/魔龙电竞_1780440368311.webp'
  ].forEach(function(f) { ANIMATED_SET[f] = true; });

  /** 获取动图的缩略图路径：img/xxx.webp → img/thumb_xxx.webp */
  function thumbPath(src) {
    var i = Math.max(src.lastIndexOf('/'), src.lastIndexOf('\\'));
    if (i < 0) return 'thumb_' + src;
    return src.substring(0, i + 1) + 'thumb_' + src.substring(i + 1);
  }

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
          localData = null;
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
        // contact：优先以 localStorage 为准（因为 contact 是用户实时编辑的小数据）
        // 如果 localStorage 中有 contact.qrText，而 data.json 中的为空，则用 localStorage 覆盖
        if (localData.contact) {
          var hasLocalQr = (localData.contact.qrText || '').trim().length > 0 ||
                           (localData.contact.qrImage || '').length > 0;
          var hasServerQr = DATA.contact && ((DATA.contact.qrText || '').trim().length > 0 ||
                                              (DATA.contact.qrImage || '').length > 0);
          if (hasLocalQr || !hasServerQr) {
            DATA.contact = JSON.parse(JSON.stringify(localData.contact));
          }
        }
        // 无论来源，同步到弹窗专用缓存
        if (DATA.contact) {
          try { localStorage.setItem('portfolio_data_contact', JSON.stringify(DATA.contact)); } catch(e) {}
        }
      } else {
        // data.json 加载成功但无 localStorage：同步 contact 到 localStorage 供弹窗读取
        if (DATA.contact) {
          try { localStorage.setItem('portfolio_data_contact', JSON.stringify(DATA.contact)); } catch(e) {}
        }
      }
    } else {
      // data.json 不可用 → localStorage → 内联 → 默认
      if (localData) {
        DATA = localData;
      } else {
        console.warn('无法加载 data.json，使用内联默认数据。');
        const inline = document.getElementById('inlineData');
        if (inline) {
          try { DATA = JSON.parse(inline.textContent); return; } catch(e2) {}
        }
        DATA = JSON.parse(JSON.stringify(DEFAULT_DATA));
      }
    }
  }

  // ---------- 渲染 Hero ----------
  var _typeTimer = null; // 打字机 timer 引用，用于 cleanup

  function renderHero() {
    const h = DATA.hero;
    if (!h) return;
    const elGreeting = document.getElementById('heroGreeting');
    const elName     = document.getElementById('heroName');
    const elBio      = document.getElementById('heroBio');
    if (elGreeting) elGreeting.textContent = h.greeting || '';
    if (elName)     elName.textContent     = h.name || '';
    if (elName)     elName.setAttribute('data-text', h.name || '');
    if (elBio)      elBio.textContent      = h.bio || '';

    // 视频背景（优先于渐变背景）
    const heroVideo = document.getElementById('heroVideo');
    const heroOverlay = document.getElementById('heroOverlay');
    const heroSection = document.getElementById('home');
    if (heroVideo && heroOverlay && heroSection) {
      if (h.video) {
        heroVideo.src = toCdnUrl(h.video);
        heroVideo.style.display = 'block';
        heroOverlay.style.display = 'block';
        heroSection.style.animation = 'none';
        heroSection.style.background = 'none';
      } else {
        heroVideo.style.display = 'none';
        heroVideo.src = '';
        heroOverlay.style.display = 'none';
        heroSection.style.animation = '';
        heroSection.style.background = '';
      }
    }

    // 打字机效果（带 cleanup，防止重复调用时多个 timer 冲突）
    const typedWrap = document.getElementById('typedWrap');
    if (typedWrap && Array.isArray(h.typedTexts) && h.typedTexts.length > 0) {
      // 清除旧 timer
      if (_typeTimer) {
        clearTimeout(_typeTimer);
        _typeTimer = null;
      }

      const texts = h.typedTexts;
      let ti = 0;
      let ci = 0;
      let isDeleting = false;

      // 确保容器为空
      typedWrap.textContent = '';

      function step() {
        const cur = texts[ti];

        if (!isDeleting) {
          ci++;
          typedWrap.textContent = cur.slice(0, ci);

          if (ci === cur.length) {
            isDeleting = true;
            _typeTimer = setTimeout(step, 2000);
            return;
          }
          _typeTimer = setTimeout(step, 200);
        } else {
          ci--;
          typedWrap.textContent = cur.slice(0, ci);

          if (ci === 0) {
            isDeleting = false;
            ti = (ti + 1) % texts.length;
            _typeTimer = setTimeout(step, 600);
            return;
          }
          _typeTimer = setTimeout(step, 100);
        }
      }

      _typeTimer = setTimeout(step, 1200);
    }
  }


  // ---------- 渲染导航链接 ----------
  function renderNav() {
    var navEl = document.querySelector('.nav-links');
    if (!navEl) return;

    var links = DATA.navLinks;
    // data.json 没有 navLinks 时，保留 HTML 中写死的导航链接（账本工具/管理），不清空
    if (!Array.isArray(links) || links.length === 0) return;

    // 只有确认有数据要渲染时，才清空并重建
    navEl.innerHTML = '';

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

    // 统计每个分类下的作品数量
    var catWorkCounts = {};
    if (Array.isArray(DATA.works)) {
      DATA.works.forEach(function(w) {
        var cat = w.category || '';
        if (cat) catWorkCounts[cat] = (catWorkCounts[cat] || 0) + 1;
      });
    }
    var totalCount = Array.isArray(DATA.works) ? DATA.works.length : 0;

    // 全部按钮
    const allBtn = document.createElement('button');
    allBtn.className = 'filter-btn active';
    allBtn.dataset.filter = 'all';
    allBtn.innerHTML = '全部 <span class="filter-count">' + totalCount + '</span>';
    bar.appendChild(allBtn);

    // 只显示有作品的分类按钮
    DATA.categories.forEach(function(cat) {
      if (!catWorkCounts[cat.id]) return; // 无作品，跳过
      const btn = document.createElement('button');
      btn.className = 'filter-btn';
      btn.dataset.filter = cat.id;
      btn.innerHTML = cat.label + ' <span class="filter-count">' + catWorkCounts[cat.id] + '</span>';
      bar.appendChild(btn);
    });
  }

  // ---------- IntersectionObserver 懒加载 ----------
  var lazyObserver = null;

  function setupLazyLoading() {
    // 清理旧的 observer
    if (lazyObserver) lazyObserver.disconnect();

    lazyObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (!entry.isIntersecting) return;
        var img = entry.target;
        var src = img.getAttribute('data-src');
        if (!src) return;
        // 300px 视口外就开始加载
        img.src = src;
        img.removeAttribute('data-src');
        img.classList.add('waterfall-loaded');
        lazyObserver.unobserve(img);

        // 图片加载完成后触发 masonry 重排（避免堆叠）
        img.addEventListener('load', function onLazyLoad() {
          img.removeEventListener('load', onLazyLoad);
          if (typeof window.applyMasonry === 'function') window.applyMasonry();
        });
      });
    }, { rootMargin: '300px 0px' });

    // ★ 分类隔离：只观察当前 waterfall 中的懒加载图片
    // 其他分类的节点已从文档移除，不会竞争网络和渲染资源
    document.querySelectorAll('#waterfall .waterfall-img[data-src]').forEach(function(img) {
      img.fetchPriority = 'high'; // 当前分类图片优先下载
      lazyObserver.observe(img);
    });
  }

  // ---------- 渲染作品瀑布流 ----------
  // ★ 核心设计（分类隔离渲染）：
  //   1. 首次加载：渲染全部 works 到 DOM，同时保存节点引用到 _allNodesCache
  //   2. 切换分类：从 waterfall 中移除所有节点，只放回目标分类的节点
  //   3. 其他分类节点从文档移除，不占用渲染树、不竞争网络、不计算 masonry
  //   4. 节点引用保存在内存中，切换回该分类时可立即恢复

  function renderWorks(filter) {
    const wf = document.getElementById('waterfall');
    if (!wf || !Array.isArray(DATA.works)) return;

    if (typeof filter === 'string') currentFilter = filter;

    // ── 已有节点缓存：分类隔离渲染 ──────────────────
    if (_allNodesCache && _allNodesCache.length > 0) {
      // 从 waterfall 中移除所有节点（但节点还在内存中）
      while (wf.firstChild) {
        wf.removeChild(wf.firstChild);
      }

      // 筛选当前分类的节点
      _currentCatNodes = _allNodesCache.filter(function(n) {
        return currentFilter === 'all' || n.dataset.category === currentFilter;
      });

      // 批量插回 waterfall（DocumentFragment 减少重排）
      var frag = document.createDocumentFragment();
      _currentCatNodes.forEach(function(n) {
        frag.appendChild(n);
      });
      wf.appendChild(frag);

      // 重新绑定事件（节点移动后事件仍在，但 gallery.js 的计数逻辑需要刷新）
      if (typeof bindNewItems === 'function') bindNewItems();

      // 只加载当前分类的图片（其他分类已从文档移除，Observer 不会触发）
      setupLazyLoading();

      // masonry 只计算当前分类数量（大幅提速）
      if (typeof window.applyMasonry === 'function') {
        window.applyMasonry();
      }

      // 入场动画
      setupRevealAnimation();

      // ★ 当前分类渲染完成后，后台预加载其他分类
      startBackgroundPreload(currentFilter);
      return;
    }

    // ── 首次加载：全量渲染并缓存节点引用 ─────────────
    wf.innerHTML = '';

    var PHONE_FRAME_CATS = {};
    if (Array.isArray(DATA.categories)) {
      DATA.categories.forEach(function(c) {
        if (c.phoneFrame) PHONE_FRAME_CATS[c.id] = true;
      });
    }

    var fragment = document.createDocumentFragment();

    DATA.works.forEach(function(w, globalIdx) {
      var usePhone = !!PHONE_FRAME_CATS[w.category];
      var div = document.createElement('div');
      div.className = 'waterfall-item' + (usePhone ? ' has-phone-frame' : '');
      div.dataset.caption = w.caption || '';
      div.dataset.category = w.category || '';
      div.dataset.order = String(globalIdx);
      div.dataset.phoneFrame = usePhone ? '1' : '0';
      div.dataset.index = String(globalIdx);

      var isKey = globalIdx < KEY_COUNT;
      var h5Btn = '';
      if (usePhone && w.url) {
        h5Btn = '<a href="' + w.url + '" target="_blank" rel="noopener" class="item-h5" title="打开小程序H5" onclick="event.stopPropagation();"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>';
        div.dataset.h5Url = w.url;
      }
      var overlayHtml = '<div class="item-overlay"><span class="item-caption">' + (w.caption || '') + '</span><button class="item-zoom" aria-label="查看大图">&#11170;</button>' + h5Btn + '</div>';

      var img = document.createElement('img');
      img.alt = w.caption || '';
      img.className = 'waterfall-img';
      if (isKey) {
        img.src = toCdnUrl(w.src);
        img.loading = 'eager';
        img.fetchpriority = 'high';
        img.onerror = function() { this.onerror = null; this.src = w.src; };
      } else {
        img.setAttribute('data-src', toCdnUrl(w.src));
        img.setAttribute('data-local', w.src);
        img.loading = 'lazy';
        img.style.background = 'var(--clr-surface)';
        img.style.minHeight = '200px';
        img.onerror = function() { this.onerror = null; this.src = this.dataset.local; };
      }

      // ── 动图/视频：默认显示静态缩略图，hover 时播放 ──
      var isVideo = w.type === 'video' || ANIMATED_SET[w.src];
      if (isVideo) {
        var tSrc = w.thumbnail || thumbPath(w.src);
        img.classList.add('lazy-gif');
        img.setAttribute('data-gif', w.src);
        img.setAttribute('data-static', tSrc);
        img.removeAttribute('data-src');
        img.src = toCdnUrl(tSrc);
        img.onerror = function() { this.onerror = null; this.src = tSrc; };
      }

      div.appendChild(img);

      // 动图 hover 事件：直接绑定在卡片上（最可靠）
      if (isVideo) {
        (function(card, gifImg) {
          card.addEventListener('mouseenter', function() {
            gifImg.src = toCdnUrl(gifImg.getAttribute('data-gif'));
            card.classList.add('gif-playing');
          });
          card.addEventListener('mouseleave', function() {
            gifImg.src = toCdnUrl(gifImg.getAttribute('data-static'));
            card.classList.remove('gif-playing');
          });
        })(div, img);
      }
      if (usePhone) {
        var wrapper = document.createElement('div');
        wrapper.className = 'phone-overlay';
        var island = document.createElement('div');
        island.className = 'phone-island';
        wrapper.appendChild(island);
        div.appendChild(wrapper);
      }
      var temp = document.createElement('div');
      temp.innerHTML = overlayHtml;
      while (temp.firstChild) div.appendChild(temp.firstChild);

      fragment.appendChild(div);
    });

    wf.appendChild(fragment);

    // 保存全部节点引用（供分类切换时快速恢复）
    _allNodesCache = Array.from(wf.querySelectorAll('.waterfall-item'));
    _currentCatNodes = _allNodesCache;

    if (typeof bindNewItems === 'function') bindNewItems();
    setupLazyLoading();
    // 首次加载：等可见图片加载完再排 masonry，避免懒加载过程中堆叠
    if (typeof window.waitImagesAndReflow === 'function') {
      window.waitImagesAndReflow();
    } else if (typeof window.applyMasonry === 'function') {
      window.applyMasonry();
    }

    // 交错入场动画
    setupRevealAnimation();

    // ★ 首屏渲染完成后，后台预加载其他分类
    startBackgroundPreload(currentFilter);
  }

  // ---------- 交错入场动画 ----------
  function setupRevealAnimation() {
    var items = document.querySelectorAll('#waterfall .waterfall-item');
    var batchSize = 12;
    var delayStep = 60;

    // 先给所有卡片设置初始延迟
    items.forEach(function(item, idx) {
      var batch = Math.floor(idx / batchSize);
      var delay = (idx % batchSize) * delayStep + batch * 300;
      item.style.transitionDelay = delay + 'ms';
    });

    // Intersection Observer 触发
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -40px 0px', threshold: 0.05 });

    items.forEach(function(item) {
      observer.observe(item);
    });
  }

  // ---------- 分类筛选逻辑（重新渲染，不在 DOM 中隐藏） ----------
  function initFilter() {
    const filterBar = document.getElementById('filterBar');
    if (!filterBar) return;

    filterBar.addEventListener('click', function (e) {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;

      // 切换 active 高亮状态
      filterBar.querySelectorAll('.filter-btn').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');

      // 切换分类，隔离渲染，优先当前分类
      const cat = btn.dataset.filter;
      renderWorks(cat);

      // 滚动到该分类第一排作品（等 masonry 重排完成后）
      setTimeout(function() {
        var firstItem = document.querySelector('#waterfall .waterfall-item');
        if (firstItem) {
          var navH = document.getElementById('navbar') ? document.getElementById('navbar').offsetHeight : 0;
          var filterBarSection = document.querySelector('.filter-bar-section');
          var filterH = filterBarSection ? filterBarSection.offsetHeight : 0;
          var offset = navH + filterH + 16;
          var top = firstItem.getBoundingClientRect().top + window.pageYOffset - offset;
          window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        }
      }, 350);
    });
  }

  // ═══════════════════════════════════════════════════
  //  后台预加载：当前分类渲染完成后，自动预加载其他分类
  // ═══════════════════════════════════════════════════

  function startBackgroundPreload(currentCatId) {
    // 中止之前的预加载
    _preloadAbort = true;

    if (!_allNodesCache || _allNodesCache.length === 0) return;

    // 构建优先级队列：按作品数量降序（用户更可能访问作品多的分类）
    var catCounts = {};
    _allNodesCache.forEach(function(n) {
      var cat = n.dataset.category;
      if (cat) catCounts[cat] = (catCounts[cat] || 0) + 1;
    });

    var queue = [];
    Object.keys(catCounts).forEach(function(catId) {
      if (catId === currentCatId) return;
      var nodes = _allNodesCache.filter(function(n) {
        return n.dataset.category === catId;
      });
      // 第一阶段：每分类只取前 7 张
      queue.push({
        catId: catId,
        count: catCounts[catId],
        nodes: nodes.slice(0, 7)
      });
    });

    // 按作品数量降序排列（大分类优先预加载）
    queue.sort(function(a, b) { return b.count - a.count; });

    _preloadQueue = queue;
    _preloadPhase = 'first';
    _preloadAbort = false;
    _isPreloading = true;

    // 使用 requestIdleCallback 或 setTimeout 低优先级执行
    var schedule = (typeof requestIdleCallback === 'function')
      ? function(fn) { requestIdleCallback(fn, { timeout: 2000 }); }
      : function(fn) { setTimeout(fn, 300); };

    schedule(function() {
      processPreloadQueue();
    });
  }

  function processPreloadQueue() {
    if (_preloadAbort) {
      _isPreloading = false;
      return;
    }

    // 第一阶段完成（每分类前7张），进入第二阶段（加载剩余全部）
    if (_preloadQueue.length === 0) {
      if (_preloadPhase === 'first') {
        _preloadPhase = 'rest';
        buildRestQueue();
        if (_preloadQueue.length === 0) {
          _isPreloading = false;
          return;
        }
      } else {
        _isPreloading = false;
        return;
      }
    }

    var batch = _preloadQueue.shift();
    var nodes = batch.nodes;
    var loaded = 0;
    var total = 0;

    nodes.forEach(function(node) {
      var img = node.querySelector('img');
      if (!img) return;

      var src = img.getAttribute('data-src');
      if (!src) return; // 已经加载过了（eager 或之前预加载过）

      total++;
      var preloadImg = new Image();

      preloadImg.onload = function() {
        // 更新缓存节点中的图片，下次切换分类时直接可用
        img.src = src;
        img.removeAttribute('data-src');
        img.classList.add('waterfall-loaded');
        loaded++;
        if (loaded >= total) nextBatch();
      };

      preloadImg.onerror = function() {
        loaded++;
        if (loaded >= total) nextBatch();
      };

      preloadImg.src = src;
    });

    if (total === 0) {
      nextBatch();
    }

    function nextBatch() {
      if (_preloadAbort) {
        _isPreloading = false;
        return;
      }
      // 短暂延迟，避免占用网络和主线程
      setTimeout(processPreloadQueue, 200);
    }
  }

  // 构建第二阶段队列：加载所有剩余未加载的图片
  function buildRestQueue() {
    if (!_allNodesCache) return;

    // 收集所有还有 data-src 的节点（未被加载的）
    var restNodes = [];
    _allNodesCache.forEach(function(node) {
      var img = node.querySelector('img');
      if (img && img.getAttribute('data-src')) {
        restNodes.push(node);
      }
    });

    if (restNodes.length > 0) {
      // 按分类分组，大分类优先
      var catGroups = {};
      restNodes.forEach(function(node) {
        var cat = node.dataset.category || 'unknown';
        if (!catGroups[cat]) catGroups[cat] = [];
        catGroups[cat].push(node);
      });

      var queue = [];
      Object.keys(catGroups).forEach(function(catId) {
        queue.push({
          catId: catId,
          nodes: catGroups[catId]
        });
      });

      // 按数量降序
      queue.sort(function(a, b) { return b.nodes.length - a.nodes.length; });
      _preloadQueue = queue;
    }
  }

  // ---------- 预加载动图（仅当前可见作品，跳过 lazy-gif 由 manager 处理）----------
  function preloadAnimatedImages() {
    var items = document.querySelectorAll('#waterfall .waterfall-item');
    items.forEach(function(item) {
      var img = item.querySelector('img');
      if (!img) return;
      // 跳过由 GIF manager 管理的动图
      if (img.classList.contains('lazy-gif')) return;
      var src = img.getAttribute('data-src') || img.getAttribute('src') || img.src || '';
      var baseSrc = src.split('?')[0];
      if (!baseSrc.match(/\.(gif|webp)(\?|$)/i)) return;
      if (img.dataset.preloaded) return;
      img.dataset.preloaded = '1';
      var preloader = new Image();
      preloader.src = baseSrc;
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
  // 主流程：立即渲染 → 后台预加载关键图片
  // ═══════════════════════════════════════════════════
  await loadData();

  // 暴露分类配置给 gallery.js（列数自定义等）
  window._categoryConfig = {};
  if (Array.isArray(DATA.categories)) {
    DATA.categories.forEach(function(c) {
      window._categoryConfig[c.id] = c;
    });
  }

  // 立即渲染首屏（不等图片加载完）
  renderNav();
  renderHero();
  renderCategories();
  renderWorks();
  initFilter();
  // 立即隐藏预加载屏
  if (typeof window.hidePreloader === 'function') window.hidePreloader();

  // 后台预加载关键图片（hero 背景 + 前 4 张），不阻塞渲染
  // 复用顶部已定义的 KEY_COUNT
  var keyUrls = [];
  if (DATA.hero && DATA.hero.bg) {
    keyUrls.push(toCdnUrl(DATA.hero.bg));
  }
  if (Array.isArray(DATA.works)) {
    DATA.works.slice(0, KEY_COUNT).forEach(function(w) {
      if (w.src) keyUrls.push(toCdnUrl(w.src));
    });
  }
  if (keyUrls.length > 0) {
    preloadImages(keyUrls, function(pct) {
      // 静默预加载，不更新 UI
    });
  }

  // 延迟预加载动图（不阻塞首屏）
  setTimeout(preloadAnimatedImages, 1000);
  setTimeout(preloadAnimatedImages, 3000);

  // 暴露 DATA 到全局，供联系弹窗等内联脚本读取
  window.DATA = DATA;
})();
