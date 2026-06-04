#!/usr/bin/env python3
"""HTTP服务器 + 图片上传接口，绑定到0.0.0.0，供局域网访问portfolio"""
import http.server
import socketserver
import os
import re
import json
import sys
import time
import socket
import shutil
import secrets
from PIL import Image, ImageSequence, ImageDraw, ImageFont
from psd_tools import PSDImage

# ── 认证配置 ─────────────────────────────────────
# 固定 Token（修改此处可更换，也可设环境变量 AUTH_TOKEN 覆盖）
FIXED_TOKEN = 'tidal_Admin_2026_Xc7vKpQwE9mZrT3nF2jL8sD'
AUTH_TOKEN = os.environ.get('AUTH_TOKEN') or FIXED_TOKEN
print('=' * 60)
print('[Token] 管理后台登录 Token：')
print('  Bearer ' + AUTH_TOKEN)
print('  >> 可设置环境变量 AUTH_TOKEN 覆盖')
print('=' * 60)

def check_auth(handler):
    """检查 Authorization Bearer Token，失败返回 True（意为：已拒绝）"""
    auth = handler.headers.get('Authorization', '')
    prefix = 'Bearer '
    if auth.startswith(prefix) and auth[len(prefix):] == AUTH_TOKEN:
        return False  # 认证通过
    # 未认证，返回 401
    handler.send_response(401)
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    handler.send_header('WWW-Authenticate', 'Bearer realm="admin"')
    handler.end_headers()
    handler.wfile.write(json.dumps({'error': 'Unauthorized', 'code': 401}).encode('utf-8'))
    return True   # 已拒绝


# ── 中文字体路径 ──
_FONT_CANDIDATES = [
    'C:/Windows/Fonts/NotoSansSC-VF.ttf',
    'C:/Windows/Fonts/simhei.ttf',
]
_WATERMARK_FONT = None
for _fp in _FONT_CANDIDATES:
    if os.path.exists(_fp):
        _WATERMARK_FONT = _fp
        break


def add_watermark(img, brand='潮汐视界', url='yaoxinchuang.art'):
    """给图片添加右下角半透明水印，返回新图片（不影响原图）
    跳过动图和尺寸过小的图片
    """
    # 跳过动图
    if getattr(img, 'is_animated', False) and getattr(img, 'n_frames', 1) > 1:
        return img

    w, h = img.size
    if w < 200 or h < 150:
        return img  # 太小不加

    # 字号：图片宽度的 4%（品牌名）和 2.5%（副文字）
    brand_sz = max(16, int(w * 0.04))
    url_sz = max(11, int(w * 0.025))

    try:
        f_brand = ImageFont.truetype(_WATERMARK_FONT, brand_sz)
        f_url = ImageFont.truetype(_WATERMARK_FONT, url_sz)
    except Exception:
        return img  # 字体加载失败，跳过水印

    # 测量文字尺寸
    tmp = Image.new('RGBA', (1, 1))
    td = ImageDraw.Draw(tmp)
    bb = td.textbbox((0, 0), brand, font=f_brand)
    bw, bh = bb[2] - bb[0], bb[3] - bb[1]
    ub = td.textbbox((0, 0), url, font=f_url)
    uw, uh = ub[2] - ub[0], ub[3] - ub[1]

    # 位置：右下角
    margin = max(12, int(min(w, h) * 0.03))
    gap = int(brand_sz * 0.3)
    total_h = bh + gap + uh
    x_brand = w - margin - bw
    y_brand = h - margin - total_h
    x_url = w - margin - uw
    y_url = y_brand + bh + gap

    # 透明度：品牌名 18%，网址 13%
    alpha_brand = int(255 * 0.18)
    alpha_url = int(255 * 0.13)

    # 绘制到 RGBA 叠加层
    overlay = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.text((x_brand, y_brand), brand, font=f_brand, fill=(255, 255, 255, alpha_brand))
    draw.text((x_url, y_url), url, font=f_url, fill=(255, 255, 255, alpha_url))

    # 合成：原图 → RGBA → 叠加 → 还原原图色彩模式
    if img.mode == 'RGBA':
        result = Image.alpha_composite(img, overlay)
    elif img.mode == 'LA':
        rgba = img.convert('RGBA')
        result = Image.alpha_composite(rgba, overlay)
        result = result.convert('LA')
    elif img.mode == 'P':
        rgba = img.convert('RGBA')
        result = Image.alpha_composite(rgba, overlay)
        # 保持 RGBA，不再量化回 P 模式（Pillow 12 量化 RGBA 不支持 MEDIANCUT）
    else:
        rgba = img.convert('RGBA')
        result = Image.alpha_composite(rgba, overlay)
        result = result.convert('RGB')

    return result


def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "0.0.0.0"


PORT = 8899
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# 自动适配：如果在 portfolio 目录内运行，DIRECTORY = BASE_DIR；否则指到 portfolio 子目录
_PORTFOLIO_CANDIDATE = os.path.join(BASE_DIR, 'portfolio')
DIRECTORY = _PORTFOLIO_CANDIDATE if os.path.isdir(_PORTFOLIO_CANDIDATE) else BASE_DIR
IMG_DIR = os.path.join(DIRECTORY, 'img')

# 允许的图片/视频格式
ALLOWED_EXT = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico', '.psd',
                '.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.flv'}


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        '': 'application/octet-stream',
        '.html': 'text/html;charset=utf-8',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json;charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.gif': 'image/gif',
        '.ico': 'image/x-icon',
        '.webp': 'image/webp',
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_POST(self):
        """处理 POST 请求（全部需要认证）"""
        if check_auth(self):
            return
        if self.path == '/upload':
            self.handle_upload()
        elif self.path == '/compress-gif':
            self.handle_compress_gif()
        elif self.path == '/compress-image':
            self.handle_compress_image()
        elif self.path == '/save-data':
            self.handle_save_data()
        elif self.path == '/batch-category':
            self.handle_batch_category()
        elif self.path == '/rename-image':
            self.handle_rename_image()
        elif self.path == '/renumber-all':
            self.handle_renumber_all()
        elif self.path.startswith('/publish'):
            self.handle_publish()
        elif self.path == '/save-ledger':
            self.handle_save_ledger()
        else:
            self.send_error(404, 'Not Found')

    def do_DELETE(self):
        """删除文件（?path=相对路径，需要认证）"""
        if check_auth(self):
            return
        from urllib.parse import urlparse, parse_qs
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        rel_path = params.get('path', [None])[0]
        if not rel_path:
            self.send_json(400, {'error': '缺少 path 参数'})
            return
        # 安全检查：只允许删除 img/ 下的文件
        abs_path = os.path.normpath(os.path.join(DIRECTORY, rel_path))
        img_dir = os.path.normpath(os.path.join(DIRECTORY, 'img'))
        if not abs_path.startswith(img_dir):
            self.send_json(403, {'error': '只能删除 img/ 目录下的文件'})
            return
        if not os.path.isfile(abs_path):
            self.send_json(404, {'error': '文件不存在'})
            return
        try:
            os.remove(abs_path)
            self.send_json(200, {'ok': True, 'deleted': rel_path})
        except Exception as e:
            self.send_json(500, {'error': str(e)})

    def send_json(self, code, data):
        """工具方法：发送 JSON 响应"""
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # def do_GET(self):
    #     """GET 请求全部公开（静态文件、data.json 不敏感）"""
    #     super().do_GET()

    def handle_upload(self):
        """接收 multipart/form-data 上传的图片，保存到 img/ 目录"""
        try:
            content_type = self.headers.get('Content-Type', '')
            if not content_type.startswith('multipart/form-data'):
                self.send_error(400, '需要 multipart/form-data')
                return

            boundary = content_type.split('boundary=')[1].encode() if 'boundary=' in content_type else None
            if not boundary:
                self.send_error(400, '缺少 boundary')
                return

            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)

            parts = body.split(b'--' + boundary)
            file_data = None
            filename = None

            for part in parts:
                if b'Content-Disposition' not in part:
                    continue
                header_end = part.find(b'\r\n\r\n')
                if header_end == -1:
                    continue
                headers_raw = part[:header_end].decode('utf-8', errors='replace')
                disp_match = re.search(r'filename="([^"]*)"', headers_raw)
                if not disp_match:
                    continue
                filename = disp_match.group(1)
                file_content = part[header_end + 4:]
                file_content = file_content.rstrip(b'\r\n')
                file_data = file_content
                break

            if not file_data or not filename:
                self._json_response(400, {'error': '未找到上传文件'})
                return

            ext = os.path.splitext(filename)[1].lower()
            if ext not in ALLOWED_EXT:
                self._json_response(400, {'error': f'不支持的文件格式: {ext}，仅支持图片'})
                return

            # 无论上传什么格式，统一存为 WebP
            base, _ = os.path.splitext(filename)
            safe_name = re.sub(r'[^a-zA-Z0-9_\-\u4e00-\u9fff]', '_', base)
            ts = int(time.time() * 1000)
            save_name = f'{safe_name}_{ts}.webp'
            save_path = os.path.join(IMG_DIR, save_name)

            try:
                # ── 视频文件：优先 ffmpeg 直接编码 animated WebP，失败回退 Pillow 方案 ──
                VIDEO_EXTS = {'.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.flv'}
                if ext in VIDEO_EXTS:
                    import tempfile, subprocess, imageio_ffmpeg, io, glob
                    from PIL import Image

                    tmp_vid = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
                    tmp_vid.write(file_data)
                    tmp_vid.close()
                    tmp_path = tmp_vid.name

                    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
                    print(f'[upload] 视频转 animated WebP: {filename}')

                    try:
                        # ── 方案A：ffmpeg 直接编码 animated WebP（快、省内存）──
                        webp_cmd = [
                            ffmpeg_exe, '-i', tmp_path,
                            '-vf', 'fps=15,scale=1200:-1:flags=lanczos',
                            '-c:v', 'libwebp_anim',
                            '-loop', '0',
                            '-quality', '82',
                            '-preset', 'default',
                            '-an', '-y', save_path
                        ]
                        result = subprocess.run(
                            webp_cmd,
                            capture_output=True, text=True,
                            encoding='utf-8', errors='replace',
                            timeout=120
                        )
                        ffmpeg_webp_ok = (result.returncode == 0 and os.path.exists(save_path)
                                             and os.path.getsize(save_path) > 1024)

                        if ffmpeg_webp_ok:
                            # ffmpeg 直接编码成功
                            with open(save_path, 'rb') as f:
                                compressed_data = f.read()
                            print(f'[upload] ffmpeg 直接编码 WebP: {len(compressed_data):,} bytes')

                            # 用 ffmpeg 提取第一帧做缩略图
                            os.makedirs(IMG_DIR, exist_ok=True)
                            thumb_path = os.path.join(IMG_DIR, f'thumb_{save_name}')
                            thumb_cmd = [
                                ffmpeg_exe, '-i', tmp_path,
                                '-vf', 'select=eq(n\\,0),scale=1200:-1:flags=lanczos',
                                '-vsync', 'vfr', '-frames:v', '1',
                                '-y', thumb_path.replace('.webp', '.png')
                            ]
                            subprocess.run(thumb_cmd, capture_output=True, timeout=30)
                            thumb_png = thumb_path.replace('.webp', '.png')
                            if os.path.exists(thumb_png):
                                thumb_img = Image.open(thumb_png).convert('RGB')
                                thumb_img.save(thumb_path, format='WEBP', quality=82, method=6)
                                thumb_img.close()
                                os.unlink(thumb_png)
                            else:
                                # 备用：Pillow 打开已生成的 WebP 取第一帧
                                webp_img = Image.open(save_path)
                                thumb_img = webp_img.copy()
                                thumb_img.save(thumb_path, format='WEBP', quality=82, method=6)
                                webp_img.close()
                            thumb_relative_path = f'img/thumb_{save_name}'
                            print(f'[upload] 缩略图已保存: {thumb_relative_path}')

                        else:
                            # ── 方案B：ffmpeg 提取帧 → Pillow 合成（回退方案）──
                            print(f'[upload] ffmpeg 不直接支持 WebP，回退到 Pillow 方案')
                            with tempfile.TemporaryDirectory() as tmpdir:
                                frame_pattern = tmpdir + '/frame_%05d.png'
                                extract_cmd = [
                                    ffmpeg_exe, '-i', tmp_path,
                                    '-r', '15',
                                    '-vf', 'scale=1200:-1:flags=lanczos',
                                    '-an', '-y', frame_pattern
                                ]
                                try:
                                    result = subprocess.run(extract_cmd, capture_output=True,
                                                                        text=True, encoding='utf-8',
                                                                        errors='replace', timeout=180)
                                except subprocess.TimeoutExpired:
                                    raise RuntimeError('视频处理超时（>3分钟），文件可能过大（建议<50MB）')
                                if result.returncode != 0:
                                    raise RuntimeError(f'帧提取失败: {result.stderr[-500:]}')

                                frame_files = sorted(glob.glob(tmpdir + '/frame_*.png'))
                                if not frame_files:
                                    raise RuntimeError('未提取到任何帧')
                                if len(frame_files) > 300:
                                    step = len(frame_files) // 300 + 1
                                    frame_files = frame_files[::step]

                                # 视频帧转 RGB（视频无透明通道，省一半内存）
                                frames = []
                                for fp in frame_files:
                                    img = Image.open(fp).convert('RGB')
                                    frames.append(img.copy())
                                    img.close()

                                frame_duration = 1000 // 15
                                out_buf = io.BytesIO()
                                frames[0].save(
                                    out_buf, format='WEBP', save_all=True,
                                    append_images=frames[1:],
                                    duration=frame_duration, loop=0,
                                    quality=82, method=4,
                                )
                                compressed_data = out_buf.getvalue()

                                os.makedirs(IMG_DIR, exist_ok=True)
                                thumb_path = os.path.join(IMG_DIR, f'thumb_{save_name}')
                                thumb_img = Image.open(frame_files[0]).convert('RGB')
                                thumb_img.save(thumb_path, format='WEBP', quality=82, method=6)
                                thumb_img.close()
                                thumb_relative_path = f'img/thumb_{save_name}'
                                print(f'[upload] 缩略图已保存: {thumb_relative_path}')

                    except Exception as e:
                        if os.path.exists(tmp_path):
                            os.unlink(tmp_path)
                        raise e

                    # 清理临时视频文件
                    if os.path.exists(tmp_path):
                        os.unlink(tmp_path)

                    original_size = len(file_data)
                    compressed_size = len(compressed_data)
                    saved_pct = round((1 - compressed_size / original_size) * 100, 1) if original_size > 0 else 0
                    print(f'[upload] 视频 → WebP: {original_size/1024:.1f}KB → {compressed_size/1024:.1f}KB (-{saved_pct}%)')
                    # save_path 可能已由 ffmpeg 直接写入，无需重复写入
                    if not os.path.exists(save_path):
                        os.makedirs(IMG_DIR, exist_ok=True)
                        with open(save_path, 'wb') as f:
                            f.write(compressed_data)
                    relative_path = f'img/{save_name}'
                    print(f'[upload] 已保存: {relative_path} ({compressed_size/1024:.1f} KB)')
                    self._json_response(200, {
                        'ok': True,
                        'path': relative_path,
                        'thumbnail': thumb_relative_path,
                        'size': compressed_size,
                        'originalSize': original_size,
                        'savedPct': saved_pct,
                        'name': save_name,
                    })
                    return

                # ── 图片文件：PSD / 普通图片 ──
                if ext == '.psd':
                    import time as _t
                    _start = _t.time()
                    psd = PSDImage.open(io.BytesIO(file_data))
                    img = psd.composite()  # 直接获取合成后的 PIL Image
                    # 确保 RGB/RGBA 模式（PSD 可能为 CMYK）
                    if img.mode == 'CMYK':
                        img = img.convert('RGB')
                    elif img.mode not in ('RGB', 'RGBA', 'LA', 'P'):
                        img = img.convert('RGBA')
                    print(f'[upload] PSD 合成耗时: {_t.time()-_start:.2f}s')
                else:
                    img = Image.open(io.BytesIO(file_data))
                # 颜色模式：动图保留 RGBA，静态图转 RGB
                MAX_WIDTH = 1200
                is_anim = getattr(img, 'is_animated', False) and img.n_frames > 1
                out_buf = io.BytesIO()
                if is_anim:
                    w, h = img.size
                    resize_ratio = None
                    if w > MAX_WIDTH:
                        resize_ratio = MAX_WIDTH / w
                        new_size = (MAX_WIDTH, int(h * resize_ratio))
                    frames = []
                    durations = []
                    for frame in ImageSequence.Iterator(img):
                        if resize_ratio:
                            frame = frame.resize(new_size, Image.LANCZOS)
                        rgba = frame.convert('RGBA')
                        frames.append(rgba)
                        durations.append(frame.info.get('duration', 100))
                    frames[0].save(
                        out_buf, format='WEBP', save_all=True,
                        append_images=frames[1:],
                        duration=durations, loop=0, quality=82, method=6,
                    )
                else:
                    w, h = img.size
                    if w > MAX_WIDTH:
                        ratio = MAX_WIDTH / w
                        img = img.resize((MAX_WIDTH, int(h * ratio)), Image.LANCZOS)
                    if img.mode in ('RGBA', 'LA'):
                        pass  # 保留透明
                    elif img.mode == 'P':
                        img = img.convert('RGBA')
                    else:
                        img = img.convert('RGB')
                    img = add_watermark(img)       # 右下角半透明水印
                    img.save(out_buf, format='WEBP', quality=82, method=6)
                compressed_data = out_buf.getvalue()
                print(f'[upload] {ext} → WebP: {len(file_data)/1024:.1f}KB → {len(compressed_data)/1024:.1f}KB')
            except Exception as e:
                print(f'[upload] WebP 转换失败: {e}')
                # 视频转换失败时直接返回错误，避免保存错误格式的文件
                if ext in {'.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.flv'}:
                    self._json_response(500, {
                        'error': f'视频转 WebP 失败: {str(e)[:200]}'
                    })
                    return
                # 图片转换失败：回退保存原格式，确保扩展名与路径一致
                compressed_data = file_data
                save_name = f'{safe_name}_{ts}{ext}'
                save_path = os.path.join(IMG_DIR, save_name)

            os.makedirs(IMG_DIR, exist_ok=True)
            with open(save_path, 'wb') as f:
                f.write(compressed_data)

            relative_path = f'img/{save_name}'
            file_size = len(compressed_data)
            print(f'[upload] 已保存: {relative_path} ({file_size/1024:.1f} KB)')
            self._json_response(200, {
                'ok': True,
                'path': relative_path,
                'size': file_size,
                'name': save_name,
            })

        except Exception as e:
            print(f'[upload] 错误: {e}')
            self._json_response(500, {'error': str(e)})

    def handle_compress_gif(self):
        """接收 GIF 文件，用 Pillow 压缩后保存到 img/ 目录，返回前后大小"""
        try:
            content_type = self.headers.get('Content-Type', '')
            if not content_type.startswith('multipart/form-data'):
                self._json_response(400, {'error': '需要 multipart/form-data'})
                return

            boundary = content_type.split('boundary=')[1].encode() if 'boundary=' in content_type else None
            if not boundary:
                self._json_response(400, {'error': '缺少 boundary'})
                return

            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            parts = body.split(b'--' + boundary)
            file_data = None
            filename = None

            for part in parts:
                if b'Content-Disposition' not in part:
                    continue
                header_end = part.find(b'\r\n\r\n')
                if header_end == -1:
                    continue
                headers_raw = part[:header_end].decode('utf-8', errors='replace')
                disp_match = re.search(r'filename="([^"]*)"', headers_raw)
                if not disp_match:
                    continue
                filename = disp_match.group(1)
                file_content = part[header_end + 4:]
                file_content = file_content.rstrip(b'\r\n')
                file_data = file_content
                break

            if not file_data or not filename:
                self._json_response(400, {'error': '未找到上传文件'})
                return

            # 只允许 GIF
            ext = os.path.splitext(filename)[1].lower()
            if ext != '.gif':
                self._json_response(400, {'error': f'仅支持 GIF 格式，收到: {ext}'})
                return

            original_size = len(file_data)
            print(f'[compress] 收到 GIF: {filename} ({original_size/1024:.1f} KB)，开始压缩...')

            # ── Pillow 压缩 ──
            import io
            img = Image.open(io.BytesIO(file_data))

            # 宽度限制 1200px
            MAX_WIDTH = 1200
            w, h = img.size
            resize_ratio = None
            if w > MAX_WIDTH:
                resize_ratio = MAX_WIDTH / w
                new_size = (MAX_WIDTH, int(h * resize_ratio))
                # 需要先缩放所有帧

            # 提取所有帧
            frames = []
            durations = []
            for frame in ImageSequence.Iterator(img):
                if resize_ratio:
                    frame = frame.resize(new_size, Image.LANCZOS)
                converted = frame.convert('P', palette=Image.Palette.ADAPTIVE, colors=128)
                frames.append(converted.copy())
                durations.append(frame.info.get('duration', 100))

            # 跳帧：保留 1/2 帧
            total = len(frames)
            keep_step = max(2, total // (total // 2)) if total > 1 else 1
            keep_frames = frames[::keep_step]
            keep_durations = durations[::keep_step]

            # 保存为 WebP 动图（比 GIF 小得多）
            out_buf = io.BytesIO()
            # 转为 RGBA 保留透明
            webp_frames = []
            for f in keep_frames:
                if f.mode != 'RGBA':
                    webp_frames.append(f.convert('RGBA'))
                else:
                    webp_frames.append(f)
            webp_frames[0].save(
                out_buf, format='WEBP', save_all=True,
                append_images=webp_frames[1:],
                duration=keep_durations,
                loop=0, quality=82, method=6,
            )
            compressed_data = out_buf.getvalue()
            compressed_size = len(compressed_data)

            # 如果 WebP 比原 GIF 大，降级用原图转静态 WebP
            if compressed_size >= original_size:
                print(f'[compress] WebP动图变大，改用原图质量 82 静态 WebP')
                img.seek(0)
                static = img.convert('RGBA')
                w, h = static.size
                if w > 1200:
                    static = static.resize((1200, int(h * 1200 / w)), Image.LANCZOS)
                out_buf2 = io.BytesIO()
                static.save(out_buf2, format='WEBP', quality=82, method=6)
                compressed_data = out_buf2.getvalue()
                compressed_size = len(compressed_data)

            pct = round((1 - compressed_size / original_size) * 100, 1)
            print(f'[compress] GIF→WebP: {original_size/1024:.1f}KB → {compressed_size/1024:.1f}KB (-{pct}%)')

            # 保存
            base, _ = os.path.splitext(filename)
            safe_name = re.sub(r'[^a-zA-Z0-9_\-\u4e00-\u9fff]', '_', base)
            save_name = f'{safe_name}_{int(time.time() * 1000)}.webp'
            save_path = os.path.join(IMG_DIR, save_name)
            os.makedirs(IMG_DIR, exist_ok=True)
            with open(save_path, 'wb') as f:
                f.write(compressed_data)

            relative_path = f'img/{save_name}'
            self._json_response(200, {
                'ok': True,
                'path': relative_path,
                'originalSize': original_size,
                'compressedSize': compressed_size,
                'savedPct': round((1 - compressed_size / original_size) * 100, 1),
                'name': save_name,
            })

        except Exception as e:
            print(f'[compress] 错误: {e}')
            import traceback
            traceback.print_exc()
            self._json_response(500, {'error': str(e)})

    def handle_compress_image(self):
        """接收任意图片，根据格式自动选择最优压缩策略保存到 img/ 目录"""
        try:
            content_type = self.headers.get('Content-Type', '')
            if not content_type.startswith('multipart/form-data'):
                self._json_response(400, {'error': '需要 multipart/form-data'})
                return

            boundary = content_type.split('boundary=')[1].encode() if 'boundary=' in content_type else None
            if not boundary:
                self._json_response(400, {'error': '缺少 boundary'})
                return

            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            parts = body.split(b'--' + boundary)
            file_data = None
            filename = None

            for part in parts:
                if b'Content-Disposition' not in part:
                    continue
                header_end = part.find(b'\r\n\r\n')
                if header_end == -1:
                    continue
                headers_raw = part[:header_end].decode('utf-8', errors='replace')
                disp_match = re.search(r'filename="([^"]*)"', headers_raw)
                if not disp_match:
                    continue
                filename = disp_match.group(1)
                file_content = part[header_end + 4:]
                file_content = file_content.rstrip(b'\r\n')
                file_data = file_content
                break

            if not file_data or not filename:
                self._json_response(400, {'error': '未找到上传文件'})
                return

            ext = os.path.splitext(filename)[1].lower()
            if ext not in ALLOWED_EXT:
                self._json_response(400, {'error': f'不支持的文件格式: {ext}'})
                return

            original_size = len(file_data)
            base, _ = os.path.splitext(filename)
            safe_name = re.sub(r'[^a-zA-Z0-9_\-\u4e00-\u9fff]', '_', base)
            ts = int(time.time() * 1000)

            # ── 格式分流压缩 ──
            import io

            if ext == '.gif':
                # GIF → 动图 WebP：宽度限制 1200px + RGBA 保留透明
                print(f'[compress] 收到 GIF: {filename} ({original_size/1024:.1f} KB)，转为动图 WebP')
                img = Image.open(io.BytesIO(file_data))
                MAX_WIDTH = 1200
                w, h = img.size
                resize_ratio = None
                if w > MAX_WIDTH:
                    resize_ratio = MAX_WIDTH / w
                    new_size = (MAX_WIDTH, int(h * resize_ratio))
                frames = []
                durations = []
                for frame in ImageSequence.Iterator(img):
                    if resize_ratio:
                        frame = frame.resize(new_size, Image.LANCZOS)
                    if frame.mode != 'RGBA':
                        frames.append(frame.convert('RGBA'))
                    else:
                        frames.append(frame.copy())
                    durations.append(frame.info.get('duration', 100))
                out_buf = io.BytesIO()
                frames[0].save(
                    out_buf, format='WEBP', save_all=True,
                    append_images=frames[1:],
                    duration=durations,
                    loop=0, quality=82, method=6,
                )
                compressed_data = out_buf.getvalue()
                save_name = f'{safe_name}_{ts}.webp'

            elif ext in ('.jpg', '.jpeg'):
                # JPEG → WebP（统一格式，宽度限制 1200px，质量 82）
                print(f'[compress] 收到 JPEG: {filename} ({original_size/1024:.1f} KB)')
                img = Image.open(io.BytesIO(file_data))
                if img.mode in ('RGBA', 'LA', 'P'):
                    img = img.convert('RGB')
                MAX_WIDTH = 1200
                w, h = img.size
                if w > MAX_WIDTH:
                    ratio = MAX_WIDTH / w
                    new_size = (MAX_WIDTH, int(h * ratio))
                    img = img.resize(new_size, Image.LANCZOS)
                out_buf = io.BytesIO()
                img = add_watermark(img)
                img.save(out_buf, format='WEBP', quality=82, method=6)
                compressed_data = out_buf.getvalue()
                save_name = f'{safe_name}_{ts}.webp'

            elif ext == '.png':
                # PNG → WebP（统一格式，宽度限制 1200px，质量 82）
                print(f'[compress] 收到 PNG: {filename} ({original_size/1024:.1f} KB)')
                img = Image.open(io.BytesIO(file_data))
                MAX_WIDTH = 1200
                w, h = img.size
                if w > MAX_WIDTH:
                    ratio = MAX_WIDTH / w
                    new_size = (MAX_WIDTH, int(h * ratio))
                    img = img.resize(new_size, Image.LANCZOS)
                out_buf = io.BytesIO()
                # 颜色模式：RGBA/LA/P 保留透明通道，其他转 RGB
                if img.mode in ('RGBA', 'LA', 'P'):
                    pass
                else:
                    img = img.convert('RGB')
                img = add_watermark(img)
                img.save(out_buf, format='WEBP', quality=82, method=6)
                compressed_data = out_buf.getvalue()
                save_name = f'{safe_name}_{ts}.webp'

            elif ext == '.webp':
                # WebP 动图：提取所有帧，宽度限制 1200px，质量 82
                try:
                    img = Image.open(io.BytesIO(file_data))
                    is_animated = getattr(img, 'is_animated', False) and img.n_frames > 1
                    MAX_WIDTH = 1200
                    w, h = img.size

                    if is_animated:
                        print(f'[compress] 收到动画 WebP: {filename} ({original_size/1024:.1f} KB)')
                        resize_ratio = None
                        if w > MAX_WIDTH:
                            resize_ratio = MAX_WIDTH / w
                            new_size = (MAX_WIDTH, int(h * resize_ratio))
                        frames = []
                        durations = []
                        for frame in ImageSequence.Iterator(img):
                            if resize_ratio:
                                frame = frame.resize(new_size, Image.LANCZOS)
                            # WebP 动图保留 RGBA
                            if frame.mode not in ('RGBA', 'RGB'):
                                frame = frame.convert('RGBA')
                            frames.append(frame.copy())
                            durations.append(frame.info.get('duration', 100))
                        out_buf = io.BytesIO()
                        frames[0].save(
                            out_buf, format='WEBP', save_all=True,
                            append_images=frames[1:],
                            duration=durations,
                            loop=0, quality=82, method=6,
                        )
                        compressed_data = out_buf.getvalue()
                    else:
                        print(f'[compress] 收到静态 WebP: {filename} ({original_size/1024:.1f} KB)')
                        if w > MAX_WIDTH:
                            ratio = MAX_WIDTH / w
                            new_size = (MAX_WIDTH, int(h * ratio))
                            img = img.resize(new_size, Image.LANCZOS)
                        if img.mode in ('RGBA', 'LA'):
                            pass  # 保留 RGBA
                        elif img.mode == 'P':
                            img = img.convert('RGBA')
                        else:
                            img = img.convert('RGB')
                        out_buf = io.BytesIO()
                        img = add_watermark(img)       # 右下角半透明水印
                        img.save(out_buf, format='WEBP', quality=82, method=6)
                        compressed_data = out_buf.getvalue()

                    save_name = f'{safe_name}_{ts}.webp'
                except Exception as webp_err:
                    print(f'[compress] WebP 处理失败，回退原图: {webp_err}')
                    compressed_data = file_data
                    save_name = f'{safe_name}_{ts}.webp'

            elif ext == '.psd':
                # PSD：psd-tools 快速合成 → WebP
                print(f'[compress] 收到 PSD: {filename} ({original_size/1024:.1f} KB)')
                import time as _t
                _start = _t.time()
                psd = PSDImage.open(io.BytesIO(file_data))
                img = psd.composite()
                if img.mode == 'CMYK':
                    img = img.convert('RGB')
                elif img.mode not in ('RGB', 'RGBA', 'LA', 'P'):
                    img = img.convert('RGBA')
                print(f'[compress] PSD 合成耗时: {_t.time()-_start:.2f}s')
                MAX_WIDTH = 1200
                w, h = img.size
                if w > MAX_WIDTH:
                    ratio = MAX_WIDTH / w
                    new_size = (MAX_WIDTH, int(h * ratio))
                    img = img.resize(new_size, Image.LANCZOS)
                if img.mode in ('RGBA', 'LA'):
                    pass
                elif img.mode == 'P':
                    img = img.convert('RGBA')
                else:
                    img = img.convert('RGB')
                out_buf = io.BytesIO()
                img = add_watermark(img)       # 右下角半透明水印
                img.save(out_buf, format='WEBP', quality=82, method=6)
                compressed_data = out_buf.getvalue()
                save_name = f'{safe_name}_{ts}.webp'

            else:
                # 其他格式（SVG/BMP/ICO）：转为静态 WebP
                print(f'[compress] 收到 {ext}: {filename} ({original_size/1024:.1f} KB)，转为 WebP')
                img = Image.open(io.BytesIO(file_data))
                MAX_WIDTH = 1200
                w, h = img.size
                if w > MAX_WIDTH:
                    ratio = MAX_WIDTH / w
                    new_size = (MAX_WIDTH, int(h * ratio))
                    img = img.resize(new_size, Image.LANCZOS)
                if img.mode in ('RGBA', 'LA'):
                    pass
                elif img.mode == 'P':
                    img = img.convert('RGBA')
                else:
                    img = img.convert('RGB')
                out_buf = io.BytesIO()
                img = add_watermark(img)       # 右下角半透明水印
                img.save(out_buf, format='WEBP', quality=82, method=6)
                compressed_data = out_buf.getvalue()
                save_name = f'{safe_name}_{ts}.webp'

            compressed_size = len(compressed_data)

            # 如果压缩后反而变大，用原图
            if compressed_size >= original_size and ext not in ('.svg', '.bmp', '.ico'):
                compressed_data = file_data
                compressed_size = original_size
                print(f'[compress] 无需压缩（已是最优），直接使用原图')
            else:
                pct = round((1 - compressed_size / original_size) * 100, 1)
                if pct > 0:
                    print(f'[compress] 压缩完成: {original_size/1024:.1f}KB → {compressed_size/1024:.1f}KB (-{pct}%)')
                else:
                    print(f'[compress] 已保存: {compressed_size/1024:.1f}KB (无需压缩)')

            # 保存文件
            save_path = os.path.join(IMG_DIR, save_name)
            os.makedirs(IMG_DIR, exist_ok=True)
            with open(save_path, 'wb') as f:
                f.write(compressed_data)

            relative_path = f'img/{save_name}'
            self._json_response(200, {
                'ok': True,
                'path': relative_path,
                'originalSize': original_size,
                'compressedSize': compressed_size,
                'savedPct': round((1 - compressed_size / original_size) * 100, 1),
                'name': save_name,
            })

        except Exception as e:
            print(f'[compress] 错误: {e}')
            import traceback
            traceback.print_exc()
            self._json_response(500, {'error': str(e)})

    def handle_save_data(self):
        """接收 JSON 数据，写入 data.json，实现服务端持久化"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))

            data_path = os.path.join(DIRECTORY, 'data.json')

            # 先备份旧文件（保留最近 5 个备份）
            if os.path.exists(data_path):
                backup_dir = os.path.join(DIRECTORY, 'data_backups')
                os.makedirs(backup_dir, exist_ok=True)
                backup_name = f'data_{int(time.time())}.json'
                shutil.copy2(data_path, os.path.join(backup_dir, backup_name))
                # 清理旧备份，只保留最近 5 个
                backups = sorted(os.listdir(backup_dir))
                while len(backups) > 5:
                    os.remove(os.path.join(backup_dir, backups[0]))
                    backups.pop(0)

            # 写入新数据（原子写入：先写临时文件，再替换）
            tmp_path = data_path + '.tmp'
            with open(tmp_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            os.replace(tmp_path, data_path)

            print(f'[save-data] data.json 已更新（{len(body)/1024:.1f} KB）')
            self._json_response(200, {'ok': True})

        except json.JSONDecodeError as e:
            print(f'[save-data] JSON 解析失败: {e}')
            self._json_response(400, {'error': f'JSON 格式错误: {e}'})
        except Exception as e:
            print(f'[save-data] 错误: {e}')
            import traceback
            traceback.print_exc()
            self._json_response(500, {'error': str(e)})

    def handle_save_ledger(self):
        """接收账本全量数据，写入 ledger_data.json，实现服务端持久化"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))

            ledger_path = os.path.join(DIRECTORY, 'ledger_data.json')

            # 原子写入：先写临时文件，再替换
            tmp_path = ledger_path + '.tmp'
            with open(tmp_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            os.replace(tmp_path, ledger_path)

            print(f'[save-ledger] ledger_data.json 已更新')
            self._json_response(200, {'ok': True})

        except json.JSONDecodeError as e:
            print(f'[save-ledger] JSON 解析失败: {e}')
            self._json_response(400, {'error': f'JSON 格式错误: {e}'})
        except Exception as e:
            print(f'[save-ledger] 错误: {e}')
            import traceback
            traceback.print_exc()
            self._json_response(500, {'error': str(e)})

    def handle_batch_category(self):
        """批量修改作品分类
        POST JSON: { "ids": [1,2,3,...], "category": "cat_xxx" 或 "__clear__" }
        """
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            payload = json.loads(body.decode('utf-8'))

            ids = payload.get('ids', [])
            cat = payload.get('category', '')

            if not ids or not isinstance(ids, list):
                self._json_response(400, {'error': '缺少 ids 数组'})
                return

            # 读取 data.json
            data_path = os.path.join(DIRECTORY, 'data.json')
            if not os.path.exists(data_path):
                self._json_response(404, {'error': 'data.json 不存在'})
                return

            with open(data_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # 转换为 Set 加速查找
            id_set = set(ids)
            count = 0
            target = '' if cat == '__clear__' else cat

            for w in data.get('works', []):
                if w.get('id') in id_set:
                    w['category'] = target
                    count += 1

            # 备份 + 原子写入
            backup_dir = os.path.join(DIRECTORY, 'backups')
            os.makedirs(backup_dir, exist_ok=True)
            ts = int(time.time())
            backup_name = f'data_backup_batch_category_{ts}.json'
            shutil.copy2(data_path, os.path.join(backup_dir, backup_name))

            tmp_path = data_path + '.tmp'
            with open(tmp_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            os.replace(tmp_path, data_path)

            print(f'[batch-category] {count}/{len(ids)} 件 → {target or "未分类"}')
            self._json_response(200, {'ok': True, 'count': count})

        except Exception as e:
            print(f'[batch-category] 错误: {e}')
            import traceback
            traceback.print_exc()
            self._json_response(500, {'error': str(e)})

    def handle_publish(self):
        """运行 build.py + upload_github_api.py，一键发布到 GitHub
        模式：?mode=code（默认，只传代码）或 ?mode=all（代码+有变化的图片）
        """
        from urllib.parse import urlparse, parse_qs
        import subprocess

        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        mode = params.get('mode', ['code'])[0]  # 'code' | 'all'

        try:
            scripts_dir = DIRECTORY  # 始终指向 portfolio 目录
            python = sys.executable

            # 1. build.py
            print(f'[publish] 开始构建...')
            r1 = subprocess.run(
                [python, 'build.py'],
                cwd=scripts_dir,
                capture_output=True, text=True, timeout=60,
                encoding='utf-8', errors='replace'
            )
            if r1.returncode != 0:
                self._json_response(500, {
                    'ok': False, 'step': 'build',
                    'output': (r1.stdout + '\n' + r1.stderr).strip()
                })
                return

            # 2. upload_github_api.py
            cmd = [python, 'upload_github_api.py']
            if mode == 'all':
                cmd.append('--force')
            print(f'[publish] 开始上传 (mode={mode})...')
            r2 = subprocess.run(
                cmd,
                cwd=scripts_dir,
                capture_output=True, text=True, timeout=120,
                encoding='utf-8', errors='replace'
            )

            output = r2.stdout.strip()
            if r2.stderr:
                output += '\n' + r2.stderr.strip()

            ok = r2.returncode == 0
            print(f'[publish] {"成功" if ok else "失败"}')
            self._json_response(200, {
                'ok': ok,
                'output': output,
                'mode': mode
            })

        except subprocess.TimeoutExpired:
            self._json_response(500, {'ok': False, 'error': '发布超时'})
        except Exception as e:
            import traceback
            traceback.print_exc()
            self._json_response(500, {'ok': False, 'error': str(e)})

    def handle_rename_image(self):
        """重命名 img/ 中的图片文件，并更新返回新 src 路径
        POST JSON: { "old_src": "img/0001.webp", "new_name": "新名称" }
        """
        try:
            import re
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            payload = json.loads(body.decode('utf-8'))

            old_src   = payload.get('old_src', '').strip()
            new_name  = payload.get('new_name', '').strip()
            if not old_src or not new_name:
                self._json_response(400, {'error': '缺少 old_src 或 new_name'})
                return

            # ── 安全检查：只能操作 img/ 目录 ──────────────────
            if not old_src.startswith('img/'):
                self._json_response(403, {'error': '只能重命名 img/ 目录下的文件'})
                return
            old_abs = os.path.normpath(os.path.join(DIRECTORY, old_src))
            img_dir = os.path.normpath(IMG_DIR)
            if not old_abs.startswith(img_dir):
                self._json_response(403, {'error': '非法路径'})
                return
            if not os.path.isfile(old_abs):
                self._json_response(404, {'error': '文件不存在: ' + old_src})
                return

            # ── 安全化新文件名 ─────────────────────────────────
            # 去掉路径危险字符，保留中文/英文/数字/下划线/短横线/点
            safe = re.sub(r'[\\/:*?"<>|]', '_', new_name)
            safe = safe.strip()
            if not safe:
                safe = 'untitled'
            ext = '.webp'   # 统一用 .webp

            # ── 冲突处理：safe.webp 已存在则 safe_1.webp … ─────
            def _unique_path(dir_, base, ext_):
                candidate = os.path.join(dir_, f'{base}{ext_}')
                if not os.path.exists(candidate):
                    return candidate, base
                for i in range(1, 1000):
                    candidate = os.path.join(dir_, f'{base}_{i}{ext_}')
                    if not os.path.exists(candidate):
                        return candidate, f'{base}_{i}'
                raise RuntimeError('无法生成不重名的文件名')

            new_abs, base_used = _unique_path(IMG_DIR, safe, ext)
            new_filename = os.path.basename(new_abs)
            new_src = f'img/{new_filename}'

            # ── 缩略图路径（thumb_ + 原文件名 / 新文件名）─────────
            old_basename = os.path.basename(old_abs)
            new_basename = new_filename
            old_thumb_src = f'img/thumb_{old_basename}'
            new_thumb_src = f'img/thumb_{new_basename}'
            old_thumb_abs = os.path.join(IMG_DIR, f'thumb_{old_basename}')
            new_thumb_abs = os.path.join(IMG_DIR, f'thumb_{new_basename}')

            # ── 执行重命名 ─────────────────────────────────────
            os.rename(old_abs, new_abs)
            renamed_thumb = False
            if os.path.isfile(old_thumb_abs):
                # 如果目标缩略图已存在，先处理冲突
                if os.path.exists(new_thumb_abs):
                    print(f'[rename] 缩略图冲突，跳过: {new_thumb_src}')
                else:
                    os.rename(old_thumb_abs, new_thumb_abs)
                    renamed_thumb = True
                    print(f'[rename] 缩略图同步重命名: {old_thumb_src} → {new_thumb_src}')

            print(f'[rename] {old_src} → {new_src}')

            resp = {
                'ok': True,
                'old_src': old_src,
                'new_src': new_src,
                'new_name': new_filename,
            }
            if renamed_thumb:
                resp['new_thumbnail'] = new_thumb_src
            self._json_response(200, resp)

        except Exception as e:
            print(f'[rename] 错误: {e}')
            import traceback
            traceback.print_exc()
            self._json_response(500, {'error': str(e)})

    def handle_renumber_all(self):
        """按 works 顺序批量重命名图片为 0001.webp, 0002.webp, ...
        一次性完成所有重命名（用临时名过渡避免冲突），并更新 data.json。
        POST JSON: { "works": [...] }  # 与 DATA.works 结构一致
        返回: { "ok": true, "works": [...], "renamed": [{"old_src":"...","new_src":"..."}] }
        """
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            payload = json.loads(body.decode('utf-8'))

            works = payload.get('works', [])
            if not isinstance(works, list) or len(works) == 0:
                self._json_response(400, {'error': 'works 必须是非空数组'})
                return

            # ── 生成重命名计划 ─────────────────────────────
            plan = []   # [{old_src, target_src, temp_path}]
            used_temp_names = set()

            for i, w in enumerate(works):
                old_src = (w.get('src') or '').strip()
                if not old_src or not old_src.startswith('img/'):
                    continue

                old_abs = os.path.normpath(os.path.join(DIRECTORY, old_src))
                if not old_abs.startswith(os.path.normpath(IMG_DIR)):
                    continue
                if not os.path.isfile(old_abs):
                    print(f'[renumber] 跳过不存在的文件: {old_src}')
                    continue

                # 目标文件名：4 位数字编号 + .webp
                target_name = f'{i+1:04d}.webp'
                target_abs = os.path.join(IMG_DIR, target_name)
                target_src = f'img/{target_name}'

                plan.append({
                    'old_src': old_src,
                    'old_abs': old_abs,
                    'target_src': target_src,
                    'target_abs': target_abs,
                    'temp_abs': None,   # 稍后分配
                    'index': i,
                })

            # ── 分配临时文件名（避免冲突）────────────────────
            for item in plan:
                old_abs = item['old_abs']
                target_abs = item['target_abs']

                # 情况 1：源文件已经是目标文件，跳过
                if os.path.normpath(old_abs) == os.path.normpath(target_abs):
                    item['target_src'] = item['old_src']  # 不变
                    continue

                # 情况 2：目标文件已存在且不是自己 → 先移到临时文件
                if os.path.exists(target_abs):
                    while True:
                        temp_name = f'temp_{int(time.time()*1000)}_{item["index"]}.webp'
                        temp_abs = os.path.join(IMG_DIR, temp_name)
                        if not os.path.exists(temp_abs) and temp_abs not in used_temp_names:
                            break
                        time.sleep(0.001)
                    used_temp_names.add(temp_abs)
                    try:
                        os.rename(target_abs, temp_abs)
                        item['temp_abs'] = temp_abs
                        print(f'[renumber] 冲突，移走: {os.path.basename(target_abs)} → {temp_name}')
                    except Exception as e:
                        print(f'[renumber] 移走冲突文件失败: {e}')

            # ── 执行重命名 ─────────────────────────────────
            renamed = []
            for item in plan:
                old_abs = item['old_abs']
                target_abs = item['target_abs']
                target_src = item['target_src']

                # 已经是正确的文件名
                if os.path.normpath(old_abs) == os.path.normpath(target_abs):
                    continue

                # 源文件可能已被前一步移走（不可能，因为 old_abs 是规范化后的路径）
                if not os.path.isfile(old_abs):
                    # 也许源文件已经被重命名了（不应该发生）
                    print(f'[renumber] 源文件不存在（可能已被处理）: {item["old_src"]}')
                    continue

                try:
                    os.rename(old_abs, target_abs)
                    renamed.append({
                        'old_src': item['old_src'],
                        'new_src': target_src,
                        'index': item['index'],
                    })
                    # 更新 plan 中后续引用此 old_src 的项（不应该有，因为每个 src 唯一）
                    print(f'[renumber] {item["old_src"]} → {target_src}')
                except Exception as e:
                    print(f'[renumber] 重命名失败 {item["old_src"]}: {e}')

            # ── 更新 works 中的 src ─────────────────────────
            updated_works = payload.get('works', [])
            for r in renamed:
                idx = r['index']
                if 0 <= idx < len(updated_works):
                    updated_works[idx]['src'] = r['new_src']

            # ── 写回 data.json ─────────────────────────────
            data_path = os.path.join(DIRECTORY, 'data.json')
            try:
                # 先读取现有 data.json，只更新 works 字段
                if os.path.exists(data_path):
                    with open(data_path, 'r', encoding='utf-8') as f:
                        existing_data = json.load(f)
                else:
                    existing_data = {}

                existing_data['works'] = updated_works

                # 原子写入（复用 handle_save_data 的逻辑）
                backup_dir = os.path.join(DIRECTORY, 'data_backups')
                os.makedirs(backup_dir, exist_ok=True)
                backup_name = f'data_{int(time.time())}.json'
                shutil.copy2(data_path, os.path.join(backup_dir, backup_name))
                backups = sorted(os.listdir(backup_dir))
                while len(backups) > 5:
                    os.remove(os.path.join(backup_dir, backups))
                    backups.pop(0)

                tmp_path = data_path + '.tmp'
                with open(tmp_path, 'w', encoding='utf-8') as f:
                    json.dump(existing_data, f, ensure_ascii=False, indent=2)
                os.replace(tmp_path, data_path)
                print(f'[renumber] data.json 已更新，{len(renamed)} 个文件已重命名')
            except Exception as e:
                print(f'[renumber] 写回 data.json 失败: {e}')
                # 文件已重命名，但 data.json 更新失败，返回警告
                self._json_response(200, {
                    'ok': True,
                    'works': updated_works,
                    'renamed': renamed,
                    'warning': f'文件已重命名，但 data.json 写入失败: {e}',
                })
                return

            self._json_response(200, {
                'ok': True,
                'works': updated_works,
                'renamed': renamed,
                'count': len(renamed),
            })

        except Exception as e:
            print(f'[renumber] 错误: {e}')
            import traceback
            traceback.print_exc()
            self._json_response(500, {'error': str(e)})

    def _json_response(self, code, data):
        """发送 JSON 响应"""
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(body))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        """处理 CORS 预检请求"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def log_message(self, format, *args):
        """简化日志：上传/压缩/发布请求打印路径，其他保持默认"""
        if self.path.startswith(('/upload', '/compress-gif', '/save-data', '/publish')):
            print(f'[{self.path.lstrip("/")}] {self.address_string()} - {args[0]}')
        else:
            super().log_message(format, *args)


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("0.0.0.0", PORT), Handler) as httpd:
        ip = get_local_ip()
        print(f"服务运行在:")
        print(f"  本机:   http://localhost:{PORT}")
        print(f"  局域网: http://{ip}:{PORT}")
        print(f"  上传接口: POST http://localhost:{PORT}/upload")
        print(f"  图片压缩: POST http://localhost:{PORT}/compress-image")
        print(f"  GIF压缩(旧): POST http://localhost:{PORT}/compress-gif")
        print(f"  数据保存: POST http://localhost:{PORT}/save-data")
        print(f"  图片重命名: POST http://localhost:{PORT}/rename-image")
        print(f"  批量编号: POST http://localhost:{PORT}/renumber-all")
        print(f"  一键发布: POST http://localhost:{PORT}/publish")
        httpd.serve_forever()
