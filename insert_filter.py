p = r'C:\Users\潮汐视界\WorkBuddy\20260529224508\portfolio\index.html'
with open(p, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 找第一个不包含 gallery 的 </section>
insert_idx = None
for i, line in enumerate(lines):
    if '</section>' in line and 'gallery' not in line:
        insert_idx = i
        break

if insert_idx is None:
    print('ERROR: could not find insert point')
    raise SystemExit

sep = '=' * 52
insert = [
    '',
    '<!-- ' + sep,
    '       分类筛选栏',
    '       ' + sep + ' -->',
    '<section class="filter-bar-section">',
    '  <div class="container">',
    '    <div class="filter-bar" id="filterBar">',
    '      <button class="filter-btn active" data-filter="all">全部</button>',
    '      <button class="filter-btn" data-filter="cat1">分类一</button>',
    '      <button class="filter-btn" data-filter="cat2">分类二</button>',
    '      <button class="filter-btn" data-filter="cat3">分类三</button>',
    '      <button class="filter-btn" data-filter="cat4">分类四</button>',
    '      <button class="filter-btn" data-filter="cat5">分类五</button>',
    '    </div>',
    '  </div>',
    '</section>',
    '',
]

new_lines = lines[:insert_idx+1] + [l + '\n' for l in insert] + lines[insert_idx+1:]
with open(p, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('inserted at line', insert_idx + 2)
