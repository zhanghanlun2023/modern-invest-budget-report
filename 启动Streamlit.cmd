@echo off
chcp 65001 >nul
title 现代投资 · 合并预算报表系统（Streamlit）
cd /d "%~dp0"

echo ==============================================================
echo   现代投资股份有限公司 - 合并预算报表系统
echo ==============================================================
echo.
echo   本机访问 : http://127.0.0.1:8501/
echo   局域网   : http://172.18.4.100:8501/
echo.
echo   公网共享时，把 8501 端口映射出去即可（见 README-部署.md）
echo   关闭本窗口即停止服务。
echo.

set PY=C:\Users\Zhang\AppData\Local\Programs\Python\Python313\python.exe
if not exist "%PY%" set PY=python

"%PY%" -m streamlit run asgi_app.py --server.port 8501 --server.address 0.0.0.0 --server.headless true --browser.gatherUsageStats false
pause
