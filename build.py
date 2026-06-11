#!/usr/bin/env python3
"""
构建脚本：压缩 JS/CSS/HTML 代码
- 去除单行/多行注释
- 压缩空白（换行、缩进、多余空格）
- 输出到 build/ 目录，保留目录结构
"""
import os, re, shutil, sys

# 修复 Windows 终端 UTF-8 编码
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR   = os.path.join(SCRIPT_DIR, 'build')

# 需要构建的文件
BUILD_FILES = [
    'index.html',
    'login.html',
    'admin.html',
    'ledger.html',     # 直接复制（单文件 Vue 应用，不压缩）
    'styles.css',
    'gallery.css',
    'gallery.js',
    'render.js',
    'main.js',
    'sw.js',
    'data.json',      # 直接复制
]

def minify_css(content):
    """压缩 CSS"""
    # 去除注释
    content = re.sub(r'/\*[\s\S]*?\*/', '', content)
    # 压缩空白
    content = re.sub(r'\s+', ' ', content)
    content = re.sub(r'\s*([{}:;,])\s*', r'\1', content)
    content = content.replace(';}', '}')
    return content.strip()

def minify_js(content):
    """压缩 JavaScript"""
    # 去除单行注释（保留 http:// https://）
    lines = content.split('\n')
    result = []
    for line in lines:
        stripped = line.strip()
        # 跳过纯注释行
        if stripped.startswith('//') and not stripped.startswith('// ') and not re.match(r'//\s*-{3,}', stripped):
            continue
        # 保留 http:// https://
        if '//' in stripped:
            # 简单处理：去掉行尾注释
            in_str = False
            str_char = ''
            for i, ch in enumerate(stripped):
                if ch in ('"', "'", '`') and (i == 0 or stripped[i-1] != '\\'):
                    if not in_str:
                        in_str = True
                        str_char = ch
                    elif ch == str_char:
                        in_str = False
                if not in_str and ch == '/' and i+1 < len(stripped) and stripped[i+1] == '/':
                    stripped = stripped[:i].rstrip()
                    break
            if not stripped.strip():
                continue
        result.append(stripped)
    content = '\n'.join(result)

    # 去除多行注释
    content = re.sub(r'/\*[\s\S]*?\*/', '', content)

    # 压缩空白
    lines = content.split('\n')
    compact = []
    for line in lines:
        stripped = line.strip()
        if stripped:
            compact.append(stripped)
    content = ' '.join(compact)

    # 保护字符串字面量（防止操作符去空格破坏字符串内部空格）
    protected = {}
    def protect_str(match):
        key = f'__STR_{len(protected)}__'
        protected[key] = match.group(0)
        return key
    content = re.sub(r'"([^"\\]|\\.)*"', protect_str, content)
    content = re.sub(r"'([^'\\]|\\.)*'", protect_str, content)
    content = re.sub(r'`([^`\\]|\\.)*`', protect_str, content)

    # 操作符周围去空格
    content = re.sub(r'\s*([=+\-*/<>!&|%?:;,{}()[\]])\s*', r'\1', content)
    # 但保留一些必要空格
    content = re.sub(r'}\s*else\s*{', '}else{', content)
    # 恢复关键字的空格
    content = content.replace('function(', 'function (')
    content = content.replace('if(', 'if (')
    content = content.replace('for(', 'for (')
    content = content.replace('while(', 'while (')
    content = content.replace('catch(', 'catch (')
    content = content.replace('switch(', 'switch (')
    content = content.replace(')return', ') return')
    content = content.replace(')continue', ') continue')

    # 恢复字符串字面量
    for key, val in protected.items():
        content = content.replace(key, val)

    return content.strip()

def minify_html(content):
    """压缩 HTML（保留 pre/textarea 内的空白）"""
    # 去除 HTML 注释（保留条件注释）
    content = re.sub(r'<!--(?!\[if\s).*?-->', '', content, flags=re.DOTALL)

    # 保护 <pre> 和 <textarea>
    protected = {}
    def protect_tag(match):
        key = f'__PROTECTED_{len(protected)}__'
        protected[key] = match.group(0)
        return key
    content = re.sub(r'<(pre|textarea)[\s\S]*?</\1>', protect_tag, content, flags=re.IGNORECASE)
    content = re.sub(r'<(style|script)[\s\S]*?</\1>', protect_tag, content, flags=re.IGNORECASE)

    # 压缩 HTML 空白
    content = re.sub(r'>\s+<', '><', content)
    content = re.sub(r'\s{2,}', ' ', content)

    # 恢复保护的内容
    for key, val in protected.items():
        content = content.replace(key, val)

    return content.strip()

def minify_file(filepath, ext):
    """根据扩展名选择合适的压缩方法"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_size = len(content.encode('utf-8'))

    if ext == '.css':
        content = minify_css(content)
    elif ext == '.js':
        content = minify_js(content)
    elif ext == '.html':
        content = minify_html(content)

    compressed_size = len(content.encode('utf-8'))
    return content, original_size, compressed_size

def copy_dir(src, dst):
    """复制整个目录"""
    if os.path.exists(dst):
        shutil.rmtree(dst)
    shutil.copytree(src, dst)

def main():
    print(f'\n{"="*60}')
    print(f'  构建 - 代码压缩')
    print(f'{"="*60}\n')

    # 清空 build 目录
    if os.path.exists(BUILD_DIR):
        shutil.rmtree(BUILD_DIR)
    os.makedirs(BUILD_DIR)

    total_orig = 0
    total_comp = 0
    file_count = 0

    for rel in BUILD_FILES:
        src = os.path.join(SCRIPT_DIR, rel)
        dst = os.path.join(BUILD_DIR, rel)

        # 确保目标目录存在
        os.makedirs(os.path.dirname(dst), exist_ok=True)

        ext = os.path.splitext(rel)[1].lower()

        if rel == 'ledger.html':
            # 单文件 Vue 应用，直接复制避免压缩破坏模板语法
            shutil.copy2(src, dst)
            orig = os.path.getsize(src)
            print(f'  📋 {rel:24s} {orig:>6d}B  (直接复制)')
            total_orig += orig
            total_comp += orig
        elif ext in ('.css', '.js', '.html'):
            content, orig, comp = minify_file(src, ext)
            with open(dst, 'w', encoding='utf-8') as f:
                f.write(content)
            pct = round((1 - comp / orig) * 100, 1) if orig > 0 else 0
            print(f'  ✅ {rel:24s} {orig:>6d}B → {comp:>6d}B  (-{pct}%)')
            total_orig += orig
            total_comp += comp
            file_count += 1
        else:
            shutil.copy2(src, dst)
            orig = os.path.getsize(src)
            print(f'  📋 {rel:24s} {orig:>6d}B  (直接复制)')
            total_orig += orig
            total_comp += orig


    # 复制 js/ 目录（保留子目录结构，不压缩）
    JS_SRC = os.path.join(SCRIPT_DIR, 'js')
    JS_DST = os.path.join(BUILD_DIR, 'js')
    if os.path.isdir(JS_SRC):
        if os.path.exists(JS_DST):
            shutil.rmtree(JS_DST)
        shutil.copytree(JS_SRC, JS_DST)
        js_count = sum(1 for _, _, files in os.walk(JS_DST) for _ in files)
        print(f'  📁 js/                      {js_count:>6d}个文件 (直接复制)')

    print(f'\n{"─"*60}')
    print(f'  总计: {file_count} 个文件')
    print(f'  原始: {total_orig/1024:.1f} KB  →  压缩后: {total_comp/1024:.1f} KB')
    if total_orig > 0:
        print(f'  节省: {(total_orig - total_comp)/1024:.1f} KB  ({round((1-total_comp/total_orig)*100, 1)}%)')
    print(f'  输出: {BUILD_DIR}')
    print(f'{"─"*60}\n')

if __name__ == '__main__':
    main()
