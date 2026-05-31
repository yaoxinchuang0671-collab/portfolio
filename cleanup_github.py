#!/usr/bin/env python3
"""删除 GitHub 仓库里的 img_backup/ 目录"""
import requests
import json

TOKEN = open("upload_github_api.py").read().split('TOKEN = "')[1].split('"')[0]
REPO_OWNER = "yaoxinchuang0671-collab"
REPO_NAME = "portfolio"
BRANCH = "main"
API_BASE = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/contents"
HEADERS = {
    "Authorization": f"token {TOKEN}",
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "PortfolioCleanup"
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
        print(f"  [SKIP] {path} (not found)")
        return False
    data = {
        "message": f"Delete {path}",
        "sha": sha,
        "branch": BRANCH
    }
    url = f"{API_BASE}/{path}"
    r = requests.delete(url, headers=HEADERS, data=json.dumps(data), timeout=10)
    if r.status_code == 200:
        print(f"  [OK] 删除 {path}")
        return True
    else:
        print(f"  [ERR] 删除 {path}: {r.status_code}")
        return False

def list_files(path=""):
    url = f"{API_BASE}/{path}?ref={BRANCH}"
    r = requests.get(url, headers=HEADERS, timeout=10)
    if r.status_code == 200:
        return r.json()
    return []

def main():
    print("扫描 img_backup/ 目录...")
    files = list_files("img_backup")
    if not isinstance(files, list):
        print("img_backup/ 不存在或已是空目录")
        return
    print(f"找到 {len(files)} 个文件，开始删除...")
    for f in files:
        if f.get("type") == "file":
            delete_file(f"img_backup/{f['name']}")
    # 删除目录本身（通过删掉目录内容后 GitHub 会自动移除空目录）
    print("\n清理完成！")

if __name__ == "__main__":
    main()
