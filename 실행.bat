@echo off
chcp 65001 > nul
title Stock AI Portal (Nuxt 4 Architecture)
echo ===================================================
echo   LS증권 API & Anthropic Claude AI 포털 (Nuxt 4)
echo   접속 주소: http://localhost:3000
echo ===================================================
echo.
echo [1/2] Nuxt 4 주식 AI 포털 서버를 시작합니다... (Port: 3000)
start "Stock AI Nuxt Server" /min npm run dev
timeout /t 3 /nobreak > nul

echo [2/2] 브라우저에서 AI 포털 대시보드를 엽니다...
start http://localhost:3000
