/* ==================================================
   从 data.json 加载数据并渲染页面
   ================================================== */
(async function () {
  let DATA = {};

  // ---------- 默认数据（fetch 失败时使用）----------
  const DEFAULT_DATA = {
    hero: {
      greeting: '👋 你好，我是',
      name: '你的名字',
      typedTexts: ['UI/UX 设计师', '前端开发者', '数字产品设计师'],
      bio: '这里是一段简短的自我介绍，描述你的专业方向、热情所在，以及你能带来的价值。'
    },
    categories: [
      { id: 'cat1', label: '分类一' },
      { id: 'cat2', label: '分类二' },
      { id: 'cat3', label: '分类三' },
      { id: 'cat4', label: '分类四' },
      { id: 'cat5', label: '分类五' },
    ],
    works: [
      { id: 1, src: 'img/work1.gif', caption: '作品一（GIF动图）', category: 'cat1', type: 'gif' },
      { id: 2, src: 'img/work2.svg', caption: '作品二', category: 'cat2', type: 'image' },
      { id: 3, src: 'img/work3.svg', caption: '作品三', category: 'cat1', type: 'image' },
      { id: 4, src: 'img/work4.svg', caption: '作品四', category: 'cat3', type: 'image' },
      { id: 5, src: 'img/work5.svg', caption: '作品五', category: 'cat2', type: 'image' },
      { id: 6, src: 'img/work6.svg', caption: '作品六', category: 'cat4', type: 'image' },
      { id: 7, src: 'img/work7.svg', caption: '作品七', category: 'cat5', type: 'image' },
      { id: 8, src: 'img/work8.svg', caption: '作品八', category: 'cat3', type: 'image' },
    ]
  };

  // ---------- 加载数据 ----------
  async function loadData() {
    try {
      const res = await fetch('data.json?t=' + Date.now());
      if (!res.ok) throw new Error('HTTP ' + res.status);
      DATA = await res.json();
      console.log('[render] data.json 加载成功');
    } catch (e) {
      console.warn('无法加载 data.json，使用内联默认数据。原因：', e.message);
      // 尝试读取内联 <script type="application/json" id="inlineData"> 标签
      const inline = document.getElementById('inlineData');
      if (inline) {
        try { DATA = JSON.parse(inline.textContent); console.log('[render] 使用内联数据'); return; } catch(e2) {}
      }
      DATA = JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
  }

  // ---------- 渲染 Hero ----------
  function renderHero() {
    const h = DATA.hero || {};
    const elGreeting = document.getElementById('heroGreeting');
    const elName     = document.getElementById('heroName');
    const elBio      = document.getElementById('heroBio');

    if (elGreeting) elGreeting.textContent = h.greeting || '';
    if (elName)     elName.textContent     = h.name || '';
    if (elBio)      elBio.textContent      = h.bio || '';

    // 打字机效果
    const typedTexts = h.typedTexts || [];
    if (typedTexts.length > 0) {
      initTyped(typedTexts);
    }
  }

  // ---------- 打字机 ----------
  function initTyped(texts) {
    const el = document.getElementById('typedText');
    if (!el) return;
    let idx = 0, charIdx = 0, deleting = false;
    const speed = 120, deleteSpeed = 60, pauseAfterWord = 1500;

    function tick() {
      const current = texts[idx];
      if (!deleting) {
        el.textContent = current.slice(0, charIdx + 1);
        charIdx++;
        if (charIdx === current.length) {
          deleting = true;
          setTimeout(tick, pauseAfterWord);
          return;
        }
        setTimeout(tick, speed);
      } else {
        el.textContent = current.slice(0, charIdx - 1);
        charIdx--;
        if (charIdx === 0) {
          deleting = false;
          idx = (idx + 1) % texts.length;
          setTimeout(tick, 400);
          return;
        }
        setTimeout(tick, deleteSpeed);
      }
    }
    tick();
  }

  // ---------- 渲染分类筛选栏 ----------
  function renderFilterBar() {
    const bar = document.getElementById('filterBar');
    if (!bar) return;
    const cats = DATA.categories || [];
    let html = '<button class="filter-btn active" data-filter="all">全部</button>';
    cats.forEach(c => {
      html += `<button class="filter-btn" data-filter="${c.id}">${escHTML(c.label)}</button>`;
    });
    bar.innerHTML = html;
  }

  // ---------- 渲染瀑布流 ----------
  function renderWaterfall() {
    const wf = document.getElementById('waterfall');
    if (!wf) return;
    const works = DATA.works || [];
    wf.innerHTML = works.map(w => `
      <div class="waterfall-item" data-caption="${escAttr(w.caption || '')}" data-category="${escAttr(w.category || '')}">
        <img src="${escAttr(w.src || '')}" alt="${escAttr(w.caption || '')}" loading="lazy" />
        <div class="item-overlay">
          <span class="item-caption">${escHTML(w.caption || '')}</span>
          <button class="item-zoom" aria-label="查看大图">⤢</button>
        </div>
      </div>
    `).join('');
  }

  // ---------- 工具函数 ----------
  function escHTML(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function escAttr(s) {
    return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ---------- 启动 ----------
  await loadData();
  renderHero();
  renderFilterBar();
  renderWaterfall();

  // 等 DOM 更新后重新绑定 gallery.js / filter.js 的事件
  setTimeout(() => {
    if (typeof bindNewItems === 'function') bindNewItems();
    if (typeof initFilter === 'function') initFilter();
  }, 100);

})();
