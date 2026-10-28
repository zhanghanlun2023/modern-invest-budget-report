@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==============================================================
echo   现代投资股份有限公司 - 合并报表系统（框架原型 v0.1）
echo ==============================================================
echo.
where python >nul 2>nul
if errorlevel 1 goto nopython
echo 已检测到 Python，启动本地服务： http://127.0.0.1:8777/
echo 关闭本窗口即停止服务。
echo.
start "" http://127.0.0.1:8777/
python -m http.server 8777
goto :eof

:nopython
echo 未检测到 Python。
echo 本原型是纯静态页面（零依赖、零联网），可直接双击 index.html 打开。
echo.
start "" "index.html"
pause
