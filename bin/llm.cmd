@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "JS_FILE=%SCRIPT_DIR%..\dist\index.js"

where bun >nul 2>&1
if %errorlevel% equ 0 (
    bun "%JS_FILE%" %*
    exit /b %errorlevel%
)

where node >nul 2>&1
if %errorlevel% equ 0 (
    node "%JS_FILE%" %*
    exit /b %errorlevel%
)

where deno >nul 2>&1
if %errorlevel% equ 0 (
    deno run --allow-all "%JS_FILE%" %*
    exit /b %errorlevel%
)

echo Error: No JavaScript runtime found.
echo Please install one of: bun, node, deno
exit /b 1
