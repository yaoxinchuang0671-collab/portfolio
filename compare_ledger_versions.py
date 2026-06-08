import re
import os

def count_orders_in_html(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    count = content.count('{id:')
    m = re.search(r'syncedAt[\'"\s:]+([^,\}\]]+)', content)
    synced = m.group(1) if m else 'unknown'
    size = os.path.getsize(path)
    return count, synced, size

files = [
    r'C:\Users\潮汐视界\WorkBuddy\20260604000923\tidal-ledger-prototype.html.bak2',
    r'C:\Users\潮汐视界\WorkBuddy\20260604000923\tidal-ledger-prototype.html.bak3',
    r'C:\Users\潮汐视界\WorkBuddy\20260604000923\tidal-ledger-prototype.html.bak4',
    r'C:\Users\潮汐视界\WorkBuddy\20260604000923\tidal-ledger-prototype.html',
    r'C:\Users\潮汐视界\WorkBuddy\20260604000923\tidal-ledger-prototype.html.bak5',
]

print("file | size | orders_est | syncedAt")
for f in files:
    if os.path.exists(f):
        count, synced, size = count_orders_in_html(f)
        print(f"{os.path.basename(f)} | {size} | {count} | {synced}")
