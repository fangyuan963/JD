@echo off
echo ========================================
echo 岗位JD解读工具 - 启动服务
echo ========================================
echo.

REM 检查Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到Node.js！
    echo.
    echo 请先安装Node.js：https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js已安装

REM 检查依赖
if not exist "node_modules" (
    echo.
    echo 📦 正在安装依赖...
    npm install
    if errorlevel 1 (
        echo ❌ 安装失败！
        pause
        exit /b 1
    )
)

echo ✅ 依赖已安装

REM 检查API密钥
findstr /C:"your_deepseek_api_key_here" ".env" >nul
if not errorlevel 1 (
    echo.
    echo ⚠️  API密钥未配置！
    echo.
    echo 请编辑 .env 文件，将
    echo DEEPSEEK_API_KEY=your_deepseek_api_key_here
    echo 改为你的真实API密钥
    echo.
    echo 获取API密钥：https://platform.deepseek.com/
    echo.
    notepad .env
    pause
    exit /b 1
)

echo ✅ API密钥已配置
echo.
echo 🚀 正在启动服务...
echo.
echo 启动成功后，请打开浏览器访问：
echo http://localhost:3000/health
echo.
echo 然后打开 jd-analyzer.html 使用工具
echo.
echo ========================================
echo.

start "" "jd-analyzer.html"
node server.js

pause