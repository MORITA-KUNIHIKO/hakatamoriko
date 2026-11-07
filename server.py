"""わたしのタスク管理を http://127.0.0.1:8000/ で動かすサーバー

ブラウザが古いファイルを使い回さないように、毎回最新のファイルを返す。
"""
import functools
import http.server
import os

PORT = 8000
FOLDER = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    handler = functools.partial(NoCacheHandler, directory=FOLDER)
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler) as server:
        print(f"http://127.0.0.1:{PORT}/ で動いています（止めるときはこの画面を閉じる）", flush=True)
        server.serve_forever()
