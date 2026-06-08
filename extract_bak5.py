import json
import ast

path = r'C:\Users\潮汐视界\WorkBuddy\20260604000923\tidal-ledger-prototype.html.bak5'
with open(path,'r',encoding='utf-8') as f:
    content = f.read()

def extract_ref_array(content, var_name):
    marker = f'const {var_name} = ref('
    idx = content.find(marker)
    if idx < 0:
        return None, 0
    start = idx + len(marker)
    depth = 1
    end = start
    in_string = False
    string_char = None
    escape = False

    while end < len(content) and depth > 0:
        ch = content[end]
        if escape:
            escape = False
        elif ch == '\\':
            escape = True
        elif in_string:
            if ch == string_char:
                in_string = False
                string_char = None
        elif ch in ('"', "'"):
            in_string = True
            string_char = ch
        elif not in_string:
            if ch in ('[', '{'):
                depth += 1
            elif ch in (']', '}'):
                depth -= 1
        end += 1

    arr_str = content[start:end-1]
    try:
        data = json.loads(arr_str)
        return data, len(data)
    except Exception as e:
        try:
            data = ast.literal_eval(arr_str)
            return data, len(data)
        except Exception as e2:
            print(f'{var_name} 解析失败: {e} / {e2}')
            return None, 0

for var in ['allOrders', 'allCustomers', 'rechargeTiers', 'productList', 'memberList']:
    data, count = extract_ref_array(content, var)
    print(f'{var}: {count}')
    if data and count > 0 and isinstance(data, list):
        first = data[0]
        if isinstance(first, dict):
            print(f'  字段: {list(first.keys())}')
        else:
            print(f'  类型: {type(first)} 值: {first}')
