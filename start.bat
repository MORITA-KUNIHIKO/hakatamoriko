@echo off
rem mytool: double-click to start the app (http://127.0.0.1:8000/)
cd /d "%~dp0"

rem If the server is already running, just open the browser
powershell -NoProfile -Command "try { Invoke-WebRequest http://127.0.0.1:8000/ -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if not errorlevel 1 (
  start "" http://127.0.0.1:8000/
  exit /b
)

rem Open the browser after the server has started
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep 2; Start-Process 'http://127.0.0.1:8000/'"
echo The app is running at http://127.0.0.1:8000/
echo Closing this window stops the app.
python server.py
pause
