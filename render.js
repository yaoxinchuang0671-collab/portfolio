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
      { id: 'cat4', label: '分类四' },
      { id: 'cat5', label: '分类五' }
    ],
    works: [] // 默认无案例作品
  };

  // ---------- 加载数据（带 2 秒超时）----------
  async function loadData() {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(function () { ctrl.abort(); }, 2000);
      const res = await fetch('data.json?t=' + Date.now(), { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      DATA = await res.json();
      console.log('[render] data.json 加载成功');
    } catch (e) {
      console.warn('无法加载 data.json，使用内联默认数据。原因：', e.message);
      const inline = document.getElementById('inlineData');
      if (inline) {
        try { DATA = JSON.parse(inline.textContent); console.log('[render] 使用内联数据'); return; } catch(e2) {}
      }
      DATA = JSON.parse(JSON.stringify(DEFAULT_DATA));
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

    // 分类按钮
    DATA.categories.forEach(cat => {
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
    DATA.works.forEach(w => {
      const div = document.createElement('div');
      div.className = 'waterfall-item';
      div.dataset.caption = w.caption || '';
      div.dataset.category = w.category || '';
      div.innerHTML = `
        <img src="${w.src}" alt="${w.caption || ''}" loading="lazy" />
        <div class="item-overlay">
          <span class="item-caption">${w.caption || ''}</span>
          <button class="item-zoom" aria-label="查看大图">&#11170;</button>
        </div>`;
      wf.appendChild(div);
    });
    // 重新绑定图片点击（lightbox）
    if (typeof bindNewItems === 'function') bindNewItems();
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

          // 强制重新播放 GIF/WebP 动图：cloneNode 替换是最可靠的跨浏览器方式
          var img = item.querySelector('img');
          if (img) {
            var src = img.getAttribute('src') || img.src;
            var baseSrc = src.split('?')[0];
            if (baseSrc.match(/\.(gif|webp)(\?|$)/i)) {
              var clone = img.cloneNode(true);
              clone.src = baseSrc + '?t=' + Date.now();
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
    });
  }

  // ---------- 主流程 ----------
  await loadData();
  renderHero();
  renderCategories();
  renderWorks();
  initFilter();
})();
