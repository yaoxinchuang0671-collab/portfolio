/* ==================================================
   装修页面 · 交互逻辑
   所有编辑结果存入 localStorage(key=portfolio_data)
   预览 iframe 在保存后自动刷新，由 main.js 读取并应用数据
   ================================================== */

const STORAGE_KEY = 'portfolio_data';

// ════════════════════════════════════════════════
//  数据层：读取 / 保存 / 重置
// ════════════════════════════════════════════════

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : getDefaultData();
  } catch {
    return getDefaultData();
  }
}

function saveData() {
  const data = collectData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  showToast('✅ 已保存到本地');
  reloadPreview();
}

function resetData() {
  if (!confirm('确定要重置所有内容吗？此操作不可撤销。')) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

function getDefaultData() {
  return {
    logo: 'Portfolio.',
    navLinks: [
      { text: '关于我', href: '#about' },
      { text: '技能',   href: '#skills' },
      { text: '项目',   href: '#projects' },
      { text: '联系',   href: '#contact' },
    ],
    hero: {
      greeting: '👋 你好，我是',
      name: '你的名字',
      titles: ['前端开发工程师', 'UI/UX 设计师', '全栈开发者', '创意工作者'],
      bio: '这里是一段简短的自我介绍，描述你的专业方向、热情所在，以及你能带来的价值。',
      btn1: '查看我的作品',
      btn2: '联系我',
      socials: [
        { name: 'GitHub',  href: '#' },
        { name: 'LinkedIn', href: '#' },
        { name: 'X',       href: '#' },
      ],
    },
    about: {
      title: '我是谁？',
      texts: ['你好，很高兴认识你！', '这里填写你的个人介绍。'],
      stats: ['0+', '0+', '0+'],
      statsLabels: ['年经验', '完成项目', '合作客户'],
      resume: '#',
    },
    skills: {
      title: '我会什么？',
      categories: [
        { name: '前端开发', icon: '💻', tags: ['技能1', '技能2', '技能3'] },
        { name: '后端开发', icon: '⚙️', tags: ['技能1', '技能2', '技能3'] },
        { name: '设计工具', icon: '🎨', tags: ['技能1', '技能2', '技能3'] },
        { name: '其他工具', icon: '🛠️', tags: ['技能1', '技能2', '技能3'] },
      ],
    },
    projects: {
      title: '我做过什么？',
      items: [
        {
          category: 'Web',
          title: '项目名称',
          desc: '项目描述：简要说明这个项目是做什么的，解决了什么问题，有什么亮点。',
          techs: ['技术1', '技术2', '技术3'],
          github: '#',
          demo: '#',
        },
      ],
    },
    contact: {
      title: '一起合作？',
      email: 'your@email.com',
      city: '你的城市，中国',
      status: '● 开放机会',
    },
    footer: '© 2026 · 用 ❤️ 设计并开发',
    character: {
      scale: 85, offsetX: 0, offsetY: 0, opacity: 100,
      brightness: 65, fused: false,
    },
  };
}

// ════════════════════════════════════════════════
//  收集表单数据
// ════════════════════════════════════════════════

function collectData() {
  const data = loadData();

  // 导航
  data.logo = $val('editLogo');

  // 导航链接
  const navRaw = $val('editNavLinks');
  if (navRaw) {
    data.navLinks = navRaw.split('\n').filter(Boolean).map(line => {
      const [text, href] = line.split('|');
      return { text: text?.trim() || '', href: href?.trim() || '#' };
    });
  }

  // Hero
  data.hero.greeting = $val('editGreeting');
  data.hero.name = $val('editName');
  data.hero.titles = $val('editTitles').split('\n').filter(Boolean);
  data.hero.bio = $val('editBio');
  data.hero.btn1 = $val('editBtn1');
  data.hero.btn2 = $val('editBtn2');

  const socialRaw = $val('editSocials');
  if (socialRaw) {
    data.hero.socials = socialRaw.split('\n').filter(Boolean).map(line => {
      const [name, href] = line.split('|');
      return { name: name?.trim() || '', href: href?.trim() || '#' };
    });
  }

  // 人物图
  data.character.scale      = +$val('editScale');
  data.character.offsetX    = +$val('editOffsetX');
  data.character.offsetY    = +$val('editOffsetY');
  data.character.opacity    = +$val('editOpacity');
  data.character.brightness = +$val('editBrightness');
  data.character.fused     = document.getElementById('editBlendMode')?.checked || false;

  // 关于我
  data.about.title  = $val('editAboutTitle');
  data.about.texts  = $val('editAboutText').split('\n\n').filter(Boolean);
  data.about.stats[0] = $val('editStat1');
  data.about.stats[1] = $val('editStat2');
  data.about.stats[2] = $val('editStat3');
  data.about.resume = $val('editResume');

  // 技能
  data.skills.title = $val('editSkillsTitle');
  const skillsRaw = $val('editSkills');
  if (skillsRaw) {
    data.skills.categories = skillsRaw.split('\n').filter(Boolean).map(line => {
      const [name, icon, tags] = line.split('|');
      return {
        name: name?.trim() || '',
        icon: icon?.trim() || '🔹',
        tags: (tags || '').split(',').map(s => s.trim()).filter(Boolean),
      };
    });
  }

  // 项目
  data.projects.title = $val('editProjectsTitle');
  data.projects.items = collectProjects();

  // 联系
  data.contact.title = $val('editContactTitle');
  data.contact.email = $val('editEmail');
  data.contact.city  = $val('editCity');
  data.contact.status = $val('editStatus');

  // 页脚
  data.footer = $val('editFooter');

  return data;
}

function collectProjects() {
  return Array.from(document.querySelectorAll('.edit-project-card')).map(card => ({
    category: card.querySelector('[data-field="category"]')?.value || 'Web',
    title: card.querySelector('[data-field="title"]')?.value || '',
    desc:  card.querySelector('[data-field="desc"]')?.value || '',
    techs: (card.querySelector('[data-field="techs"]')?.value || '').split(',').map(s => s.trim()).filter(Boolean),
    github: card.querySelector('[data-field="github"]')?.value || '#',
    demo:   card.querySelector('[data-field="demo"]')?.value || '#',
  }));
}

// ════════════════════════════════════════════════
//  填充表单
// ════════════════════════════════════════════════

function populateForm(data) {
  // 导航
  $set('editLogo', data.logo);
  $set('editNavLinks', (data.navLinks || []).map(l => `${l.text}|${l.href}`).join('\n'));

  // Hero
  $set('editGreeting', data.hero.greeting);
  $set('editName',      data.hero.name);
  $set('editTitles',    (data.hero.titles || []).join('\n'));
  $set('editBio',       data.hero.bio);
  $set('editBtn1',      data.hero.btn1);
  $set('editBtn2',      data.hero.btn2);
  $set('editSocials',   (data.hero.socials || []).map(s => `${s.name}|${s.href}`).join('\n'));

  // 人物图
  const c = data.character || {};
  $set('editScale',      c.scale      ?? 85);
  $set('editOffsetY',    c.offsetY    ?? 0);
  $set('editOffsetX',    c.offsetX    ?? 0);
  $set('editOpacity',    c.opacity    ?? 100);
  $set('editBrightness', c.brightness ?? 65);
  syncLabel('editScale',      'editScaleVal',      '%');
  syncLabel('editOffsetY',    'editOffsetYVal',    '');
  syncLabel('editOffsetX',    'editOffsetXVal',    '');
  syncLabel('editOpacity',    'editOpacityVal',    '%');
  syncLabel('editBrightness', 'editBrightnessVal', '%');
  const blendCb = document.getElementById('editBlendMode');
  if (blendCb) blendCb.checked = !!c.fused;
  const brightField = document.getElementById('editBrightnessField');
  if (brightField) brightField.style.display = c.fused ? 'flex' : 'none';

  // 关于我
  $set('editAboutTitle',  data.about.title);
  $set('editAboutText',   (data.about.texts || []).join('\n\n'));
  $set('editStat1',       data.about.stats?.[0] || '0+');
  $set('editStat2',       data.about.stats?.[1] || '0+');
  $set('editStat3',       data.about.stats?.[2] || '0+');
  $set('editResume',      data.about.resume);

  // 技能
  $set('editSkillsTitle', data.skills.title);
  $set('editSkills', (data.skills.categories || []).map(
    c => `${c.name}|${c.icon}|${c.tags.join(',')}`
  ).join('\n'));

  // 项目
  $set('editProjectsTitle', data.projects.title);
  renderProjects(data.projects.items || []);

  // 联系
  $set('editContactTitle', data.contact.title);
  $set('editEmail',        data.contact.email);
  $set('editCity',         data.contact.city);
  $set('editStatus',       data.contact.status);

  // 页脚
  $set('editFooter', data.footer);
}

// ════════════════════════════════════════════════
//  项目列表渲染
// ════════════════════════════════════════════════

function renderProjects(items) {
  const container = document.getElementById('editProjectsList');
  if (!container) return;
  container.innerHTML = '';
  items.forEach((item, idx) => {
    container.appendChild(createProjectCard(item, idx));
  });
}

function createProjectCard(item = {}, idx) {
  const div = document.createElement('div');
  div.className = 'edit-project-card';
  div.innerHTML = `
    <button class="edit-project-remove" title="删除此项目">✕</button>
    <div class="edit-field">
      <label>分类标签</label>
      <input type="text" data-field="category" value="${esc(item.category || 'Web')}" placeholder="Web / 移动端 / 其他" />
    </div>
    <div class="edit-field">
      <label>项目标题</label>
      <input type="text" data-field="title" value="${esc(item.title || '')}" placeholder="项目名称" />
    </div>
    <div class="edit-field">
      <label>项目描述</label>
      <textarea data-field="desc" rows="2" placeholder="简要说明这个项目...">${esc(item.desc || '')}</textarea>
    </div>
    <div class="edit-field">
      <label>技术标签（逗号分隔）</label>
      <input type="text" data-field="techs" value="${(item.techs || []).map(esc).join(', ')}" placeholder="React, TypeScript, Node.js" />
    </div>
    <div class="edit-field">
      <label>GitHub 链接</label>
      <input type="text" data-field="github" value="${esc(item.github || '#')}" />
    </div>
    <div class="edit-field">
      <label>预览链接</label>
      <input type="text" data-field="demo" value="${esc(item.demo || '#')}" />
    </div>
  `;
  div.querySelector('.edit-project-remove').addEventListener('click', () => div.remove());
  return div;
}

// ════════════════════════════════════════════════
//  人物图上传（装修页本地预览 + 写入 localStorage）
// ════════════════════════════════════════════════

function initCharUpload() {
  const input = document.getElementById('editCharImg');
  if (!input) return;
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const preview = document.getElementById('editCharPreview');
      if (preview) {
        preview.innerHTML = '';
        const img = document.createElement('img');
        img.src = ev.target.result;
        preview.appendChild(img);
      }
      // 写入 localStorage 让 index.html 的 main.js 能读取图片
      const data = loadData();
      data.character.dataURL = ev.target.result;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    };
    reader.readAsDataURL(file);
  });
}

// ════════════════════════════════════════════════
//  滑块实时同步标签
// ════════════════════════════════════════════════

function initSliders() {
  bindSlider('editScale',      'editScaleVal',      '%');
  bindSlider('editOffsetY',    'editOffsetYVal',    '');
  bindSlider('editOffsetX',    'editOffsetXVal',    '');
  bindSlider('editOpacity',    'editOpacityVal',    '%');
  bindSlider('editBrightness', 'editBrightnessVal', '%');
}

function bindSlider(inputId, labelId, suffix) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener('input', () => syncLabel(inputId, labelId, suffix));
}

function syncLabel(inputId, labelId, suffix) {
  const input = document.getElementById(inputId);
  const label = document.getElementById(labelId);
  if (input && label) label.textContent = input.value + (suffix || '');
}

// ════════════════════════════════════════════════
//  融合模式切换
// ════════════════════════════════════════════════

function initBlendToggle() {
  const cb = document.getElementById('editBlendMode');
  const field = document.getElementById('editBrightnessField');
  if (!cb || !field) return;
  cb.addEventListener('change', () => {
    field.style.display = cb.checked ? 'flex' : 'none';
  });
}

// ════════════════════════════════════════════════
//  添加项目按钮
// ════════════════════════════════════════════════

function initAddProject() {
  const btn = document.getElementById('btnAddProject');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const container = document.getElementById('editProjectsList');
    if (!container) return;
    container.appendChild(createProjectCard({}, container.children.length));
  });
}

// ════════════════════════════════════════════════
//  保存后刷新预览 iframe
// ════════════════════════════════════════════════

function reloadPreview() {
  const frame = document.getElementById('previewFrame');
  if (frame && frame.contentWindow) {
    frame.contentWindow.location.reload();
  }
}

// ════════════════════════════════════════════════
//  Toast 提示
// ════════════════════════════════════════════════

function showToast(msg) {
  const toast = document.getElementById('editToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

// ════════════════════════════════════════════════
//  工具函数
// ════════════════════════════════════════════════

function $val(id) {
  return document.getElementById(id)?.value ?? '';
}

function $set(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val ?? '';
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ════════════════════════════════════════════════
//  初始化
// ════════════════════════════════════════════════

window.addEventListener('DOMContentLoaded', () => {
  const data = loadData();
  populateForm(data);

  document.getElementById('btnSave')?.addEventListener('click', saveData);
  document.getElementById('btnReset')?.addEventListener('click', resetData);
  document.getElementById('btnPreview')?.addEventListener('click', () => {
    window.open('index.html', '_blank');
  });

  initCharUpload();
  initSliders();
  initBlendToggle();
  initAddProject();

  // 实时保存：输入停止 800ms 后自动保存并刷新预览
  let timer = null;
  const sidebar = document.getElementById('editSidebar');
  if (sidebar) {
    sidebar.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(saveData, 800);
    });
    // 滑块和复选框立即保存
    sidebar.addEventListener('change', (e) => {
      if (e.target.type === 'range' || e.target.type === 'checkbox') {
        clearTimeout(timer);
        saveData();
      }
    });
  }
});
