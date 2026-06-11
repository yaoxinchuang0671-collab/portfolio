#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
img/upload_server.py — 潮汐视界本地上传工具服务器

用法：
    cd img && python upload_server.py
    自动打开浏览器访问 http://localhost:8765

功能：
    1. 提供拖拽上传界面 (upload_tool.html)
    2. 接收文件上传，自动转 WebP + 缩略图
    3. 按分类保存到 img/分类文件夹/
    4. 自动编号，追加写入 data.json
"""

import os
import sys
import json
import re
import shutil
import time
import subprocess
import webbrowser
import urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from PIL import Image
import imageio_ffmpeg

# ── 路径 ──
IMG_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(IMG_DIR)
DATA_JSON = os.path.join(ROOT, "data.json")

# ── 参数 ──
PORT = 8081
HOST = "127.0.0.1"
THUMB_SIZE = (400, 400)
WEBP_QUALITY = 85
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

IMG_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif'}
GIF_EXT = '.gif'
PSD_EXT = '.psd'
VIDEO_EXTS = {'.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.flv'}
ALL_EXTS = IMG_EXTS | {GIF_EXT, PSD_EXT} | VIDEO_EXTS

# 分类标签 → 文件夹名 映射（处理特殊字符）
def folder_name(label):
    return label.replace('/', '_').replace('\\', '_').strip()


def load_data():
    with open(DATA_JSON, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_data(data):
    with open(DATA_JSON, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_max_number(works):
    max_num = 0
    for w in works:
        cap = w.get('caption', '')
        m = re.match(r'^(\d{1,4})', cap)
        if m:
            n = int(m.group(1))
            if n > max_num:
                max_num = n
    return max_num


def pad_number(num, length=4):
    s = str(num)
    while len(s) < length:
        s = '0' + s
    return s


def get_safe_name(filename):
    name = os.path.splitext(filename)[0]
    name = re.sub(r'[^\w\u4e00-\u9fff]+', '_', name).strip('_')
    return name or 'work'


def ensure_unique_path(directory, filename):
    base, ext = os.path.splitext(filename)
    path = os.path.join(directory, filename)
    counter = 1
    while os.path.exists(path):
        path = os.path.join(directory, f"{base}_{counter}{ext}")
        counter += 1
    return path


# ── 缩略图 ──
def make_thumbnail(src_path, out_path, is_video=False):
    try:
        if is_video:
            temp_frame = out_path + ".tmp.jpg"
            cmd = [
                FFMPEG, '-y', '-i', src_path,
                '-ss', '00:00:00.100',
                '-vframes', '1',
                '-q:v', '2',
                temp_frame
            ]
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0 or not os.path.exists(temp_frame):
                return False
            with Image.open(temp_frame) as img:
                img.thumbnail(THUMB_SIZE, Image.LANCZOS)
                img = img.convert('RGB')
                img.save(out_path, 'WEBP', quality=80, method=6)
            os.remove(temp_frame)
            return True
        else:
            with Image.open(src_path) as img:
                img.thumbnail(THUMB_SIZE, Image.LANCZOS)
                if img.mode in ('RGBA', 'P', 'LA'):
                    img = img.convert('RGBA')
                elif img.mode != 'RGB':
                    img = img.convert('RGB')
                img.save(out_path, 'WEBP', quality=80, method=6)
            return True
    except Exception as e:
        print(f"[缩略图失败] {e}")
        return False


# ── 格式处理 ──
def process_image(src_path, out_path):
    with Image.open(src_path) as img:
        if img.mode in ('RGBA', 'P', 'LA'):
            img = img.convert('RGBA')
        else:
            img = img.convert('RGB')
        img.save(out_path, 'WEBP', quality=WEBP_QUALITY, method=6)
    return True


def process_gif(src_path, out_path):
    with Image.open(src_path) as img:
        frames = []
        durations = []
        try:
            while True:
                frame = img.copy()
                if frame.mode in ('P', 'LA'):
                    frame = frame.convert('RGBA')
                elif frame.mode != 'RGBA':
                    frame = frame.convert('RGB')
                frames.append(frame)
                durations.append(img.info.get('duration', 100))
                img.seek(img.tell() + 1)
        except EOFError:
            pass
        if len(frames) == 0:
            return False
        if len(frames) == 1:
            frames[0].save(out_path, 'WEBP', quality=WEBP_QUALITY, method=6)
        else:
            frames[0].save(
                out_path, 'WEBP',
                save_all=True,
                append_images=frames[1:],
                duration=durations,
                loop=img.info.get('loop', 0),
                quality=WEBP_QUALITY,
                method=6
            )
        return True


def process_psd(src_path, out_path):
    from psd_tools import PSDImage
    psd = PSDImage.open(src_path)
    img = psd.composite()
    if img.mode in ('RGBA', 'P', 'LA'):
        img = img.convert('RGBA')
    else:
        img = img.convert('RGB')
    img.save(out_path, 'WEBP', quality=WEBP_QUALITY, method=6)
    return True


def process_video(src_path, out_path):
    cmd = [
        FFMPEG, '-y', '-i', src_path,
        '-vf', 'fps=15,scale=720:-1:flags=lanczos',
        '-loop', '0',
        '-quality', '85',
        out_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        err = result.stderr[:300] if result.stderr else "未知错误"
        print(f"[ffmpeg 错误] {err}")
        return False
    return True


def cut_triptych(img_path, out_dir, basename):
    """将图片垂直切割成3等份，返回 {left, mid, right} 路径字典"""
    from PIL import Image
    img = Image.open(img_path)
    w, h = img.size

    slice_w = w // 3
    slices = {
        'left':  (0, 0, slice_w, h),
        'mid':   (slice_w, 0, slice_w * 2, h),
        'right': (slice_w * 2, 0, w, h),
    }

    paths = {}
    for name, box in slices.items():
        cropped = img.crop(box)
        out_path = os.path.join(out_dir, f"{basename}_{name}.webp")
        cropped.save(out_path, 'WEBP', quality=WEBP_QUALITY, method=6)
        paths[name] = out_path

    return paths


# ── 处理单个文件 ──
_next_num = None

def process_upload(file_bytes, filename, cat_id, cat_label):
    """处理上传文件，返回结果 dict"""
    global _next_num

    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALL_EXTS:
        return {'ok': False, 'error': f'不支持的格式: {ext}'}

    # 确定分类文件夹
    cat_folder = folder_name(cat_label) if cat_label else '未分类'
    cat_dir = os.path.join(IMG_DIR, cat_folder)
    os.makedirs(cat_dir, exist_ok=True)

    # 加载 data.json 获取当前编号
    data = load_data()
    works = data.get('works', [])
    if _next_num is None:
        _next_num = get_max_number(works)
    _next_num += 1

    safe_name = get_safe_name(filename)
    timestamp = int(time.time() * 1000) + _next_num

    # 判断是否为三联图分类
    is_triptych = (cat_label == '抖音三联图')

    if is_triptych:
        # 三联图：保存完整原图，再切割
        out_filename = f"{pad_number(_next_num)}_{safe_name}_{timestamp}_full.webp"
    else:
        out_filename = f"{pad_number(_next_num)}_{safe_name}_{timestamp}.webp"

    out_path = ensure_unique_path(cat_dir, out_filename)
    thumb_filename = f"thumb_{os.path.basename(out_path)}"
    thumb_path = os.path.join(cat_dir, thumb_filename)

    # 先保存临时文件
    temp_path = out_path + ".tmp" + ext
    with open(temp_path, 'wb') as f:
        f.write(file_bytes)

    # 处理转换
    is_video = False
    success = False
    try:
        if ext in IMG_EXTS:
            success = process_image(temp_path, out_path)
        elif ext == GIF_EXT:
            success = process_gif(temp_path, out_path)
        elif ext == PSD_EXT:
            success = process_psd(temp_path, out_path)
        elif ext in VIDEO_EXTS:
            is_video = True
            success = process_video(temp_path, out_path)
    except Exception as e:
        print(f"[处理错误] {e}")
        success = False
    finally:
        os.remove(temp_path)

    if not success or not os.path.exists(out_path):
        if os.path.exists(out_path):
            os.remove(out_path)
        return {'ok': False, 'error': '文件处理失败'}

    # ── 三联图：切割为3份 ──
    slice_paths = {}
    if is_triptych:
        base_name = os.path.splitext(os.path.basename(out_path))[0]
        # 去掉 _full 后缀得到基础名
        base_name = base_name.replace('_full', '')
        try:
            slice_paths = cut_triptych(out_path, cat_dir, base_name)
        except Exception as e:
            print(f"[三联图切割错误] {e}")
            # 切割失败也继续，只是没有 slices

    # 生成缩略图
    thumb_ok = make_thumbnail(out_path if not is_video else temp_path, thumb_path, is_video)

    # 文件大小
    out_size = os.path.getsize(out_path)

    # 构建作品数据
    rel_src = f"img/{cat_folder}/{os.path.basename(out_path)}"
    rel_thumb = f"img/{cat_folder}/{thumb_filename}" if thumb_ok else ''

    work = {
        'id': timestamp,
        'src': rel_src,
        'thumbnail': rel_thumb,
        'caption': f"{pad_number(_next_num)} {safe_name}",
        'category': cat_id,
        'type': 'triptych' if is_triptych else 'image'
    }

    # 三联图添加 slices 字段
    if is_triptych and slice_paths:
        work['slices'] = {
            'left':  f"img/{cat_folder}/{os.path.basename(slice_paths['left'])}",
            'mid':   f"img/{cat_folder}/{os.path.basename(slice_paths['mid'])}",
            'right': f"img/{cat_folder}/{os.path.basename(slice_paths['right'])}"
        }

    # 追加到 data.json
    works.append(work)
    data['works'] = works
    save_data(data)

    return {
        'ok': True,
        'filename': out_filename,
        'src': rel_src,
        'thumbnail': rel_thumb,
        'size': out_size,
        'caption': work['caption'],
        'category': cat_label,
        'type': work['type'],
        'slices': work.get('slices', {})
    }


# ── multipart 解析 ──
def parse_multipart(body, boundary):
    """简单 multipart parser，返回 {field: value} dict"""
    parts = []
    boundary_bytes = b'--' + boundary
    # 分割
    chunks = body.split(boundary_bytes)
    for chunk in chunks[1:-1]:  # 跳过首尾
        chunk = chunk.lstrip(b'\r\n')
        if not chunk:
            continue
        # 分离 header 和 body
        header_end = chunk.find(b'\r\n\r\n')
        if header_end == -1:
            continue
        header = chunk[:header_end].decode('utf-8', errors='replace')
        body_part = chunk[header_end + 4:]
        # 去掉末尾的 \r\n
        if body_part.endswith(b'\r\n'):
            body_part = body_part[:-2]

        # 解析 Content-Disposition
        name = None
        filename = None
        for line in header.split('\r\n'):
            if line.lower().startswith('content-disposition:'):
                # 提取 name
                m = re.search(r'name="([^"]+)"', line)
                if m:
                    name = m.group(1)
                # 提取 filename
                m = re.search(r'filename="([^"]*)"', line)
                if m:
                    filename = m.group(1)

        if name:
            parts.append({'name': name, 'filename': filename, 'data': body_part})
    return parts


# ── HTTP Handler ──
class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.0"  # 避免 426 Upgrade Required 错误

    def log_message(self, fmt, *args):
        print(f"[{time.strftime('%H:%M:%S')}] {args[0]}")

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def _send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def do_GET(self):
        path = urllib.parse.unquote(self.path)

        if path == '/':
            html_path = os.path.join(IMG_DIR, 'upload_tool.html')
            if os.path.exists(html_path):
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                with open(html_path, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self._send_json({'error': 'upload_tool.html not found'}, 404)
            return

        if path == '/categories':
            try:
                data = load_data()
                cats = data.get('categories', [])
                result = []
                for c in cats:
                    result.append({
                        'id': c['id'],
                        'label': c['label'],
                        'folder': folder_name(c['label'])
                    })
                self._send_json({'ok': True, 'categories': result})
            except Exception as e:
                self._send_json({'ok': False, 'error': str(e)}, 500)
            return

        self.send_response(404)
        self.end_headers()
        self.wfile.write(b"Not Found")

    def do_POST(self):
        path = urllib.parse.unquote(self.path)

        if path == '/upload':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length)

                content_type = self.headers.get('Content-Type', '')
                boundary = None
                if 'boundary=' in content_type:
                    boundary = content_type.split('boundary=')[1].encode('utf-8')

                if not boundary:
                    self._send_json({'ok': False, 'error': 'Missing boundary'}, 400)
                    return

                parts = parse_multipart(body, boundary)

                files = []
                cat_id = ''
                cat_label = ''

                for part in parts:
                    if part['name'] == 'files' and part['filename']:
                        files.append(part)
                    elif part['name'] == 'category':
                        cat_id = part['data'].decode('utf-8', errors='replace')
                    elif part['name'] == 'categoryLabel':
                        cat_label = part['data'].decode('utf-8', errors='replace')

                if not files:
                    self._send_json({'ok': False, 'error': '没有文件'}, 400)
                    return

                # 如果没有提供分类标签，从 data.json 查找
                if not cat_label and cat_id:
                    data = load_data()
                    for c in data.get('categories', []):
                        if c['id'] == cat_id:
                            cat_label = c['label']
                            break

                results = []
                for f in files:
                    result = process_upload(f['data'], f['filename'], cat_id, cat_label)
                    results.append(result)

                success_count = sum(1 for r in results if r['ok'])
                self._send_json({
                    'ok': True,
                    'results': results,
                    'success': success_count,
                    'total': len(results)
                })

            except Exception as e:
                import traceback
                print(f"[上传错误] {e}")
                traceback.print_exc()
                self._send_json({'ok': False, 'error': str(e)}, 500)
            return

        self.send_response(404)
        self.end_headers()
        self.wfile.write(b"Not Found")


if __name__ == '__main__':
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    url = f"http://{HOST}:{PORT}"
    print(f"\n{'='*56}")
    print(f"  潮汐视界 — 本地上传工具")
    print(f"{'='*56}")
    print(f"  服务器: {url}")
    print(f"  数据文件: {DATA_JSON}")
    print(f"  图片目录: {IMG_DIR}")
    print(f"\n  正在打开浏览器...")
    print(f"  按 Ctrl+C 停止服务器")
    print(f"{'='*56}\n")

    webbrowser.open(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已停止")
        server.shutdown()
