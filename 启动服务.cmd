@echo off
chcp 65001 >nul
title 现代投资合并报表原型 - 本地服务
cd /d "%~dp0"
echo ==============================================================
echo   现代投资股份有限公司 - 合并报表系统（框架原型）
echo ==============================================================
echo.
echo   本机访问 : http://127.0.0.1:8777/
echo   局域网   : http://172.18.4.100:8777/
echo.
echo   关闭本窗口即停止服务。
echo.
set PY=C:\Users\Zhang\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe
if not exist "%PY%" set PY=python
"%PY%" -m http.server 8777 --bind 0.0.0.0
pause
