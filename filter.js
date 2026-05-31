/* =================================================
   分类筛选逻辑（事件委托版，兼容动态渲染）
   ================================================= */
(function () {
  const filterBar = document.getElementById('filterBar');
  if (!filterBar) return;

  // 用事件委托监听分类按钮点击
  filterBar.addEventListener('click', function (e) {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;

    // 切换 active 状态
    filterBar.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');

    var cat = btn.dataset.filter;
    var items = document.querySelectorAll('.waterfall-item');

    items.forEach(function (item) {
      if (cat === 'all' || item.dataset.category === cat) {
        item.style.display = '';
        // 重新触发动画
        item.style.opacity = '0';
        item.style.transform = 'translateY(12px)';
        setTimeout(function () {
          item.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
          item.style.opacity = '1';
          item.style.transform = 'translateY(0)';
        }, 30);
      } else {
        item.style.transition = 'opacity 0.25s ease';
        item.style.opacity = '0';
        item.style.transform = 'translateY(8px)';
        setTimeout(function () {
          item.style.display = 'none';
        }, 250);
      }
    });
  });
})();
