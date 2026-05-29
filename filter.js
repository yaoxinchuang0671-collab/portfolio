/* =================================================
   分类筛选逻辑
   ================================================= */

(function () {
  const filterBar  = document.getElementById('filterBar');
  if (!filterBar) return;

  const buttons = filterBar.querySelectorAll('.filter-btn');
  const items   = document.querySelectorAll('.waterfall-item');

  filterBar.addEventListener('click', function (e) {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;

    // 切换 active 状态
    buttons.forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');

    var cat = btn.dataset.filter;

    items.forEach(function (item) {
      if (cat === 'all' || item.dataset.category === cat) {
        item.style.display = '';
        // 重新触发瀑布流重排动画
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
