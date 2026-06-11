#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从腾讯云 COS 批量下载图片到本地 img/ 目录
用法:
  python download_cos.py              # 下载缺失的图片
  python download_cos.py --dry-run    # 只列出 COS 上有但本地缺失的文件
  python download_cos.py --all        # 下载所有 COS 上的图片（覆盖本地）
"""

import os
import sys

# 配置（与 upload_cos.py 保持一致）
SECRET_ID  = "AKIDgUBgy3uZ3KOGwPfhCcs0xkLrEUaWJ5mM"
SECRET_KEY = "ZCnLtKaqxvhFAtSoywl1EIBtPkuseKo6"
REGION     = "ap-guangzhou"
BUCKET     = "portfolio-images-1438664071"
LOCAL_IMG  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "img")
COS_PREFIX = "portfolio/"

try:
    from qcloud_cos import CosConfig, CosS3Client
except ImportError:
    print("缺少 cos-python-sdk-v5，请先安装：")
    print("  py -m pip install cos-python-sdk-v5")
    sys.exit(1)


def build_client():
    cfg = CosConfig(Region=REGION, SecretId=SECRET_ID, SecretKey=SECRET_KEY, Scheme="https")
    return CosS3Client(cfg)


def list_cos_objects(client, prefix):
    """返回 {cos_key: etag}"""
    result = {}
    marker = ""
    while True:
        resp = client.list_objects(Bucket=BUCKET, Prefix=prefix, Marker=marker, MaxKeys=1000)
        for obj in resp.get("Contents", []):
            result[obj["Key"]] = obj["ETag"].strip('"')
        if resp.get("IsTruncated") == "true":
            marker = resp.get("NextMarker", "")
        else:
            break
    return result


def download_one(client, cos_key, local_path):
    """下载单个文件，返回 True/False"""
    try:
        client.download_file(Bucket=BUCKET, Key=cos_key, DestFilePath=local_path)
        return True
    except Exception as e:
        print(f"  下载失败 {os.path.basename(local_path)}: {e}")
        return False


def main():
    dry_run = "--dry-run" in sys.argv
    download_all = "--all" in sys.argv

    if not os.path.isdir(LOCAL_IMG):
        os.makedirs(LOCAL_IMG, exist_ok=True)

    client = build_client()

    print("正在获取 COS 文件列表...")
    cos_map = list_cos_objects(client, COS_PREFIX)
    print(f"COS 上共有: {len(cos_map)} 个文件\n")

    if not cos_map:
        print("COS 上 portfolio/ 目录为空，没有图片可下载")
        return

    # 本地已有文件
    local_existing = set(os.listdir(LOCAL_IMG))

    to_download = []
    for cos_key in cos_map:
        fname = cos_key.replace(COS_PREFIX, "")
        if not fname:
            continue
        local_path = os.path.join(LOCAL_IMG, fname)
        if download_all or fname not in local_existing:
            to_download.append((cos_key, fname, local_path))

    if dry_run:
        print(f"干跑模式: 需下载 {len(to_download)} 个文件")
        for _, fname, _ in to_download:
            print(f"  - {fname}")
        return

    if not to_download:
        print("所有图片已在本地，无需下载")
        return

    print(f"开始下载 {len(to_download)} 个文件...\n")
    ok = 0
    for cos_key, fname, local_path in to_download:
        print(f"  下载: {fname} ...", end=" ")
        if download_one(client, cos_key, local_path):
            ok += 1
            print("OK")
        else:
            print("FAIL")

    print(f"\n完成! 成功 {ok}/{len(to_download)}")


if __name__ == "__main__":
    main()
