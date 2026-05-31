#!/usr/bin/env python3
import os
import shutil
from PIL import Image

IMG_DIR = os.path.join(os.path.dirname(__file__), "img")
BACKUP_DIR = os.path.join(os.path.dirname(__file__), "img_backup")
MAX_WIDTH = 1200
QUALITY = 80

os.makedirs(BACKUP_DIR, exist_ok=True)

def compress_image(src_path, dst_path):
    img = Image.open(src_path)
    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGB')
    elif img.mode != 'RGB':
        img = img.convert('RGB')
    w, h = img.size
    if w > MAX_WIDTH:
        ratio = MAX_WIDTH / w
        new_size = (MAX_WIDTH, int(h * ratio))
        img = img.resize(new_size, Image.LANCZOS)
    img.save(dst_path, 'JPEG', quality=QUALITY, optimize=True)

def main():
    files = sorted([f for f in os.listdir(IMG_DIR)
                    if f.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp'))])
    print(f"找到 {len(files)} 个图片文件")
    print("开始压缩...")
    total_before = 0
    total_after = 0

    for fname in files:
        src = os.path.join(IMG_DIR, fname)
        backup = os.path.join(BACKUP_DIR, fname)
        if fname.lower().endswith('.gif'):
            print(f"  [SKIP] GIF: {fname}")
            continue
        if not os.path.exists(backup):
            shutil.copy2(src, backup)
        before = os.path.getsize(src)
        total_before += before
        try:
            compress_image(src, src)
            after = os.path.getsize(src)
            total_after += after
            saved = (before - after) / before * 100
            print(f"  [OK] {fname}: {before//1024}KB -> {after//1024}KB (-{saved:.0f}%)")
        except Exception as e:
            print(f"  [ERR] {fname}: {e}")

    print(f"\n总计: {total_before//1024//1024}MB -> {total_after//1024//1024}MB 节省了 {(total_before-total_after)//1024//1024}MB")
    print(f"原图备份: {BACKUP_DIR}")

if __name__ == "__main__":
    main()
