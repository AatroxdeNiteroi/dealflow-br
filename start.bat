@echo off
REM ============================================================
REM  DealFlow BR — sobe backend + frontend em janelas separadas
REM  Uso: duplo-clique neste arquivo, ou no terminal:  .\start.bat
REM ============================================================

echo.
echo ================================================================
echo  DealFlow BR — iniciando backend + frontend
echo ================================================================
echo.
echo Vou abrir 2 janelas:
echo   1. Backend FastAPI  (porta 8000)  — fornece os dados
echo   2. Frontend Vite    (porta 5173)  — desenha a UI
echo.
echo Aguarde 5-10 segundos. Quando ambas as janelas mostrarem
echo "ready" / "Application startup complete", abra:
echo.
echo     http://localhost:5173
echo.
echo Para parar tudo, feche as duas janelas que foram abertas.
echo ================================================================
echo.

start "DealFlow · BACKEND (porta 8000)" cmd /K "cd /D %~dp0backend && uv run uvicorn dealflow_api.main:app --reload --port 8000"

REM espera 2 segundos pra backend começar a inicializar antes de subir o frontend
timeout /t 2 /nobreak >nul

start "DealFlow · FRONTEND (porta 5173)" cmd /K "cd /D %~dp0frontend && npm run dev"

echo.
echo As duas janelas foram abertas. Aguarde inicializacao e abra http://localhost:5173
echo.
pause
