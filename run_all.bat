@echo off
echo ==============================================
echo   Starting ReelGrab Dashboard & Cloud Backend
echo ==============================================

:: Start Backend in the background
start "ReelGrab Backend (Port 8000)" cmd /c "if exist venv\Scripts\activate.bat (call venv\Scripts\activate.bat) & python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload"

:: Start Frontend in the background
start "ReelGrab Frontend (Port 9090)" cmd /c "cd frontend & python -m http.server 9090"

echo.
echo ✅ Servers are starting up!
echo.
echo  🖥️  Frontend UI: http://127.0.0.1:9090
echo  ⚙️  Backend API: http://127.0.0.1:8000
echo.
echo (Two command prompt windows just opened to run these servers. Keep them open!)
pause
