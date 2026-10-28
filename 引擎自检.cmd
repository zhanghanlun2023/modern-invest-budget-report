@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==============================================================
echo   合并报表引擎自检（单户 / 汇总 / 合并抵销 勾稽校验）
echo ==============================================================
echo.
set NODE=node
where node >nul 2>nul
if errorlevel 1 set NODE="%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
%NODE% "tools\smoke.js"
echo.
pause
