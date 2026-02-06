@echo off
setlocal
title Prepare Clean Portable Package
color 0E

echo ========================================================
echo       OptiSaaS Clean Portable Package Creator
echo ========================================================
echo.
echo [WARNING] This script will WIPE all your transactional data 
echo (Clients, Invoices, Stock Movements, Expenses) 
echo only on this machine before creating the package.
echo.
set /p confirm="Are you sure you want to proceed? (Y/N): "
if /i "%confirm%" neq "Y" goto :cancel

echo.
echo [1/2] Cleaning Database Transactions...
docker exec -i optisaas-db psql -U postgres -d optisaas < CLEAN_TRANSACTIONS.sql
if %ERRORLEVEL% neq 0 (
    echo [ERROR] SQL Cleanup failed.
    pause
    exit /b
)
echo Database cleaned successfully.

echo.
echo [2/2] Creating Portable Package...
call CREATE_PORTABLE_PACKAGE.bat

echo.
echo ========================================================
echo   CLEAN PORTABLE PACKAGE READY!
echo   --------------------------------------------------
echo   Location: .\portable_package
echo ========================================================
echo.
pause
goto :eof

:cancel
echo.
echo Operation cancelled.
pause
