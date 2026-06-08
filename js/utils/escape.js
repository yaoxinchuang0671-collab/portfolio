/**
 * HTML / 属性转义工具
 * 防止 XSS 注入
 */

/**
 * 转义 HTML 特殊字符
 * @param {string} str 原始字符串
 * @returns {string} 转义后的字符串
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 转义 HTML 属性值
 * @param {string} str 原始字符串
 * @returns {string} 转义后的字符串
 */
function escapeAttr(str) {
  return escapeHtml(str);
}

// 兼容全局暴露（旧代码过渡）
window.escapeHtml = escapeHtml;
window.escapeAttr = escapeAttr;
