/* ==================================================
   瀑布流灯箱交互
   ================================================== */

(function () {
  const lightbox   = document.getElementById('lightbox');
  const lightboxImg   = document.getElementById('lightboxImg');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const btnClose    = document.getElementById('lightboxClose');
  const btnPrev     = document.getElementById('lightboxPrev');
  const btnNext     = document.getElementById('lightboxNext');
  const items       = Array.from(document.querySelectorAll('.waterfall-item'));

  let currentIndex = -1;

  function openLightbox(index) {
    if (index < 0 || index >= items.length) return;
    currentIndex = index;
    const img = items[index].querySelector('img');
    const caption = items[index].dataset.caption || '';
    lightboxImg.src = img.src.replace(/\/\d+\/\d+$/, '/1200/0'); // 尝试拉大图
    lightboxImg.alt = img.alt;
    lightboxCaption.textContent = caption;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => { lightboxImg.src = ''; }, 300);
  }

  function showPrev() {
    openLightbox((currentIndex - 1 + items.length) % items.length);
  }

  function showNext() {
    openLightbox((currentIndex + 1) % items.length);
  }

  // 点击图片或放大按钮
  items.forEach((item, i) => {
    const zoomBtn = item.querySelector('.item-zoom');
    if (zoomBtn) {
      zoomBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openLightbox(i);
      });
    }
    item.addEventListener('click', () => openLightbox(i));
  });

  // 关闭
  if (btnClose) btnClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  // 上一张 / 下一张
  if (btnPrev) btnPrev.addEventListener('click', (e) => { e.stopPropagation(); showPrev(); });
  if (btnNext) btnNext.addEventListener('click', (e) => { e.stopPropagation(); showNext(); });

  // 键盘
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape')    closeLightbox();
    if (e.key === 'ArrowLeft')  showPrev();
    if (e.key === 'ArrowRight') showNext();
  });

  // 「滚动自动加载更多」模拟
  let loadCount = 0;
  const MAX_LOAD = 3;
  const moreSeeds = [
    [800, 600], [900, 700], [700, 800], [850, 650],
    [750, 900], [950, 700], [600, 850], [800, 750],
  ];

  function loadMore() {
    if (loadCount >= MAX_LOAD) return;
    const fragment = document.createDocumentFragment();
    const seeds = moreSeeds.slice(loadCount * 4, (loadCount + 1) * 4);
    seeds.forEach(([h, w], j) => {
      const idx = loadCount * 4 + j + 9;
      const div = document.createElement('div');
      div.className = 'waterfall-item';
      div.dataset.caption = '作品' + idx;
      div.innerHTML = `
        <img src="https://picsum.photos/seed/m${idx}/${w}/${h}" alt="作品${idx}" loading="lazy" />
        <div class="item-overlay">
          <span class="item-caption">作品${idx}</span>
          <button class="item-zoom" aria-label="查看大图">⤢</button>
        </div>`;
      fragment.appendChild(div);
    });
    document.getElementById('waterfall').appendChild(fragment);
    bindNewItems();
    loadCount++;
  }

  // 滚动到底部附近时自动触发加载（防抖）
  let scrollTimer = null;
  let loading = false;
  window.addEventListener('scroll', () => {
    if (loading) return; // 正在加载中，忽略
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      if (loadCount >= MAX_LOAD) return; // 已全部加载
      const scrollH = document.documentElement.scrollHeight;
      const scrollT = document.documentElement.scrollTop || document.body.scrollTop;
      const clientH  = window.innerHeight;
      // 距离底部 300px 以内时触发
      if (scrollH - scrollT - clientH < 300) {
        loading = true;
        loadMore();
        // 等图片加载一会儿再允许下一次触发
        setTimeout(() => { loading = false; }, 1000);
      }
    }, 200);
  }, { passive: true });

  function bindNewItems() {
    const allItems = document.querySelectorAll('.waterfall-item');
    allItems.forEach((item, i) => {
      if (item._bound) return;
      item._bound = true;
      const zoomBtn = item.querySelector('.item-zoom');
      if (zoomBtn) {
        zoomBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          reopenLightbox(i);
        });
      }
      item.addEventListener('click', () => reopenLightbox(i));
    });
    // 更新 items 引用
    items.length = 0;
    document.querySelectorAll('.waterfall-item').forEach(el => items.push(el));
  }

  function reopenLightbox(index) {
    currentIndex = index;
    const img = items[index].querySelector('img');
    const caption = items[index].dataset.caption || '';
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt;
    lightboxCaption.textContent = caption;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  // 初始化绑定
  bindNewItems();

  // 检测图片是否被裁剪，添加底部渐变提示
  function markClippedImages() {
    document.querySelectorAll('.waterfall-item').forEach(item => {
      const img = item.querySelector('img');
      if (!img) return;
      // 图片原始宽高比换算后的渲染高度 > 容器最大高度，说明被裁剪了
      const renderedH = img.naturalHeight * (img.offsetWidth / img.naturalWidth);
      if (renderedH > 600) {
        item.classList.add('clipped');
      }
    });
  }

  // 页面加载后执行
  if (document.readyState === 'complete') {
    markClippedImages();
  } else {
    window.addEventListener('load', markClippedImages);
  }
  // 动态加载的图片也重新检测
  const obs = new MutationObserver(() => {
    markClippedImages();
  });
  obs.observe(document.getElementById('waterfall'), { childList: true });
})();

