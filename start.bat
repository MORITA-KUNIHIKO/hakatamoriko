@echo off
chcp 65001 >nul
rem わたしのタスク管理を起動する（このファイルをダブルクリック）
cd /d "%~dp0"

rem すでにサーバーが動いていれば、ブラウザで開くだけ
powershell -NoProfile -Command "try { Invoke-WebRequest http://127.0.0.1:8000/ -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if %errorlevel%==0 (
  start "" http://127.0.0.1:8000/
  exit /b
)

start "" http://127.0.0.1:8000/
echo わたしのタスク管理を動かしています。この画面を閉じるとアプリも止まります。
python -m http.server 8000 --bind 127.0.0.1
