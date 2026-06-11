#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
整理现有作品到分类文件夹
- 创建 img/分类名/ 文件夹
- 移动作品文件和缩略图到对应分类文件夹
- 更新 data.json 中的 src 和 thumbnail 路径
"""

import json
import os
import shutil

with open('data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

works = data.get('works', [])
categories = data.get('categories', [])

cat_map = {c['id']: c['label'] for c in categories}
folder_map = {}
for c in categories:
    folder_map[c['id']] = c['label'].replace('/', '_').replace('\\', '_')

# 先备份 data.json
shutil.copy('data.json', 'data.json.bak')
print('已备份 data.json -> data.json.bak')

# 创建分类文件夹
print('\n创建分类文件夹:')
for cid, folder in folder_map.items():
    cat_dir = os.path.join('img', folder)
    if not os.path.exists(cat_dir):
        os.makedirs(cat_dir)
        print(f'  新建: img/{folder}/')
    else:
        print(f'  已存在: img/{folder}/')

# 移动文件并更新路径
moved = 0
skipped = 0
errors = 0

print('\n开始整理文件...')
for i, w in enumerate(works):
    cat_id = w.get('category', '')
    src = w.get('src', '')
    thumb = w.get('thumbnail', '')
    
    if not src or not cat_id:
        skipped += 1
        continue
    
    folder = folder_map.get(cat_id, '')
    if not folder:
        skipped += 1
        continue
    
    # 如果已经在分类文件夹内，跳过
    if src.startswith(f'img/{folder}/'):
        skipped += 1
        continue
    
    # 计算新路径
    filename = os.path.basename(src)
    new_src = f'img/{folder}/{filename}'
    
    # 移动文件
    if os.path.exists(src):
        try:
            shutil.move(src, new_src)
        except Exception as e:
            print(f'  [错误] 移动失败 {src} -> {new_src}: {e}')
            errors += 1
            continue
    
    # 更新 data.json 路径
    w['src'] = new_src
    
    # 处理缩略图
    if thumb:
        thumb_filename = os.path.basename(thumb)
        new_thumb = f'img/{folder}/{thumb_filename}'
        
        if os.path.exists(thumb) and not thumb.startswith(f'img/{folder}/'):
            try:
                shutil.move(thumb, new_thumb)
            except Exception as e:
                print(f'  [错误] 移动缩略图失败 {thumb} -> {new_thumb}: {e}')
        
        w['thumbnail'] = new_thumb
    
    moved += 1
    if moved % 50 == 0:
        print(f'  已整理 {moved} 个...')

# 保存更新后的 data.json
with open('data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f'\n{"="*50}')
print(f'整理完成！')
print(f'  移动作品: {moved} 个')
print(f'  跳过（已在分类文件夹或无效）: {skipped} 个')
print(f'  错误: {errors} 个')
print(f'{"="*50}')

# 验证
print('\n验证文件存在性:')
missing = 0
for w in works[:20]:
    if not os.path.exists(w.get('src', '')):
        missing += 1
if missing == 0:
    print('  前20个作品文件全部存在 ✓')
else:
    print(f'  前20个作品中有 {missing} 个文件缺失')
