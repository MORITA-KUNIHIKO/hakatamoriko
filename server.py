"""わたしのタスク管理を http://127.0.0.1:8000/ で動かすサーバー

ブラウザが古いファイルを使い回さないように、毎回最新のファイルを返す。
"""
import functools
import http.server
import os
import sys

PORT = 8000
FOLDER = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format, *args):
        # 画面なし（パソコン起動時の自動起動）で動いているときは記録を出さない
        if sys.stderr is not None:
            super().log_message(format, *args)


if __name__ == "__main__":
    handler = functools.partial(NoCacheHandler, directory=FOLDER)
    # Windows では、これが True だと同じ番号で2つ目のサーバーが起動できてしまう
    http.server.ThreadingHTTPServer.allow_reuse_address = False
    try:
        server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    except OSError:
        # すでに別のサーバーが動いている
        sys.exit(0)
    with server:
        if sys.stdout is not None:
            print(f"http://127.0.0.1:{PORT}/ で動いています（止めるときはこの画面を閉じる）", flush=True)
        server.serve_forever()
