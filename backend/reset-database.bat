@echo off
REM ============================================
REM Script de Réinitialisation de la Base de Données
REM ============================================
REM Ce script supprime toutes les données transactionnelles
REM tout en préservant la configuration (centres, entrepôts, utilisateurs)
REM ============================================

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║   REINITIALISATION DE LA BASE DE DONNEES                  ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo ⚠️  ATTENTION: Cette action est IRREVERSIBLE!
echo.
echo Ce script va supprimer:
echo   - Tous les clients
echo   - Toutes les fiches medicales
echo   - Toutes les factures et paiements
echo   - Toutes les depenses
echo   - Tous les produits et mouvements de stock
echo.
echo Ce script va PRESERVER:
echo   - Groupes, Centres, Entrepots
echo   - Utilisateurs
echo   - Fournisseurs
echo   - Configuration Finance et Loyalty
echo.
echo ════════════════════════════════════════════════════════════
echo.

set /p CONFIRM="Voulez-vous continuer? (tapez OUI en majuscules): "

if NOT "%CONFIRM%"=="OUI" (
    echo.
    echo ❌ Operation annulee.
    echo.
    pause
    exit /b 0
)

echo.
echo ════════════════════════════════════════════════════════════
echo 🚀 Lancement de la reinitialisation...
echo ════════════════════════════════════════════════════════════
echo.

cd /d "%~dp0"

node reset-database.js

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ════════════════════════════════════════════════════════════
    echo ✅ Reinitialisation terminee avec succes!
    echo ════════════════════════════════════════════════════════════
    echo.
    echo 💡 Vous pouvez maintenant tester le processus finance depuis zero.
    echo.
) else (
    echo.
    echo ════════════════════════════════════════════════════════════
    echo ❌ Erreur lors de la reinitialisation!
    echo ════════════════════════════════════════════════════════════
    echo.
    echo Verifiez les logs ci-dessus pour plus de details.
    echo.
)

pause
