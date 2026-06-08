#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 tidal-ledger-prototype.html 提取账本数据
"""

import json
import re

def extract_array(content, var_name):
    """从 Vue ref 定义中提取数组"""
    pattern = rf"{re.escape(var_name)}\s*=\s*ref\((\[.*?\])\)"
    # 使用非贪婪匹配，但需要处理嵌套括号
    # 改用逐字符匹配
    start_marker = f"{var_name} = ref("
    idx = content.find(start_marker)
    if idx < 0:
        return None
    
    start = idx + len(start_marker)
    depth = 1
    end = start
    while end < len(content) and depth > 0:
        if content[end] == '[':
            depth += 1
        elif content[end] == ']':
            depth -= 1
        end += 1
    
    arr_str = content[start:end-1]
    try:
        return json.loads(arr_str)
    except json.JSONDecodeError as e:
        print(f"解析 {var_name} 失败: {e}")
        return None

def main():
    bak_path = r'C:\Users\潮汐视界\WorkBuddy\20260604000923\tidal-ledger-prototype.html.bak5'
    
    with open(bak_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    print("从 bak5 提取数据...")
    
    all_customers = extract_array(content, 'allCustomers')
    orders = extract_array(content, 'orders')
    recharges = extract_array(content, 'recharges')
    
    if all_customers is not None:
        print(f"allCustomers: {len(all_customers)}")
    if orders is not None:
        print(f"orders: {len(orders)}")
    if recharges is not None:
        print(f"recharges: {len(recharges)}")
    
    # 保存为 ledger_data.json
    data = {
        "allCustomers": all_customers or [],
        "orders": orders or [],
        "recharges": recharges or [],
        "lastUpdated": "2026-06-04T05:20:00",
        "source": "restored_from_bak5"
    }
    
    output = r'C:\ProgramData\WorkBuddy\chromium-env\1tfn88x\WorkBuddy\2026-06-08-11-50-17\ledger_data_restored.json'
    with open(output, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\n已保存到 ledger_data_restored.json")
    print(f"文件大小: {len(json.dumps(data, ensure_ascii=False))} bytes")

if __name__ == '__main__':
    main()
