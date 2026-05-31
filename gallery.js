/* ==================================================
   瀑布流灯箱交互
   ================================================== */

(function () {
  const lightbox       = document.getElementById('lightbox');
  const lightboxImg    = document.getElementById('lightboxImg');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const btnClose       = document.getElementById('lightboxClose');
  const btnPrev        = document.getElementById('lightboxPrev');
  const btnNext        = document.getElementById('lightboxNext');

  let currentOrder = -1; // 当前打开作品的 data-order

  // 获取所有可见作品，按 data-order 排序
  function getVisibleItems() {
    return Array.from(document.querySelectorAll('.waterfall-item'))
      .filter(function (it) { return it.style.display !== 'none'; })
      .sort(function (a, b) {
        return parseInt(a.dataset.order || '0', 10) - parseInt(b.dataset.order || '0', 10);
      });
  }

  // 根据 data-order 找索引
  function findIndexByOrder(order) {
    var items = getVisibleItems();
    for (var i = 0; i < items.length; i++) {
      if (parseInt(items[i].dataset.order || '0', 10) === order) return i;
    }
    return -1;
  }

  function openLightboxByOrder(order) {
    var items = getVisibleItems();
    var idx = findIndexByOrder(order);
    if (idx < 0 || idx >= items.length) return;

    currentOrder = order;
    var item    = items[idx];
    var img     = item.querySelector('img');
    var caption = item.dataset.caption || '';

    // 尝试拉大图：把路径中的 /thumb/ 替换为 /large/ 或原图
    var src = img.src;
    // 如果路径里有尺寸后缀（如 /300/0），替换为 /1200/0 拉大图
    src = src.replace(/\/(\d+)\/(\d+)$/, '/1200/0');
    lightboxImg.src = src;
    lightboxImg.alt = img.alt;
    lightboxImg.draggable = false;  // 禁止拖拽保存
    lightboxCaption.textContent = caption;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  // 禁止灯箱图片右键菜单
  if (lightboxImg) {
    lightboxImg.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      return false;
    });
    lightboxImg.draggable = false;
  }

  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(function () { lightboxImg.src = ''; }, 300);
  }

  function showPrev() {
    var items = getVisibleItems();
    var idx = findIndexByOrder(currentOrder);
    if (idx < 0) return;
    idx = (idx - 1 + items.length) % items.length;
    openLightboxByOrder(parseInt(items[idx].dataset.order || '0', 10));
  }

  function showNext() {
    var items = getVisibleItems();
    var idx = findIndexByOrder(currentOrder);
    if (idx < 0) return;
    idx = (idx + 1) % items.length;
    openLightboxByOrder(parseInt(items[idx].dataset.order || '0', 10));
  }

  // 绑定单个作品卡片
  function bindItem(item) {
    if (item._bound) return;
    item._bound = true;

    var order = parseInt(item.dataset.order || '0', 10);

    function onClick(e) {
      e.stopPropagation();
      openLightboxByOrder(order);
    }

    var zoomBtn = item.querySelector('.item-zoom');
    if (zoomBtn) {
      zoomBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        openLightboxByOrder(order);
      });
    }
    item.addEventListener('click', function (e) {
      // 排除按钮区域
      if (e.target.closest('.item-actions')) return;
      openLightboxByOrder(order);
    });
  }

  // 全量重新绑定（供 render.js / applyMasonry 后调用）
  function bindAllItems() {
    document.querySelectorAll('.waterfall-item').forEach(bindItem);
  }

  // 关闭
  if (btnClose) btnClose.addEventListener('click', function (e) {
    e.stopPropagation();
    closeLightbox();
  });
  if (lightbox) {
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLightbox();
    });
  }

  // 上一张 / 下一张
  if (btnPrev) btnPrev.addEventListener('click', function (e) {
    e.stopPropagation();
    showPrev();
  });
  if (btnNext) btnNext.addEventListener('click', function (e) {
    e.stopPropagation();
    showNext();
  });

  // 键盘
  document.addEventListener('keydown', function (e) {
    if (!lightbox || !lightbox.classList.contains('active')) return;
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowLeft')  showPrev();
    if (e.key === 'ArrowRight') showNext();
  });

  // 初始化绑定
  bindAllItems();

  // 暴露到全局
  window.bindNewItems = bindAllItems;

  // ============ 检测图片是否被裁剪 ============
  function markClippedImages() {
    document.querySelectorAll('.waterfall-item').forEach(function (item) {
      var img = item.querySelector('img');
      if (!img) return;
      var renderedH = img.naturalHeight * (img.offsetWidth / img.naturalWidth);
      if (renderedH > 600) {
        item.classList.add('clipped');
      } else {
        item.classList.remove('clipped');
      }
    });
  }

  // ============ Masonry 砌体布局 ============
  function getColCount() {
    var wf = document.getElementById('waterfall');
    var w = wf ? wf.clientWidth : window.innerWidth;
    if (w < 600)  return 1;
    if (w < 900)  return 2;
    if (w < 1200) return 3;
    if (w < 1600) return 4;
    return 5;
  }

  function applyMasonry() {
    var wf = document.getElementById('waterfall');
    if (!wf) return;

    var allItems     = Array.from(wf.querySelectorAll('.waterfall-item'));
    var visibleItems = allItems.filter(function (it) { return it.style.display !== 'none'; });
    var hiddenItems  = allItems.filter(function (it) { return it.style.display === 'none'; });
    if (visibleItems.length === 0) return;

    var colCount = getColCount();

    // 按原始 data.json 顺序排序
    visibleItems.sort(function (a, b) {
      return parseInt(a.dataset.order || '0', 10) - parseInt(b.dataset.order || '0', 10);
    });

    var cols = [];
    for (var i = 0; i < colCount; i++) {
      var col = document.createElement('div');
      col.className = 'waterfall-col';
      cols.push(col);
    }

    visibleItems.forEach(function (item, idx) {
      cols[idx % colCount].appendChild(item);
    });

    wf.innerHTML = '';
    cols.forEach(function (col) { wf.appendChild(col); });
    hiddenItems.forEach(function (item) { wf.appendChild(item); });

    bindAllItems();
    markClippedImages();
  }

  function waitImagesAndReflow() {
    var wf = document.getElementById('waterfall');
    if (!wf) return;
    var imgs = Array.from(wf.querySelectorAll('.waterfall-item img'));
    if (imgs.length === 0) { applyMasonry(); return; }

    var checked = 0;
    var total = imgs.length;

    function tryReflow() {
      checked++;
      if (checked >= total) applyMasonry();
    }

    imgs.forEach(function (img) {
      if (img.complete && img.naturalWidth > 0) {
        tryReflow();
      } else {
        img.addEventListener('load', tryReflow, { once: true });
        img.addEventListener('error', tryReflow, { once: true });
      }
    });
  }

  window.applyMasonry      = applyMasonry;
  window.waitImagesAndReflow = waitImagesAndReflow;

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyMasonry, 200);
  });

  var wfEl = document.getElementById('waterfall');
  if (wfEl) new MutationObserver(markClippedImages).observe(wfEl, { childList: true });
})();

