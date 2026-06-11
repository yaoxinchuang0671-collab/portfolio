#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
auto_upload.py — 潮汐视界自动化作品入库脚本

用法：
    python auto_upload.py                    # 处理 img/inbox/ 下所有文件
    python auto_upload.py --dry-run          # 仅预览，不写入
    python auto_upload.py --default-cat="小程序"  # 指定默认分类

流程：
    1. 扫描 img/inbox/（含子文件夹）
    2. 子文件夹名 → 自动匹配分类
    3. 处理文件 → WebP + 缩略图（不限制视频/GIF时长）
    4. 自动编号 → 写入 data.json
    5. 源文件移动到 img/inbox/.processed/

支持格式：
    图片：jpg, jpeg, png, webp, bmp, tiff, psd
    视频：mp4, mov, avi, mkv, webm, m4v, flv
    动图：gif（完整保留帧数和时长）
"""

import os
import sys
import json
import re
import shutil
import time
import subprocess
from pathlib import Path
from PIL import Image
import imageio_ffmpeg

# ── 路径配置 ──
ROOT = os.path.dirname(os.path.abspath(__file__))
INBOX = os.path.join(ROOT, "img", "inbox")
PROCESSED = os.path.join(INBOX, ".processed")
DATA_JSON = os.path.join(ROOT, "data.json")
IMG_DIR = os.path.join(ROOT, "img")

# ── 处理参数 ──
THUMB_SIZE = (400, 400)
WEBP_QUALITY = 85
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

# 支持的扩展名
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
    """从标题中提取最大编号（如 001 xxx → 1）"""
    max_num = 0
    for w in works:
        cap = w.get('caption', '')
        m = re.match(r'^(\d{1,4})', cap)
        if m:
            n = int(m.group(1))
            if n > max_num:
                max_num = n
    return max_num


def get_category_map(categories):
    """分类标签 → ID 映射"""
    return {c['label']: c['id'] for c in categories}


def match_category(folder_name, cat_map):
    """用文件夹名匹配分类，支持模糊匹配"""
    if not folder_name:
        return None
    if folder_name in cat_map:
        return cat_map[folder_name]
    for label, cid in cat_map.items():
        if folder_name in label or label in folder_name:
            return cid
    return None


def ensure_unique_path(directory, filename):
    """确保文件名不重复"""
    base, ext = os.path.splitext(filename)
    path = os.path.join(directory, filename)
    counter = 1
    while os.path.exists(path):
        path = os.path.join(directory, f"{base}_{counter}{ext}")
        counter += 1
    return path


def pad_number(num, length):
    s = str(num)
    while len(s) < length:
        s = '0' + s
    return s


def get_safe_name(filename):
    """从文件名提取安全名称（保留中英文数字）"""
    name = os.path.splitext(filename)[0]
    name = re.sub(r'[^\w\u4e00-\u9fff]+', '_', name).strip('_')
    return name or 'work'


# ── 缩略图生成 ──

def make_thumbnail(src_path, out_path, is_video=False):
    """生成 400x400 WebP 缩略图"""
    try:
        if is_video:
            # 视频：先用 ffmpeg 提取第一帧，再生成缩略图
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
            # 图片/GIF/PSD/WebP：用 PIL 打开
            with Image.open(src_path) as img:
                img.thumbnail(THUMB_SIZE, Image.LANCZOS)
                # 动态图只取第一帧
                if img.mode in ('RGBA', 'P', 'LA'):
                    img = img.convert('RGBA')
                elif img.mode != 'RGB':
                    img = img.convert('RGB')
                img.save(out_path, 'WEBP', quality=80, method=6)
            return True
    except Exception as e:
        print(f"    [缩略图失败] {e}")
        return False


# ── 格式处理 ──

def process_image(src_path, out_path):
    """静态图片 → WebP"""
    with Image.open(src_path) as img:
        if img.mode in ('RGBA', 'P', 'LA'):
            img = img.convert('RGBA')
        else:
            img = img.convert('RGB')
        img.save(out_path, 'WEBP', quality=WEBP_QUALITY, method=6)
    return True


def process_gif(src_path, out_path):
    """GIF → 动态 WebP（保留所有帧，不限制时长）"""
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
            # 动态 WebP：保留完整帧数和时长
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
    """PSD → 合并图层 → WebP"""
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
    """视频 → 动态 WebP（完整时长，不限制）"""
    # ffmpeg 转 WebP 动画
    # -vf: 15fps, lanczos缩放, 宽度720px保持比例
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
        print(f"    [ffmpeg 错误] {err}")
        return False
    return True


# ── 核心处理 ──

def process_file(src_path, cat_id, cat_label, next_num):
    """处理单个文件，返回作品数据 dict 或 None"""
    filename = os.path.basename(src_path)
    ext = os.path.splitext(filename)[1].lower()
    safe_name = get_safe_name(filename)

    # 确定分类文件夹
    cat_folder = folder_name(cat_label) if cat_label else '未分类'
    cat_dir = os.path.join(IMG_DIR, cat_folder)
    os.makedirs(cat_dir, exist_ok=True)

    # 输出文件名：XXXX_安全名_时间戳.webp
    timestamp = int(time.time() * 1000) + next_num
    out_filename = f"{pad_number(next_num, 4)}_{safe_name}_{timestamp}.webp"
    out_path = ensure_unique_path(cat_dir, out_filename)
    thumb_filename = f"thumb_{os.path.basename(out_path)}"
    thumb_path = os.path.join(cat_dir, thumb_filename)

    print(f"\n  [{next_num}] {filename}")
    print(f"      输出: {out_filename}")
    print(f"      分类文件夹: img/{cat_folder}/")

    # 根据格式处理
    is_video = False
    success = False
    try:
        if ext in IMG_EXTS:
            success = process_image(src_path, out_path)
        elif ext == GIF_EXT:
            success = process_gif(src_path, out_path)
        elif ext == PSD_EXT:
            success = process_psd(src_path, out_path)
        elif ext in VIDEO_EXTS:
            is_video = True
            success = process_video(src_path, out_path)
        else:
            print(f"      [跳过] 不支持的格式: {ext}")
            return None
    except Exception as e:
        print(f"      [错误] {e}")
        return None

    if not success or not os.path.exists(out_path):
        # 清理失败残留
        if os.path.exists(out_path):
            os.remove(out_path)
        return None

    # 生成缩略图
    thumb_ok = make_thumbnail(out_path if not is_video else src_path, thumb_path, is_video)

    # 获取文件大小
    out_size = os.path.getsize(out_path)
    size_str = f"{out_size / 1024 / 1024:.1f} MB" if out_size > 1024 * 1024 else f"{out_size / 1024:.0f} KB"
    print(f"      大小: {size_str} | 缩略图: {'OK' if thumb_ok else '失败'}")

    # 构建作品数据
    rel_src = f"img/{cat_folder}/{os.path.basename(out_path)}"
    rel_thumb = f"img/{cat_folder}/{thumb_filename}" if thumb_ok else ''

    work = {
        'id': timestamp,
        'src': rel_src,
        'thumbnail': rel_thumb,
        'caption': f"{pad_number(next_num, 4)} {safe_name}",
        'category': cat_id,
        'type': 'image'
    }
    return work


def scan_inbox():
    """扫描 inbox 目录，返回 [(文件路径, 分类标签), ...]"""
    if not os.path.exists(INBOX):
        return []

    items = []
    # 根目录文件（默认分类）
    for f in sorted(os.listdir(INBOX)):
        path = os.path.join(INBOX, f)
        if os.path.isfile(path):
            ext = os.path.splitext(f)[1].lower()
            if ext in ALL_EXTS:
                items.append((path, None))

    # 子文件夹文件（文件夹名作为分类标签）
    for entry in sorted(os.listdir(INBOX)):
        subdir = os.path.join(INBOX, entry)
        if os.path.isdir(subdir) and not entry.startswith('.'):
            for f in sorted(os.listdir(subdir)):
                path = os.path.join(subdir, f)
                if os.path.isfile(path):
                    ext = os.path.splitext(f)[1].lower()
                    if ext in ALL_EXTS:
                        items.append((path, entry))

    return items


def move_to_processed(src_path):
    """将源文件移动到 .processed 归档目录"""
    os.makedirs(PROCESSED, exist_ok=True)
    basename = os.path.basename(src_path)
    dest = os.path.join(PROCESSED, basename)
    # 防止重名
    counter = 1
    while os.path.exists(dest):
        name, ext = os.path.splitext(basename)
        dest = os.path.join(PROCESSED, f"{name}_{counter}{ext}")
        counter += 1
    shutil.move(src_path, dest)
    return dest


# ── 主程序 ──

def main():
    import argparse
    parser = argparse.ArgumentParser(description='潮汐视界 — 自动作品入库')
    parser.add_argument('--dry-run', action='store_true', help='仅预览，不实际处理文件和写入 data.json')
    parser.add_argument('--default-cat', default='', help='默认分类名称（如"小程序"）')
    args = parser.parse_args()

    print("=" * 56)
    print("  潮汐视界 — 自动作品入库")
    print("=" * 56)

    # 加载数据
    try:
        data = load_data()
    except Exception as e:
        print(f"[错误] 无法读取 data.json: {e}")
        sys.exit(1)

    works = data.get('works', [])
    categories = data.get('categories', [])
    cat_map = get_category_map(categories)
    cat_map_inv = {v: k for k, v in cat_map.items()}  # id → label

    # 获取当前最大编号
    max_num = get_max_number(works)
    print(f"  当前作品数: {len(works)}")
    print(f"  当前最大编号: {max_num}")
    print(f"  分类列表: {', '.join(cat_map.keys())}")

    # 确定默认分类
    default_cat_id = ''
    if args.default_cat and args.default_cat in cat_map:
        default_cat_id = cat_map[args.default_cat]
    elif categories:
        default_cat_id = categories[0]['id']

    print(f"  默认分类: {args.default_cat or list(cat_map.keys())[0] if cat_map else '无'}")
    print(f"  inbox 路径: {INBOX}")
    print("-" * 56)

    # 扫描文件
    files = scan_inbox()
    if not files:
        print("\n  inbox 为空，无文件需要处理")
        print(f"  提示：将作品文件放入 {INBOX} 或其子文件夹（子文件夹名 = 分类名）")
        return

    print(f"  发现 {len(files)} 个待处理文件\n")

    # 处理文件
    new_works = []
    current_num = max_num
    processed_count = 0
    failed_count = 0

    for src_path, cat_label in files:
        current_num += 1
        cat_id = match_category(cat_label, cat_map) if cat_label else default_cat_id
        if not cat_id:
            cat_id = default_cat_id

        if args.dry_run:
            matched_label = [l for l, cid in cat_map.items() if cid == cat_id]
            cat_display = matched_label[0] if matched_label else cat_id[:12]
            folder_info = f" (文件夹: {cat_label})" if cat_label else ""
            print(f"  [预览] [{current_num}] {os.path.basename(src_path)}{folder_info} -> 分类: {cat_display}")
            continue

        work = process_file(src_path, cat_id, cat_label or cat_map_inv.get(cat_id, ''), current_num)
        if work:
            new_works.append(work)
            # 移动源文件到归档
            move_to_processed(src_path)
            processed_count += 1
        else:
            failed_count += 1
            print(f"    -> 失败，跳过")

    # 保存结果
    if args.dry_run:
        print(f"\n  {'=' * 56}")
        print(f"  [预览模式] 将新增 {len(files)} 个作品")
        print(f"  {'=' * 56}")
        return

    if new_works:
        works.extend(new_works)
        data['works'] = works
        save_data(data)
        print(f"\n  {'=' * 56}")
        print(f"  ✅ 入库完成！")
        print(f"     成功: {processed_count} 个")
        if failed_count:
            print(f"     失败: {failed_count} 个")
        print(f"     总作品数: {len(works)}")
        print(f"  {'=' * 56}")
        print(f"\n  下一步：")
        print(f"    1. 运行 python build.py 构建")
        print(f"    2. 运行 python upload_github_api.py 部署")
        print(f"    3. 或刷新浏览器后台查看新作品")
    else:
        print(f"\n  没有作品成功入库，请检查 inbox 中的文件格式")


if __name__ == '__main__':
    main()
