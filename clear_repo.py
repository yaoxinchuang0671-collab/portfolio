#!/usr/bin/env python3
"""清空 GitHub 仓库所有文件（递归删除）"""
import requests
import json
import sys
import time

TOKEN = open("upload_github_api.py").read().split('TOKEN = "')[1].split('"')[0]
REPO_OWNER = "yaoxinchuang0671-collab"
REPO_NAME = "portfolio"
BRANCH = "main"
API_BASE = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/contents"
HEADERS = {
    "Authorization": f"token {TOKEN}",
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "PortfolioCleaner"
}

def get_sha(path):
    url = f"{API_BASE}/{path}?ref={BRANCH}"
    r = requests.get(url, headers=HEADERS, timeout=10)
    if r.status_code == 200:
        return r.json().get("sha")
    return None

def delete_file(path):
    sha = get_sha(path)
    if not sha:
        print(f"  [SKIP] {path} (已不存在)")
        return False
    data = {
        "message": f"Delete {path}",
        "sha": sha,
        "branch": BRANCH
    }
    url = f"{API_BASE}/{path}"
    r = requests.delete(url, headers=HEADERS, data=json.dumps(data), timeout=15)
    if r.status_code == 200:
        print(f"  [OK] {path}")
        return True
    else:
        print(f"  [ERR] {path}: {r.status_code}")
        return False

def list_all_files(path=""):
    """递归列出仓库所有文件"""
    url = f"{API_BASE}/{path}?ref={BRANCH}"
    r = requests.get(url, headers=HEADERS, timeout=10)
    if r.status_code != 200:
        return []
    items = r.json() if isinstance(r.json(), list) else []
    files = []
    for item in items:
        if item.get("type") == "file":
            files.append(item["path"])
        elif item.get("type") == "dir":
            files.extend(list_all_files(item["path"]))
    return files

def main():
    print(f"🔍 扫描仓库 {REPO_OWNER}/{REPO_NAME}...")
    files = list_all_files()
    if not files:
        print("   仓库已是空的，无需清理")
        return

    print(f"   找到 {len(files)} 个文件，开始删除...")
    print("   （GitHub API 限速：约每 2 秒删除一个）\n")

    ok = 0
    for i, f in enumerate(files, 1):
        if delete_file(f):
            ok += 1
        # 避免触发 GitHub API 限速
        if i % 5 == 0:
            time.sleep(1)
            print(f"   进度: {i}/{len(files)}")

    print(f"\n✅ 完成！删除 {ok}/{len(files)} 个文件")
    print("   现在可以运行 upload_github_api.py 重新上传了")

if __name__ == "__main__":
    main()
