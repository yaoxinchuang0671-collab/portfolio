import re

path = r'C:\Users\潮汐视界\WorkBuddy\20260529224508\portfolio\index.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 替换所有 picsum.photos 链接为本地 SVG
replacements = [
    ('https://picsum.photos/seed/p1/600/800', 'img/work1.svg'),
    ('https://picsum.photos/seed/p2/600/600', 'img/work2.svg'),
    ('https://picsum.photos/seed/p3/600/900', 'img/work3.svg'),
    ('https://picsum.photos/seed/p4/600/700', 'img/work4.svg'),
    ('https://picsum.photos/seed/p5/600/850', 'img/work5.svg'),
    ('https://picsum.photos/seed/p6/600/650', 'img/work6.svg'),
    ('https://picsum.photos/seed/p7/600/750', 'img/work7.svg'),
    ('https://picsum.photos/seed/p8/600/950', 'img/work8.svg'),
]

for old, new in replacements:
    content = content.replace(old, new)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('done: replaced', len(replacements), 'image URLs')
