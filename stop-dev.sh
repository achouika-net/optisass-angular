#!/bin/bash

echo "========================================"
echo "  Arrêt des serveurs OptiSaaS"
echo "========================================"
echo ""

# 1. Arrêter le Frontend (port 4200)
echo "1️⃣  Arrêt du Frontend (Port 4200)..."
if lsof -ti :4200 > /dev/null 2>&1; then
    lsof -ti :4200 | xargs kill -9 2>/dev/null
    echo "   ✅ Frontend arrêté"
else
    echo "   ℹ️  Frontend n'était pas démarré"
fi
echo ""

# 2. Arrêter le Backend (port 3000)
echo "2️⃣  Arrêt du Backend (Port 3000)..."
if lsof -ti :3000 > /dev/null 2>&1; then
    lsof -ti :3000 | xargs kill -9 2>/dev/null
    echo "   ✅ Backend arrêté"
else
    echo "   ℹ️  Backend n'était pas démarré"
fi
echo ""

# 3. Arrêter Prisma Studio (port 5555)
echo "3️⃣  Arrêt de Prisma Studio (Port 5555)..."
if lsof -ti :5555 > /dev/null 2>&1; then
    lsof -ti :5555 | xargs kill -9 2>/dev/null
    echo "   ✅ Prisma Studio arrêté"
else
    echo "   ℹ️  Prisma Studio n'était pas démarré"
fi
echo ""

# 4. Arrêter PostgreSQL
echo "4️⃣  Arrêt de PostgreSQL (Port 5432)..."
if lsof -i :5432 > /dev/null 2>&1; then
    brew services stop postgresql@15
    sleep 2

    if lsof -i :5432 > /dev/null 2>&1; then
        echo "   ⚠️  PostgreSQL n'a pas pu être arrêté proprement"
        echo "   💡 Essayez : brew services stop postgresql@15"
    else
        echo "   ✅ PostgreSQL arrêté"
    fi
else
    echo "   ℹ️  PostgreSQL n'était pas démarré"
fi
echo ""

# 5. Nettoyage des processus orphelins
echo "5️⃣  Nettoyage des processus orphelins..."
pkill -f "nest start" 2>/dev/null || true
pkill -f "ng serve" 2>/dev/null || true
pkill -f "prisma studio" 2>/dev/null || true
echo "   ✅ Nettoyage terminé"
echo ""

echo "========================================"
echo "  ✅ Tous les serveurs ont été arrêtés"
echo "========================================"
echo ""
echo "Services arrêtés :"
echo "   ✓ Frontend (Port 4200)"
echo "   ✓ Backend (Port 3000)"
echo "   ✓ Prisma Studio (Port 5555)"
echo "   ✓ PostgreSQL (Port 5432)"
echo ""
echo "💡 Pour redémarrer : ./start-dev.sh"
echo ""

