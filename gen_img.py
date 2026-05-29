import os

out = r'C:\Users\潮汐视界\WorkBuddy\20260529224508\portfolio\img'
os.makedirs(out, exist_ok=True)

sizes = [800, 600, 900, 700, 850, 650, 750, 950]
colors = ['#7c6af5','#f5816a','#50d8a4','#f5c842','#6a9cf5','#f56a9c','#42f5c8','#f5a842']

for i, (h, c) in enumerate(zip(sizes, colors), 1):
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="{}">'
        '<rect width="600" height="{}" fill="{}" opacity="0.15"/>'
        '<text x="300" y="{}" text-anchor="middle" dominant-baseline="middle"'
        ' font-family="Arial,sans-serif" font-size="48" fill="{}" opacity="0.6">作品{}</text>'
        '</svg>'
    ).format(h, h, c, h//2, c, i, h, h, c)
    path = os.path.join(out, 'work{}.svg'.format(i))
    with open(path, 'w', encoding='utf-8') as f:
        f.write(svg)
    print('  ' + path)

print('done: {} files'.format(len(sizes)))
