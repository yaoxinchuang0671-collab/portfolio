#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
upload_cos.py  增量上传到腾讯云 COS（图片 + 静态网站）
用法:
  python upload_cos.py              # 增量上传图片（只传新图）
  python upload_cos.py --force      # 强制重传所有图片
  python upload_cos.py --dry-run    # 只列出差异，不上传
  python upload_cos.py --clean      # 清空 COS 上 portfolio/ 目录（图片）
  python upload_cos.py --clean-website  # 清空 COS 桶根目录的网站文件
  python upload_cos.py --website    # 上传静态网站文件（build/ -> 桶根目录）
  python upload_cos.py --website --force  # 强制重传所有网站文件
  python upload_cos.py --website --dry-run  # 干跑模式（只列不上传）
"""

import os
import sys
import hashlib

# ── 自动加载 .env 环境变量 ──────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(SCRIPT_DIR, '.env')
if os.path.exists(ENV_PATH):
    with open(ENV_PATH, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                if k not in os.environ:
                    os.environ[k] = v

#  配置：优先从环境变量读取，未设置则提示用户
SECRET_ID  = os.environ.get('COS_SECRET_ID')
SECRET_KEY = os.environ.get('COS_SECRET_KEY')
REGION     = os.environ.get('COS_REGION', 'ap-guangzhou')
BUCKET     = os.environ.get('COS_BUCKET', 'portfolio-images-1438664071')
LOCAL_IMG  = os.path.join(SCRIPT_DIR, "img")

# COS 上的目标前缀（注意结尾的 /）
COS_PREFIX = "portfolio/"

#  引入 COS SDK 
try:
    from qcloud_cos import CosConfig, CosS3Client
except ImportError:
    print("缺少 cos-python-sdk-v5，请先安装：")
    print("  py -m pip install cos-python-sdk-v5")
    sys.exit(1)


def sha256_file(path, buf_size=65536):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            blk = f.read(buf_size)
            if not blk:
                break
            h.update(blk)
    return h.hexdigest()


def build_client():
    cfg = CosConfig(
        Region=REGION,
        SecretId=SECRET_ID,
        SecretKey=SECRET_KEY,
        Scheme="https",
    )
    return CosS3Client(cfg)


def list_cos_objects(client, prefix):
    """返回 {cos_key: etag_without_quotes}"""
    result = {}
    marker = ""
    while True:
        resp = client.list_objects(
            Bucket=BUCKET,
            Prefix=prefix,
            Marker=marker,
            MaxKeys=1000,
        )
        for obj in resp.get("Contents", []):
            key = obj["Key"]
            etag = obj["ETag"].strip('"')
            result[key] = etag
        if resp.get("IsTruncated") == "true":
            marker = resp.get("NextMarker", "")
        else:
            break
    return result


def upload_one(client, local_path, cos_key):
    """上传单个文件，返回 True/False"""
    size_mb = os.path.getsize(local_path) / 1024 / 1024
    fname = os.path.basename(local_path)
    label = f"  {fname} ({size_mb:.1f} MB)"
    try:
        client.put_object_from_local_file(
            Bucket=BUCKET,
            LocalFilePath=local_path,
            Key=cos_key,
            ACL='public-read',
        )
        print(f"{label}  上传成功")
        return True
    except Exception as e:
        print(f"{label}  上传失败: {e}")
        return False


def clean_cos(client, prefix, dry_run=False):
    """清空 COS 上指定前缀的所有文件"""
    print(f"正在获取 COS 文件列表（{prefix}）...")
    cos_map = list_cos_objects(client, prefix)
    if not cos_map:
        print("COS 上空空如也，无需清理")
        return True

    files = list(cos_map.keys())
    print(f"找到 {len(files)} 个文件:")
    for k in files:
        print(f"  - {k}")

    if dry_run:
        print(f"\n干跑模式：以上 {len(files)} 个文件不会被删除")
        return True

    print(f"\n开始删除 {len(files)} 个文件（批量模式）...")
    ok = 0
    batch_size = 100
    for i in range(0, len(files), batch_size):
        batch = files[i:i+batch_size]
        try:
            resp = client.delete_objects(
                Bucket=BUCKET,
                Delete={'Object': [{'Key': k} for k in batch]}
            )
            deleted = len(resp.get('Deleted', []))
            ok += deleted
            print(f"  批次 {i//batch_size+1}: 删除 {deleted}/{len(batch)}")
        except Exception as e:
            print(f"  批次 {i//batch_size+1} 失败: {e}")
            for key in batch:
                try:
                    client.delete_object(Bucket=BUCKET, Key=key)
                    ok += 1
                except:
                    pass

    print(f"完成! 成功删除 {ok}/{len(files)} 个文件")
    return ok == len(files)


# ── 静态网站上传 ─────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.join(SCRIPT_DIR, "build")

# MIME 类型映射（COS 静态网站需要正确的 Content-Type）
MIME_MAP = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".xml": "application/xml; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
}


def collect_website_files(root, exclude=None):
    """递归收集目录下所有文件，返回 [(local_path, cos_key), ...]"""
    if exclude is None:
        exclude = set()
    files = []
    for dirpath, dirnames, filenames in os.walk(root):
        # 过滤排除的目录名
        dirnames[:] = [d for d in dirnames if d not in exclude]
        for fname in filenames:
            if fname in exclude:
                continue
            local_path = os.path.join(dirpath, fname)
            rel_path = os.path.relpath(local_path, root).replace("\\", "/")
            cos_key = rel_path  # 网站文件放在桶根目录
            files.append((local_path, cos_key))
    return files


def guess_content_type(filename):
    """根据文件扩展名猜测 MIME 类型"""
    ext = os.path.splitext(filename)[1].lower()
    return MIME_MAP.get(ext, "application/octet-stream")


def upload_website(client, build_dir, force=False, dry_run=False):
    """上传静态网站文件到 COS 桶根目录"""
    if not os.path.isdir(build_dir):
        print(f"build 目录不存在: {build_dir}")
        print("请先运行 build.py 构建代码")
        return False

    files = collect_website_files(build_dir)
    if not files:
        print("build 目录为空，无文件可上传")
        return False

    print(f"网站文件: {len(files)} 个")
    if force:
        print("  强制模式: 重新上传所有文件")

    # 获取 COS 上已有文件（用于增量判断）
    if not force and not dry_run:
        print("正在获取 COS 文件列表...")
        existing = list_cos_objects(client, "")  # 根目录所有文件
        print(f"  COS 已有: {len(existing)} 个文件\n")
    else:
        existing = {}

    to_upload = []
    skipped = 0
    for local_path, cos_key in files:
        if cos_key in existing and not force:
            skipped += 1
            if dry_run:
                print(f"  已存在，跳过: {cos_key}")
        else:
            to_upload.append((local_path, cos_key))

    if dry_run:
        print(f"\n干跑结束: 需上传 {len(to_upload)} 个, 跳过 {skipped} 个")
        return True

    if not to_upload:
        print("所有网站文件已是最新，无需上传")
        return True

    print(f"\n开始上传 {len(to_upload)} 个文件 (跳过 {skipped} 个)...\n")
    ok = 0
    for local_path, cos_key in to_upload:
        ctype = guess_content_type(local_path)
        size_kb = os.path.getsize(local_path) / 1024
        label = f"  {cos_key} ({size_kb:.1f} KB)"
        try:
            # 使用底层 put_object 完全控制 HTTP 头，覆盖桶级 Content-Disposition 设置
            with open(local_path, 'rb') as f:
                client.put_object(
                    Bucket=BUCKET,
                    Key=cos_key,
                    Body=f,
                    ACL='public-read',
                    ContentType=ctype,
                    Metadata={
                        'x-cos-force-download': 'false',
                    },
                )
            print(f"{label} -> OK")
            ok += 1
        except Exception as e:
            print(f"{label} -> FAIL: {e}")

    print(f"\n网站上传完成! {ok}/{len(to_upload)} 成功, {skipped} 跳过")
    WEBSITE_URL = f"https://{BUCKET}.cos-website.{REGION}.myqcloud.com/"
    print(f"访问地址: {WEBSITE_URL}")
    return ok == len(to_upload)


def main():
    # ── 检查环境变量 ──
    if not SECRET_ID or not SECRET_KEY:
        print("[错误] 缺少腾讯云 COS 密钥")
        print("请在终端中设置环境变量后重试：")
        print("  set COS_SECRET_ID=你的SecretId")
        print("  set COS_SECRET_KEY=你的SecretKey")
        print("或将上述命令写入 .env 文件（项目根目录），然后运行")
        sys.exit(1)

    force = "--force" in sys.argv
    dry_run = "--dry-run" in sys.argv
    clean = "--clean" in sys.argv
    clean_website = "--clean-website" in sys.argv
    website = "--website" in sys.argv

    # ── 清空网站文件模式 ──
    if clean_website:
        print("腾讯云 COS 网站文件清理")
        print(f"  Bucket: {BUCKET}")
        print("  将删除桶根目录的所有网站文件（保留 img/ 和 portfolio/ 图片）\n")
        client = build_client()
        print("正在获取 COS 文件列表...")
        all_objects = list_cos_objects(client, "")
        # 只删除桶根网站文件（排除 img/ 和 portfolio/ 前缀）
        exclude_prefixes = ("img/", "portfolio/", "portfolio-images/")
        website_files = [k for k in all_objects.keys()
                         if not any(k.startswith(p) for p in exclude_prefixes)]
        if not website_files:
            print("桶根目录没有网站文件，无需清理")
            return
        print(f"找到 {len(website_files)} 个网站文件:")
        for k in website_files:
            print(f"  - {k}")
        if dry_run:
            print(f"\n干跑模式：以上 {len(website_files)} 个文件不会被删除")
            return
        # 用户已通过聊天确认，直接执行删除
        print(f"\n开始删除 {len(website_files)} 个文件...")
        ok = 0
        batch_size = 100
        for i in range(0, len(website_files), batch_size):
            batch = website_files[i:i+batch_size]
            try:
                resp = client.delete_objects(
                    Bucket=BUCKET,
                    Delete={'Object': [{'Key': k} for k in batch]}
                )
                deleted = len(resp.get('Deleted', []))
                ok += deleted
                print(f"  批次 {i//batch_size+1}: 删除 {deleted}/{len(batch)}")
            except Exception as e:
                print(f"  批次 {i//batch_size+1} 失败: {e}")
        print(f"完成! 成功删除 {ok}/{len(website_files)} 个文件")
        return

    # ── 网站模式 ──
    if website:
        force_label = " --force" if force else ""
        dry_label = " --dry-run" if dry_run else ""
        print(f"腾讯云 COS 静态网站部署{force_label}{dry_label}")
        print(f"  Bucket: {BUCKET}")
        print(f"  Build : {BUILD_DIR}")
        print()
        client = build_client()
        upload_website(client, BUILD_DIR, force=force, dry_run=dry_run)
        return

    print("腾讯云 COS 图片同步")
    print(f"  本地目录 : {LOCAL_IMG}")
    print(f"  COS 路径 : {BUCKET}/{COS_PREFIX}")
    if force:
        print("  强制模式：重新上传所有图片")
    if dry_run:
        print("  干跑模式：只列差异，不上传")
    if clean:
        print("   清理模式：清空 COS 上的旧图片")
    print()

    if not os.path.isdir(LOCAL_IMG):
        print(f"本地目录不存在: {LOCAL_IMG}")
        sys.exit(1)

    client = build_client()

    #  清理模式 
    if clean:
        if dry_run:
            # 干跑模式跳过确认，直接列出
            print("[干跑] 列出 COS 上所有文件...")
            clean_cos(client, COS_PREFIX, dry_run=True)
            return
        try:
            confirm = input("确认清空 COS 上的所有图片？(y/N): ")
        except EOFError:
            print("非交互环境，跳过确认")
            confirm = ""
        if confirm.lower() != "y":
            print("已取消")
            return
        clean_cos(client, COS_PREFIX, dry_run=False)
        return

    # 1. 扫描本地图片
    exts = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
    local_files = [
        f for f in os.listdir(LOCAL_IMG)
        if os.path.splitext(f)[1].lower() in exts
    ]
    local_files.sort()
    print(f"本地图片: {len(local_files)} 张")

    # 2. 列出 COS 上已有文件
    print("正在获取 COS 文件列表...")
    cos_map = list_cos_objects(client, COS_PREFIX)
    print(f"COS 已有  : {len(cos_map)} 个文件\n")

    # 3. 对比 & 上传
    to_upload = []
    skipped = 0
    for fname in local_files:
        local_path = os.path.join(LOCAL_IMG, fname)
        cos_key = COS_PREFIX + fname
        if cos_key in cos_map and not force:
            skipped += 1
            if dry_run:
                print(f"  已存在，跳过: {fname}")
        else:
            to_upload.append((fname, local_path, cos_key))

    if dry_run:
        print(f"\n干跑结束：需上传 {len(to_upload)} 张，跳过 {skipped} 张")
        return

    if not to_upload:
        print("所有图片已是最新，无需上传")
        return

    print(f"开始上传 {len(to_upload)} 张图片（跳过 {skipped} 张）...\n")
    ok = 0
    for fname, local_path, cos_key in to_upload:
        if upload_one(client, local_path, cos_key):
            ok += 1

    print(f"\n完成! 成功 {ok}/{len(to_upload)}，跳过 {skipped}")


if __name__ == "__main__":
    main()
