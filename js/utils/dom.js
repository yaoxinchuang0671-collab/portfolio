/**
 * DOM 工具函数
 */

/**
 * 安全地获取单个元素
 * @param {string} selector CSS 选择器
 * @returns {Element|null}
 */
function $(selector) {
  return document.querySelector(selector);
}

/**
 * 安全地获取元素列表
 * @param {string} selector CSS 选择器
 * @returns {NodeListOf<Element>}
 */
function $$(selector) {
  return document.querySelectorAll(selector);
}

/**
 * 节流函数
 * @param {Function} fn 要节流的函数
 * @param {number} wait 等待毫秒数
 * @returns {Function}
 */
function throttle(fn, wait) {
  var last = 0;
  return function () {
    var now = Date.now();
    if (now - last >= wait) {
      last = now;
      fn.apply(this, arguments);
    }
  };
}

/**
 * 防抖函数
 * @param {Function} fn 要防抖的函数
 * @param {number} wait 等待毫秒数
 * @returns {Function}
 */
function debounce(fn, wait) {
  var timer = null;
  return function () {
    var ctx = this;
    var args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () {
      fn.apply(ctx, args);
    }, wait);
  };
}

/**
 * 平滑滚动到元素
 * @param {Element|string} target 目标元素或选择器
 * @param {string} block 对齐方式
 */
function scrollToElement(target, block) {
  block = block || 'start';
  var el = typeof target === 'string' ? $(target) : target;
  if (el && el.scrollIntoView) {
    el.scrollIntoView({ behavior: 'smooth', block: block });
  }
}

// 兼容全局暴露
window.$ = $;
window.$$ = $$;
window.throttle = throttle;
window.debounce = debounce;
window.scrollToElement = scrollToElement;
