#!/bin/bash

echo "========================================"
echo "  État des serveurs OptiSaaS"
echo "========================================"
echo ""

# PostgreSQL
echo "1️⃣  PostgreSQL (Port 5432):"
if lsof -i :5432 > /dev/null 2>&1; then
    echo "   ✅ En cours d'exécution"
    echo "   🌐 Accessible sur localhost:5432"
else
    echo "   ❌ Arrêté"
    echo "   💡 Démarrer avec: brew services start postgresql@15"
fi
echo ""

# Backend
echo "2️⃣  Backend NestJS (Port 3000):"
if lsof -i :3000 > /dev/null 2>&1; then
    echo "   ✅ En cours d'exécution"
    echo "   🌐 http://localhost:3000/api"
else
    echo "   ❌ Arrêté"
    echo "   💡 Démarrer avec: ./start-dev.sh"
fi
echo ""

# Frontend
echo "3️⃣  Frontend Angular (Port 4200):"
if lsof -i :4200 > /dev/null 2>&1; then
    echo "   ✅ En cours d'exécution"
    echo "   🌐 http://localhost:4200"
else
    echo "   ❌ Arrêté"
    echo "   💡 Démarrer avec: ./start-dev.sh"
fi
echo ""

# Prisma Studio
echo "4️⃣  Prisma Studio (Port 5555):"
if lsof -i :5555 > /dev/null 2>&1; then
    echo "   ✅ En cours d'exécution"
    echo "   🌐 http://localhost:5555"
else
    echo "   ⚪ Arrêté (optionnel)"
    echo "   💡 Démarrer avec: cd backend && npx prisma studio"
fi
echo ""

echo "========================================"
echo "  Commandes disponibles"
echo "========================================"
echo "  ./start-dev.sh  → Démarrer tous les serveurs"
echo "  ./stop-dev.sh   → Arrêter tous les serveurs"
echo "  ./status.sh     → Voir cet état"
echo "========================================"
echo ""

