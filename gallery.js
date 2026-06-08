/* ==================================================
   瀑布流灯箱交互（含滚轮缩放 + 拖拽平移）
   ================================================== */

(function () {
  const lightbox       = document.getElementById('lightbox');
  const lightboxImg    = document.getElementById('lightboxImg');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const btnClose       = document.getElementById('lightboxClose');
  const btnPrev        = document.getElementById('lightboxPrev');
  const btnNext        = document.getElementById('lightboxNext');
  const lightboxPhoneWrap = document.getElementById('lightboxPhoneWrap');
  const lightboxPhoneImg  = document.getElementById('lightboxPhoneImg');
  const lightboxH5        = document.getElementById('lightboxH5');

  let currentOrder = -1;

  // ── 缩放/平移状态 ────────────────────────────────
  // transform 顺序：translate(panX, panY) scale(scale)
  // 这样拖拽像素距离不受缩放影响，行为直观
  let scale  = 1;
  let panX   = 0;
  let panY   = 0;
  const SCALE_STEP = 0.3;
  const SCALE_MAX  = 5;
  const SCALE_MIN  = 1;

  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragPanX   = 0;
  let dragPanY   = 0;

  function applyTransform() {
    // 关键：translate 在前，scale 在后 → 拖拽距离 = 屏幕像素距离
    lightboxImg.style.transform =
      'translate(' + panX + 'px,' + panY + 'px) scale(' + scale + ')';
    lightboxImg.style.cursor = scale > 1.05 ? 'grab' : 'default';
    lightboxImg.style.willChange = scale > 1.05 ? 'transform' : 'auto';
  }

  function resetZoom() {
    scale = 1;
    panX  = 0;
    panY  = 0;
    applyTransform();
  }

  // 以鼠标位置为中心进行缩放
  function zoomAtPoint(delta, clientX, clientY) {
    const oldScale = scale;
    scale += delta;
    if (scale < SCALE_MIN) scale = SCALE_MIN;
    if (scale > SCALE_MAX) scale = SCALE_MAX;
    if (oldScale === scale) return; // 没变化

    // 计算鼠标在 lightbox 坐标系中的位置
    const rect = lightbox.getBoundingClientRect();
    const mx = clientX - rect.left - rect.width / 2;
    const my = clientY - rect.top  - rect.height / 2;

    // 保持鼠标指向的图片点不动：调整 panX/Y
    // 原理：缩放后，鼠标位置对应的图片点应该不变
    const ratio = scale / oldScale;
    panX = mx * (1 - ratio) + panX * ratio;
    panY = my * (1 - ratio) + panY * ratio;

    applyTransform();
  }

  // ── 滚轮缩放 ──────────────────────────────────────
  if (lightbox) {
    lightbox.addEventListener('wheel', function(e) {
      if (!lightbox.classList.contains('active')) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP;
      zoomAtPoint(delta, e.clientX, e.clientY);
    }, { passive: false });
  }

  // ── 拖拽平移 ──────────────────────────────────────
  // 优化：document 事件只在拖拽时绑定，减少全局监听开销
  function onMouseMove(e) {
    if (!isDragging) return;
    panX = dragPanX + (e.clientX - dragStartX);
    panY = dragPanY + (e.clientY - dragStartY);
    applyTransform();
  }

  function onMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    if (lightboxImg) lightboxImg.style.cursor = 'grab';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  if (lightboxImg) {
    lightboxImg.addEventListener('mousedown', function(e) {
      // 只在放大后才允许拖拽
      if (scale <= 1.05) return;
      e.preventDefault();
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragPanX  = panX;
      dragPanY  = panY;
      lightboxImg.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      // 动态绑定全局事件
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    // 双击：放大/重置
    lightboxImg.addEventListener('dblclick', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (scale > 1.05) {
        resetZoom();
      } else {
        zoomAtPoint(SCALE_STEP * 3, e.clientX, e.clientY);
      }
    });
  }

  // ── 灯箱核心逻辑 ──────────────────────────────────
  function getVisibleItems() {
    return Array.from(document.querySelectorAll('#waterfall .waterfall-item'))
      .sort(function(a, b) {
        return parseInt(a.dataset.order || '0', 10) -
               parseInt(b.dataset.order || '0', 10);
      });
  }

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
    var usePhone = item.dataset.phoneFrame === '1';

    // 检测是否为动图（路径需转为 CDN URL 保证线上可用）
    var _toCdn = window.toCdnUrl || function(s) { return s; };
    var gifUrl = _toCdn(img.getAttribute('data-gif') || '');
    var staticUrl = _toCdn(img.getAttribute('data-static') || '');
    var isGif = !!img.getAttribute('data-gif');

    // 动图默认加载静态缩略图（快速显示），按钮可切换为动图
    var src = (isGif ? staticUrl : _toCdn(img.src || img.getAttribute('data-src') || ''));
    if (!isGif) src = src.replace(/\/(\d+)\/(\d+)$/, '/1200/0');

    lightboxCaption.textContent = caption;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
    resetZoom();

    if (usePhone) {
      // 手机边框模式
      lightbox.classList.add('phone-mode');
      if (lightboxPhoneImg) {
        lightboxPhoneImg.src = src;
        lightboxPhoneImg.alt = img.alt || caption;
        // 动图支持（phone frame 内）
        if (isGif) {
          lightboxPhoneImg.setAttribute('data-gif', gifUrl);
          lightboxPhoneImg.setAttribute('data-static', staticUrl);
          lightbox.classList.add('gif-mode');
          ensureGifControls();
        } else {
          lightbox.classList.remove('gif-mode');
        }
      }
      var h5Url = item.dataset.h5Url || '';
      if (lightboxH5) {
        if (h5Url) {
          lightboxH5.href = h5Url;
          lightboxH5.style.display = '';
        } else {
          lightboxH5.style.display = 'none';
        }
      }
      lightboxImg.src = '';
    } else {
      // 普通图片 / 动图模式
      lightbox.classList.remove('phone-mode');
      if (lightboxH5) lightboxH5.style.display = 'none';
      lightboxImg.src = src;
      lightboxImg.alt = img.alt || caption;
      lightboxImg.draggable = false;
      if (lightboxPhoneImg) lightboxPhoneImg.src = '';

      // 动图：存储 URL 并添加控制按钮
      if (isGif) {
        lightboxImg.setAttribute('data-gif', gifUrl);
        lightboxImg.setAttribute('data-static', staticUrl);
        lightbox.classList.add('gif-mode');
        ensureGifControls();
      } else {
        lightbox.classList.remove('gif-mode');
      }
    }
  }

  // 禁止灯箱图片右键
  if (lightboxImg) {
    lightboxImg.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      return false;
    });
    lightboxImg.draggable = false;
  }
  // 禁止手机框内图片右键
  if (lightboxPhoneImg) {
    lightboxPhoneImg.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      return false;
    });
    lightboxPhoneImg.draggable = false;
  }

  function closeLightbox() {
    lightbox.classList.add('closing');
    setTimeout(function() {
      lightbox.classList.remove('active');
      lightbox.classList.remove('phone-mode');
      lightbox.classList.remove('gif-mode');
      lightbox.classList.remove('closing');
      document.body.style.overflow = '';
      resetZoom();
      removeGifControls();
      if (lightboxH5) lightboxH5.style.display = 'none';
      lightboxImg.src = '';
      lightboxImg.removeAttribute('data-gif');
      lightboxImg.removeAttribute('data-static');
      if (lightboxPhoneImg) {
        lightboxPhoneImg.src = '';
        lightboxPhoneImg.removeAttribute('data-gif');
        lightboxPhoneImg.removeAttribute('data-static');
      }
    }, 250);
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

    var zoomBtn = item.querySelector('.item-zoom');
    if (zoomBtn) {
      zoomBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        openLightboxByOrder(order);
      });
    }
    item.addEventListener('click', function(e) {
      if (e.target.closest('.item-actions')) return;
      openLightboxByOrder(order);
    });
  }

  function bindAllItems() {
    document.querySelectorAll('.waterfall-item').forEach(bindItem);
  }

  // 关闭
  if (btnClose) btnClose.addEventListener('click', function(e) {
    e.stopPropagation();
    closeLightbox();
  });
  if (lightbox) {
    lightbox.addEventListener('click', function(e) {
      if (e.target === lightbox) closeLightbox();
    });
  }

  // 上一张 / 下一张
  if (btnPrev) btnPrev.addEventListener('click', function(e) {
    e.stopPropagation(); showPrev();
  });
  if (btnNext) btnNext.addEventListener('click', function(e) {
    e.stopPropagation(); showNext();
  });

  // 键盘
  document.addEventListener('keydown', function(e) {
    if (!lightbox || !lightbox.classList.contains('active')) return;
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowLeft')  showPrev();
    if (e.key === 'ArrowRight') showNext();
  });

  bindAllItems();
  window.bindNewItems = bindAllItems;

  // ============ 检测图片是否被裁剪 ============
  function markClippedImages() {
    document.querySelectorAll('.waterfall-item').forEach(function(item) {
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

  // ============ Masonry 砌体布局（Absolute Positioning 方案）============
  // ★ 核心原则：不移动任何 DOM 节点，GIF 留在渲染树不重置
  // 可见卡片 position:absolute，JS 计算 top/left，放入最短列
  // 隐藏卡片 left:-9999px（仍在渲染树），GIF 继续播放

  var GAP = 20;

  function getColCount() {
    var w = window.innerWidth;

    // 检测当前激活的分类是否有自定义列数配置
    var activeBtn = document.querySelector('.filter-btn.active');
    var catId = activeBtn ? activeBtn.dataset.filter : 'all';
    var catConfig = window._categoryConfig && window._categoryConfig[catId];
    var customCols = catConfig && catConfig.cols ? parseInt(catConfig.cols, 10) : 0;

    if (customCols > 0) {
      // 有自定义列数：在响应式断点内限制最大列数
      if (w < 560)  return Math.min(customCols, 2);
      if (w < 820)  return Math.min(customCols, 3);
      if (w < 1100) return Math.min(customCols, 4);
      return customCols;
    }

    // 默认规则
    if (w < 560)  return 2;
    if (w < 820)  return 3;
    if (w < 1100) return 4;
    if (w < 1500) return 5;
    if (w < 1900) return 6;
    return 7;
  }

  function applyMasonry() {
    var wf = document.getElementById('waterfall');
    if (!wf) return;

    var colCount = getColCount();
    var containerWidth = wf.clientWidth;
    if (containerWidth <= 0) return;

    var colWidth = (containerWidth - GAP * (colCount - 1)) / colCount;
    var colLefts  = [];
    for (var i = 0; i < colCount; i++) {
      colLefts.push(i * (colWidth + GAP));
    }

    // 清理历史遗留的 .waterfall-col 节点
    var oldCols = Array.from(wf.querySelectorAll('.waterfall-col'));
    oldCols.forEach(function(col) {
      while (col.firstChild) wf.appendChild(col.firstChild);
      col.remove();
    });

    // 获取当前分类卡片（waterfall 中只有当前分类节点）
    var items = Array.from(wf.querySelectorAll('.waterfall-item'));
    if (items.length === 0) {
      wf.style.height = '0px';
      return;
    }

    // 先给所有可见卡片设置绝对定位（ masonry 必需）
    items.forEach(function(item) {
      item.style.position = 'absolute';
      item.style.width = colWidth + 'px';
    });

    // 等一帧让浏览器应用 width 后再计算位置
    requestAnimationFrame(function() {
      var colHeights = [];
      for (var ci = 0; ci < colCount; ci++) colHeights.push(0);

      items.forEach(function(item) {
        // 找最短列
        var minH = colHeights[0], minIdx = 0;
        for (var ci = 1; ci < colCount; ci++) {
          if (colHeights[ci] < minH) { minH = colHeights[ci]; minIdx = ci; }
        }

        var itemH = item.offsetHeight || 200;
        item.style.left = colLefts[minIdx] + 'px';
        item.style.top  = colHeights[minIdx] + 'px';

        colHeights[minIdx] += itemH + GAP;
      });

      // 设置容器高度
      var maxH = 0;
      for (var ci = 0; ci < colCount; ci++) {
        if (colHeights[ci] > maxH) maxH = colHeights[ci];
      }
      wf.style.height = Math.max(maxH - GAP, 0) + 'px';

      markClippedImages();
    });
  }

  function waitImagesAndReflow() {
    // 等图片加载完再重排（只对非隐藏的图片）
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

    imgs.forEach(function(img) {
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
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyMasonry, 200);
  });

  var wfEl = document.getElementById('waterfall');
  if (wfEl) new MutationObserver(markClippedImages).observe(wfEl, { childList: true });

  // ═══════════════════════════════════════════════════
  // GIF 动图管理器（仅灯箱播放/暂停控制）
  //   Hover 播放已在 render.js 直接绑定，此处仅管理灯箱
  // ═══════════════════════════════════════════════════

  var gifControlsEl   = null;

  // ── 灯箱 GIF 控制按钮 ──────────────────
  function ensureGifControls() {
    if (gifControlsEl) {
      // 更新按钮状态：静态→显示 ▶，动图→显示 ⏸
      var activeImg = lightboxImg.getAttribute('data-gif') ? lightboxImg : 
                      (lightboxPhoneImg && lightboxPhoneImg.getAttribute('data-gif') ? lightboxPhoneImg : null);
      if (activeImg) {
        var btn = gifControlsEl.querySelector('.lightbox-gif-btn');
        var playing = activeImg.src === activeImg.getAttribute('data-gif');
        btn.innerHTML = playing ? '⏸' : '▶';
        btn.title = playing ? '暂停' : '播放';
      }
      return;
    }
    gifControlsEl = document.createElement('div');
    gifControlsEl.className = 'lightbox-gif-controls';
    // 初始显示缩略图 → ▶ 播放
    gifControlsEl.innerHTML = '<button class="lightbox-gif-btn" title="播放">▶</button>';
    lightbox.appendChild(gifControlsEl);

    gifControlsEl.querySelector('.lightbox-gif-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      // 自动检测当前活跃的动图元素（普通模式 lightboxImg，手机模式 lightboxPhoneImg）
      var activeImg = lightboxImg.getAttribute('data-gif') ? lightboxImg : 
                      (lightboxPhoneImg && lightboxPhoneImg.getAttribute('data-gif') ? lightboxPhoneImg : null);
      if (!activeImg) return;
      var playing = activeImg.src === activeImg.getAttribute('data-gif');
      if (playing) {
        activeImg.src = activeImg.getAttribute('data-static') || activeImg.src;
        this.innerHTML = '▶';
        this.title = '播放';
      } else {
        activeImg.src = activeImg.getAttribute('data-gif');
        this.innerHTML = '⏸';
        this.title = '暂停';
      }
    });
  }

  function removeGifControls() {
    if (gifControlsEl) {
      gifControlsEl.remove();
      gifControlsEl = null;
    }
  }

  // ═══════════════════════════════════════════════════
  // 灯箱水印绘制
  // ═══════════════════════════════════════════════════
})();
