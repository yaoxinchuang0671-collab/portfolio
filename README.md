# 潮汐视界 — 个人作品集网站

> **版本**: 3.0  
> **作品数**: 384（9个分类）  
> **图片数**: 870+ 张（含缩略图与三联切片）  
> **构建日期**: 2026-06-10

---

## 一、项目概述

纯前端静态网站（HTML/CSS/JS），赛博科技风个人设计作品集。无后端，数据存储在 JSON 文件和浏览器 localStorage 中。

**v3.0 新增特性**:
- **抖音三联图分类**: 上传 3600×1600 图片后自动垂直切割为 3 等份，瀑布流展示三联缩略，灯箱展示带抖音 UI（黄色置顶角标 + 播放量）的静态三联卡片
- **首屏文字粒子化效果**: "潮汐视界" 由粒子组成，鼠标靠近散开交互
- **分类栏重设计**: 三角洲行动官网风格导航，扁平按钮 + 底部高亮条 + 中英文上下排列
- **账本数据持久化**: 本地开发时数据直接写入 `ledger_data.json` 文件，不依赖浏览器存储

**双平台部署**:
- **GitHub Pages**: 托管网站代码（HTML/JS/CSS）
- **腾讯云 COS**: 托管图片资源（CDN 加速）

**线上地址**:
- 首页: https://yaoxinchuang0671-collab.github.io/portfolio/
- 管理后台: https://yaoxinchuang0671-collab.github.io/portfolio/admin.html
- 账本: https://yaoxinchuang0671-collab.github.io/portfolio/ledger.html
- COS CDN: https://portfolio-images-1438664071.cos.ap-guangzhou.myqcloud.com/

---

## 二、目录结构

```
潮汐视界作品集/
├── index.html          # 首页（作品展示）
├── admin.html          # 管理后台（增删改作品）
├── ledger.html         # 客户账本（localStorage 存数据，可选同步 GitHub）
├── login.html          # 登录页
├── data.json           # 作品/分类数据（核心数据文件）
├── ledger_data.json    # 账本备份数据（GitHub 同步用）
├── render.js           # 前台渲染逻辑（作品展示）
├── main.js             # 前台交互逻辑
├── gallery.js          # 画廊逻辑
├── filter.js           # 筛选逻辑
├── dec.js              # 装饰效果
├── styles.css          # 前台样式
├── gallery.css         # 画廊样式
├── sw.js               # Service Worker（离线缓存）
│
├── build.py            # 构建脚本（合并/压缩/混淆）
├── build/              # 构建输出目录（压缩后的文件，用于部署）
│   ├── index.html
   ├── admin.html
   ├── render.js
   └── ...
│
├── server.py           # 本地开发服务器（支持图片上传/压缩/转换）
├── upload_github_api.py # 部署脚本：代码文件 → GitHub
├── upload_cos.py       # 部署脚本：图片 → 腾讯云 COS
├── download_cos.py     # 工具：从 COS 下载图片
│
├── img/                # 本地图片目录
│   ├── *.webp          # 原图（构建时上传 COS）
│   └── thumb_*.webp    # 缩略图（构建时上传 COS）
│
├── data/               # 数据备份目录
│   └── works.json      # 旧格式备份（可忽略）
│
├── package.json        # Node.js 依赖配置（ESLint/Prettier）
└── README.md           # 本文件
```

---

## 三、环境依赖

### Python 依赖
```bash
pip install Pillow imageio[ffmpeg] psd-tools qcloud-cos-python-sdk-v5 requests
```

| 库 | 用途 |
|---|---|
| Pillow | 图片处理、WebP 压缩 |
| imageio[ffmpeg] | GIF/视频 转 动画 WebP |
| psd-tools | PSD 文件读取、合并图层 |
| qcloud-cos-python-sdk-v5 | 腾讯云 COS 上传 |
| requests | GitHub API 调用 |

### Node.js 依赖（可选，用于代码格式化）
```bash
npm install
```

---

## 四、关键配置说明

### 4.1 GitHub 仓库配置 (`upload_github_api.py`)
```python
TOKEN       = "ghp_xxx"              # GitHub Personal Access Token
REPO_OWNER  = "yaoxinchuang0671-collab"
REPO_NAME   = "portfolio"
BRANCH      = "main"
```
- **Token 有效期**: 注意 GitHub Token 有过期时间，失效后需重新生成
- **Token 权限**: 需要 `repo` 权限（读写仓库内容）

### 4.2 腾讯云 COS 配置 (`upload_cos.py`)
```python
SECRET_ID   = "AKIDxxx"
SECRET_KEY  = "Lhvxxx"
REGION      = "ap-guangzhou"
BUCKET      = "portfolio-images-1438664071"
COS_PREFIX  = "portfolio/"           # 图片在 COS 上的前缀
```
- **SecretKey 安全**: 不要上传到公共仓库
- **CDN 地址**: `https://portfolio-images-1438664071.cos.ap-guangzhou.myqcloud.com/`

### 4.3 CDN 路径映射

本地路径 → COS 路径 的映射规则（`render.js` / `admin.html` 中定义）:

```
img/xxx.webp     →  https://.../portfolio/xxx.webp
img/thumb_*.webp →  https://.../portfolio/thumb_*.webp
```

即: 去掉 `img/` 前缀，加上 `portfolio/` 前缀。

---

## 五、常用操作

### 5.1 启动本地开发服务器
```bash
python server.py
```
- 默认端口: `8080`
- 访问: http://localhost:8080
- 功能: 支持所有格式图片上传，自动转 WebP，生成缩略图；**抖音三联图自动垂直切割（3等分）**

### 5.2 构建项目
```bash
python build.py
```
- 合并内联 CSS/JS
- 压缩 HTML（去除空白）
- 压缩 JS（操作符去空格，**但会保护字符串字面量**）
- 输出到 `build/` 目录

> 注意: 构建后的文件用于部署，开发时直接编辑根目录源文件。

### 5.3 部署代码到 GitHub
```bash
python upload_github_api.py
```
- 只上传代码文件（`.html` `.js` `.css` `.json` `.md`）
- **不上传图片**（图片走 COS CDN）
- 支持增量上传（对比 sha256）

### 5.4 部署图片到 COS
```bash
# 增量上传（只传新增/修改的图片）
python upload_cos.py

# 强制重传所有图片
python upload_cos.py --force

# 清空 COS 图片目录（慎用）
python upload_cos.py --clean

# 上传静态网站文件到 COS（备用）
python upload_cos.py --website
```

### 5.5 完整部署流程
```bash
# 1. 编辑源文件（index.html, admin.html, render.js 等）
# 2. 构建
python build.py

# 3. 上传代码到 GitHub
python upload_github_api.py

# 4. 上传新增图片到 COS（如有新图）
python upload_cos.py
```

---

## 六、账本（ledger）说明

### 6.1 数据存储
- **本地开发**: 数据直接写入 `ledger_data.json` 文件（不依赖浏览器 localStorage，清空浏览器数据不受影响）
- **线上环境**: `localStorage['tidal_ledger_store']` + GitHub 云端同步
- **云端**: `ledger_data.json`（通过 GitHub API 同步到仓库）

### 6.2 同步机制
- **本地环境**: 数据修改后自动写入 `ledger_data.json`（防抖 1200ms），时间戳采用北京时间（`+08:00`）
- **上传到 GitHub**: 点击按钮，账本数据以 Base64 形式写入云端 `ledger_data.json`
- **强制刷新**: 从 GitHub 拉取最新数据并覆盖本地文件

### 6.3 换电脑恢复账本
1. 将整个项目文件夹（含 `ledger_data.json`）复制到新电脑
2. 或在新电脑上执行「强制刷新数据」从 GitHub 拉取

---

## 七、已知问题与修复记录

### 7.1 build.py minify_js 破坏字符串空格（已修复）
**问题**: `rootMargin: '0px 0px -40px 0px'` 被压缩成 `rootMargin:'0px 0px-40px 0px'`，导致 `IntersectionObserver` 语法错误。  
**修复**: `minify_js` 中添加字符串字面量保护机制（提取 → 占位符 → 压缩 → 恢复）。

### 7.2 admin.html 缩略图路径未转 CDN（已修复）
**问题**: 管理后台缩略图使用相对路径 `img/thumb_*.webp`，GitHub Pages 上请求 404。  
**修复**: 在 `admin.html` 中添加 `CDN_BASE` + `toCdnUrl()` 函数，与 `render.js` 保持一致。

### 7.3 账本 GitHub 同步 404（已修复）
**问题**: `ledger_data.json` 不存在时，`getGithubFileSha()` 遇到 404 直接报错。  
**修复**: 404 返回 `null`，`saveToGitHub()` 不传 sha 参数则创建新文件。

### 7.4 Service Worker 缓存旧版本
**问题**: 修复上传后，用户刷新仍看到旧错误。  
**解决**: 必须手动注销 Service Worker（F12 → Application → Service Workers → Unregister）。

### 7.5 账本时间显示为 UTC（已修复）
**问题**: `syncedAt` 使用 `new Date().toISOString()` 存储 UTC 时间，显示时未转换时区，导致北京时间用户看到的时间差 8 小时。  
**修复**: 新增 `getBeijingISOString()` 存储北京时间 ISO（`+08:00`），`formatSyncTime()` 统一将 ISO 字符串转为北京时间 `YYYY-MM-DD HH:MM` 显示。

### 7.6 账本数据依赖浏览器 localStorage（已修复）
**问题**: 本地开发时账本数据只存 localStorage，清空浏览器即丢失。  
**修复**: 本地环境 `watchEffect` 直接调用 `syncToServer()` 写入 `ledger_data.json`，跳过 localStorage；加载失败时保留当前数据，避免 server 未启动导致数据清空。

---

## 八、换电脑迁移指南

### 8.1 需要备份的文件
将整个 `C:\潮汐视界作品集\` 文件夹复制到新电脑即可，其中包含:
- 所有源代码
- 本地图片 (`img/`)
- 配置文件（含敏感信息）
- 账本备份 (`ledger_data.json`)

### 8.2 新电脑初始化步骤
```bash
# 1. 安装 Python 依赖
pip install Pillow imageio[ffmpeg] psd-tools qcloud-cos-python-sdk-v5 requests

# 2. 安装 Node.js 依赖（可选）
npm install

# 3. 启动本地服务器
python server.py

# 4. 访问 http://localhost:8080 验证
```

### 8.3 检查配置有效性
- **GitHub Token**: 在 https://github.com/settings/tokens 检查是否过期
- **COS 密钥**: 在腾讯云控制台检查 SecretKey 是否有效
- **Token 过期**: 重新生成后更新 `upload_github_api.py` 中的 `TOKEN`

### 8.4 如果账本数据在旧电脑 localStorage 中
在旧电脑账本页面按 F12 → Console:
```js
const data = localStorage.getItem('tidal_ledger_store');
console.log(data);
```
复制输出内容，在新电脑同样位置执行:
```js
localStorage.setItem('tidal_ledger_store', '粘贴刚才复制的数据');
```
然后点击「上传到 GitHub」同步到云端。

---

## 九、文件修改记录

### v3.0（2026-06-10）

| 文件 | 修改内容 |
|------|---------|
| `index.html` | 首屏结构适配粒子效果 |
| `styles.css` | Hero 区域底部布局、粒子 Canvas pointer-events |
| `js/effects/particles.js` | **重写**：文字粒子化效果（离屏 Canvas 采样 + 鼠标排斥交互） |
| `render.js` | 新增抖音三联图渲染逻辑、分类配置 `window._categoryConfig`、懒加载 `.triptych-slice` |
| `gallery.js` | 三联图灯箱（3:4 比例）、静态展示带抖音 UI（置顶角标 + 播放量） |
| `gallery.css` | 三联图样式（9:4 缩略）、**分类栏重设计**（三角洲导航风格） |
| `server.py` / `upload_server.py` | 新增 `cut_triptych()` 垂直切割函数，上传自动识别三联图分类 |
| `data.json` | 新增「抖音三联图」分类（35 个作品），添加 `labelEn` 字段 |
| `ledger.html` | **账本数据持久化**：本地直接写 `ledger_data.json` 文件；修复时间时区显示（北京时间 `+08:00`） |
| `README.md` | 更新版本号、统计数据、新增特性说明 |

### v2.0（2026-06-09）

| 文件 | 修改内容 |
|------|---------|
| `build.py` | `minify_js` 添加字符串字面量保护，防止破坏 CSS/JS 字符串 |
| `admin.html` | 添加 `CDN_BASE` + `toCdnUrl()`，缩略图和大图走 COS CDN |
| `render.js` | `toCdnUrl` 添加 `encodeURI` 处理中文文件名 |
| `ledger.html` | 修复 GitHub 同步 404 问题（支持创建新文件） |
| `server.py` | 全面重写：支持所有格式上传，GIF/视频转动画 WebP，ThreadingHTTPServer |

---

## 十、注意事项

1. **GitHub Token 安全**: `upload_github_api.py` 中的 Token 是敏感信息，不要提交到公开仓库
2. **COS 费用**: 图片存储和 CDN 流量会产生费用，注意监控
3. **图片备份**: `img/` 目录是唯一的本地图片副本，务必定期备份
4. **构建前编辑源文件**: 修改 `index.html` / `admin.html` / `render.js` 等根目录文件，然后运行 `build.py`，不要直接修改 `build/` 目录下的文件
