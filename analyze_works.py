import json, os, shutil

with open('data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

works = data.get('works', [])
categories = data.get('categories', [])

print(f'总作品数: {len(works)}')
print(f'分类数: {len(categories)}')
print()

cat_map = {c['id']: c['label'] for c in categories}
folder_map = {}
for c in categories:
    folder_map[c['id']] = c['label'].replace('/', '_').replace('\\', '_')

cat_counts = {}
for w in works:
    cat = w.get('category', '')
    cat_counts[cat] = cat_counts.get(cat, 0) + 1

print('各分类作品数:')
for cid, count in sorted(cat_counts.items(), key=lambda x: -x[1]):
    label = cat_map.get(cid, cid[:20])
    folder = folder_map.get(cid, '未分类')
    print(f'  {label} ({folder}): {count} 个')

print()
missing_files = []
missing_thumbs = []
existing = 0

for i, w in enumerate(works):
    src = w.get('src', '')
    thumb = w.get('thumbnail', '')
    
    src_exists = os.path.exists(src) if src else False
    thumb_exists = os.path.exists(thumb) if thumb else False
    
    if not src_exists:
        missing_files.append({'idx': i, 'caption': w.get('caption', ''), 'src': src, 'cat': cat_map.get(w.get('category',''), '')})
    if thumb and not thumb_exists:
        missing_thumbs.append({'idx': i, 'caption': w.get('caption', ''), 'thumb': thumb})
    
    if src_exists:
        existing += 1

print(f'文件存在: {existing}/{len(works)}')
print(f'缺失作品文件: {len(missing_files)}')
print(f'缺失缩略图: {len(missing_thumbs)}')

if missing_files:
    print()
    print('缺失的作品文件（前30个）:')
    for m in missing_files[:30]:
        print(f'  [{m["idx"]}] {m["caption"]} -> {m["src"]} ({m["cat"]})')
