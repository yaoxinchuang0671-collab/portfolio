#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Portfolio local dev server — lightweight static server."""

import json
import os
import sys
import time
import base64
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

# Ensure our venv packages are importable
VENV_SITE = r"C:\ProgramData\WorkBuddy\chromium-env\1tfn88x\.workbuddy\binaries\python\envs\portfolio\Lib\site-packages"
if VENV_SITE not in sys.path:
    sys.path.insert(0, VENV_SITE)

PORT = int(os.environ.get("PORT", "8080"))
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        # --- /save-ledger ---
        if self.path == "/save-ledger":
            try:
                data = json.loads(body.decode("utf-8"))
                filepath = os.path.join(ROOT, "ledger_data.json")
                with open(filepath, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))
                print(f"[save-ledger] 成功写入 {filepath}")
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))
                print(f"[save-ledger] 写入失败: {e}")
            return

        # --- /save-file ---
        if self.path == "/save-file":
            try:
                data = json.loads(body.decode("utf-8"))
                filename = data.get("filename", "")
                filedata = data.get("data", "")

                if not filename or not filedata:
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"ok": False, "error": "Missing filename or data"}).encode("utf-8"))
                    return

                if filename.startswith("img/"):
                    filepath = os.path.join(ROOT, filename)
                else:
                    self.send_response(403)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"ok": False, "error": "Only img/ directory allowed"}).encode("utf-8"))
                    return

                os.makedirs(os.path.dirname(filepath), exist_ok=True)
                binary_data = base64.b64decode(filedata)
                with open(filepath, "wb") as f:
                    f.write(binary_data)

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "path": filename}).encode("utf-8"))
                print(f"[save-file] 成功写入 {filepath} ({len(binary_data)} bytes)")
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))
                print(f"[save-file] 写入失败: {e}")
            return

        self.send_response(404)
        self.end_headers()
        self.wfile.write(b"Not Found")


if __name__ == "__main__":
    os.chdir(ROOT)
    server = ThreadingHTTPServer(("", PORT), Handler)
    print(f"Server running at http://localhost:{PORT}/")
    print(f"Root: {ROOT}")
    print("Press Ctrl+C to stop")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()
