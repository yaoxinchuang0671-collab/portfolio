p = r'C:\Users\潮汐视界\WorkBuddy\20260529224508\portfolio\gallery.css'
with open(p, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = {
    # 1. filter-bar 加居中
    '.filter-bar {\n  display: flex;': '.filter-bar {\n  display: flex;\n  justify-content: center;',
    
    # 2. filter-bar-section 去掉 border-bottom，改用和 gallery-section 同色
    'filter-bar-section {\n  background: var(--clr-bg);\n  padding: 32px 0 12px;\n  border-bottom: 1px solid var(--clr-border);': 
        'filter-bar-section {\n  background: var(--clr-bg2);\n  padding: 40px 0 20px;',
}

for old, new in replacements.items():
    if old in content:
        content = content.replace(old, new)
    else:
        print('NOT FOUND:', repr(old[:60]))

with open(p, 'w', encoding='utf-8') as f:
    f.write(content)
print('done')
