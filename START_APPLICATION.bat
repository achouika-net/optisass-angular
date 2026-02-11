@echo off
setlocal
title OptiSaas Launcher
color 0A

echo ========================================================
echo                 OptiSaas Application Launcher
echo ========================================================
echo.

:: Check Backend dependencies
if not exist "backend\node_modules" (
    color 0C
    echo [ERROR] Backend node_modules not found!
    echo Please run 'npm install' in the backend directory first.
    echo.
    pause
    exit /b
)

:: Check Frontend dependencies
if not exist "frontend\node_modules" (
    color 0C
    echo [ERROR] Frontend node_modules not found!
    echo Please run 'npm install' in the frontend directory first.
    echo.
    pause
    exit /b
)

echo [INFO] Synchronizing Database...
cd backend
call npx prisma db push --accept-data-loss
call npx prisma generate
cd ..

echo [INFO] Starting Backend Server (NestJS)...
start "OptiSaas Backend" cmd /k "cd backend && npm run start:dev"

echo [INFO] Waiting 5 seconds for backend to initialize...
timeout /t 5 /nobreak >nul

echo [INFO] Starting Frontend Server (Angular)...
start "OptiSaas Frontend" cmd /k "cd frontend && npm start"

echo.
echo ========================================================
echo   Application started successfully!
echo   --------------------------------------------------
echo   Backend API:  http://localhost:3000
echo   Frontend UI:  http://localhost:4200
echo ========================================================
echo.
echo You can safely close this launcher window, the servers will stay running.
pause
