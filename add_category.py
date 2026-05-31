p = r'C:\Users\潮汐视界\WorkBuddy\20260529224508\portfolio\index.html'
with open(p, 'r', encoding='utf-8') as f:
    content = f.read()

cats = ['cat1', 'cat2', 'cat3', 'cat1', 'cat2', 'cat3', 'cat4', 'cat5']
for i, cat in enumerate(cats, 1):
    old = 'class="waterfall-item" data-caption="作品{}"'.format(i)
    new = 'class="waterfall-item" data-category="{}" data-caption="作品{}"'.format(cat, i)
    content = content.replace(old, new, 1)

with open(p, 'w', encoding='utf-8') as f:
    f.write(content)
print('done: added data-category to', len(cats), 'items')
