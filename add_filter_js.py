p = r'C:\Users\潮汐视界\WorkBuddy\20260529224508\portfolio\index.html'
with open(p, 'r', encoding='utf-8') as f:
    content = f.read()

old = '<script src="gallery.js"></script>'
new = '<script src="gallery.js"></script>\n  <script src="filter.js"></script>'

if 'filter.js' not in content:
    content = content.replace(old, new)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(content)
    print('done: filter.js reference added')
else:
    print('filter.js already referenced')
