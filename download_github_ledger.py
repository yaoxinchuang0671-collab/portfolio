import urllib.request
import ssl
import json
import ast

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = 'https://raw.githubusercontent.com/yaoxinchuang0671-collab/portfolio/main/ledger.html'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
        content = resp.read().decode('utf-8')
        print(f'下载成功: {len(content)} bytes')

        def extract_var(var_name):
            marker = f'const {var_name} = ref('
            idx = content.find(marker)
            if idx < 0:
                print(f'{var_name}: 未找到')
                return None
            start = idx + len(marker)
            depth = 1
            end = start
            in_str = False
            str_char = None
            while end < len(content) and depth > 0:
                ch = content[end]
                if ch == '\\':
                    end += 2
                    continue
                elif in_str:
                    if ch == str_char:
                        in_str = False
                        str_char = None
                elif ch in ('"', "'"):
                    in_str = True
                    str_char = ch
                elif not in_str:
                    if ch in ('[', '{'):
                        depth += 1
                    elif ch in (']', '}'):
                        depth -= 1
                end += 1

            arr_str = content[start:end-1]
            try:
                return json.loads(arr_str)
            except:
                try:
                    return ast.literal_eval(arr_str)
                except Exception as e:
                    print(f'{var_name} 解析失败: {e}')
                    return None

        for var in ['allOrders', 'allRecharges', 'allCustomers', 'rechargeTiers', 'productList', 'memberList']:
            data = extract_var(var)
            if data is not None:
                print(f'{var}: {len(data)} 条')
                if data and isinstance(data, list) and len(data) > 0:
                    first = data[0]
                    if isinstance(first, dict):
                        print(f'  字段: {list(first.keys())}')
                    else:
                        print(f'  类型: {type(first).__name__} 值: {first}')
except Exception as e:
    print(f'下载失败: {e}')
