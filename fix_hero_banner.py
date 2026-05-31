p = r'C:\Users\潮汐视界\WorkBuddy\20260529224508\portfolio\styles.css'
with open(p, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. 修改 .hero：让内容居中
old_hero = '''.hero {
  position: relative;
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  padding-top: var(--nav-h);
  overflow: hidden;
}'''

new_hero = '''.hero {
  position: relative;
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: var(--nav-h);
  overflow: hidden;
}'''

# 2. 修改 .hero-layout：变成圆角矩形 banner 卡片
old_layout = '''.hero-layout {
  position: relative;
  z-index: 1;
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 560px;
  grid-template-rows: 1fr;
  gap: 64px;
  align-items: center;
  padding-top: var(--nav-h);
  padding-bottom: 60px;
}'''

new_layout = '''.hero-layout {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr 560px;
  gap: 64px;
  align-items: center;

  /* 圆角矩形 banner 卡片 */
  background: rgba(18, 18, 24, 0.65);
  backdrop-filter: blur(32px);
  -webkit-backdrop-filter: blur(32px);
  border-radius: 32px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 56px 72px;
  max-width: 1200px;
  width: 100%;
}'''

if old_hero in content:
    content = content.replace(old_hero, new_hero)
    print('  .hero updated')
else:
    print('  ERROR: .hero not found')

if old_layout in content:
    content = content.replace(old_layout, new_layout)
    print('  .hero-layout updated')
else:
    print('  ERROR: .hero-layout not found')

with open(p, 'w', encoding='utf-8') as f:
    f.write(content)
print('done')
