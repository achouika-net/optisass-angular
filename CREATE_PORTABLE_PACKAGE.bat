@echo off
setlocal
title Creating OptiSaaS Portable Package
color 0B

echo ========================================================
echo       OptiSaaS Portable Package Creator
echo ========================================================
echo.

:: Create export directory
if not exist "portable_package" mkdir "portable_package"
if not exist "portable_package\images" mkdir "portable_package\images"

echo [1/4] Exporting Database Content...
call docker-db-export.bat
copy dump.sql portable_package\portable_db_init.sql > nul

echo [2/4] Building Production Docker Images...
docker-compose -f docker-compose.portable.yml build

echo [3/4] Saving Docker Images to Tarballs (A bit long)...
echo Saving DB image...
docker save -o portable_package\images\db.tar postgres:15-alpine
echo Saving Backend image...
docker save -o portable_package\images\backend.tar optisaas-backend
echo Saving Frontend image...
docker save -o portable_package\images\frontend.tar optisaas-frontend
echo Saving n8n image...
docker save -o portable_package\images\n8n.tar n8nio/n8n:alpine

echo [4/4] Copying Control Files and n8n Data...
copy docker-compose.portable.yml portable_package\docker-compose.yml > nul
if exist "n8n-local\n8n" xcopy /E /I /Y "n8n-local\n8n" "portable_package\n8n-data" > nul

:: Generate Installation Script
echo @echo off > portable_package\INSTALL_ON_NEW_PC.bat
echo echo Importing OptiSaaS Docker Images... >> portable_package\INSTALL_ON_NEW_PC.bat
echo docker load -i images\db.tar >> portable_package\INSTALL_ON_NEW_PC.bat
echo docker load -i images\backend.tar >> portable_package\INSTALL_ON_NEW_PC.bat
echo docker load -i images\frontend.tar >> portable_package\INSTALL_ON_NEW_PC.bat
echo docker load -i images\n8n.tar >> portable_package\INSTALL_ON_NEW_PC.bat
echo echo Done! You can now start the app with: docker-compose up -d >> portable_package\INSTALL_ON_NEW_PC.bat
echo pause >> portable_package\INSTALL_ON_NEW_PC.bat

echo.
echo ========================================================
echo   PORTABLE PACKAGE CREATED SUCCESSFULLY!
echo   --------------------------------------------------
echo   Location: .\portable_package
echo   Instructions:
echo   1. Copy the 'portable_package' folder to the new PC.
echo   2. Run 'INSTALL_ON_NEW_PC.bat'.
echo   3. Run 'docker-compose up -d'.
echo ========================================================
echo.
pause
