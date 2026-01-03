#!/bin/bash

# Configuration des chemins
ROOT_DIR=$(cd "$(dirname "$0")" && pwd)
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo "========================================"
echo "  Démarrage des serveurs OptiSaaS"
echo "========================================"
echo ""

# Détection de l'OS
OS_TYPE="unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS_TYPE="macos"
elif [[ "$OS" == "Windows_NT" ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    OS_TYPE="windows"
else
    OS_TYPE="linux"
fi

echo "💻 Système détecté : $OS_TYPE"

# 1. Vérification des dépendances
echo "1️⃣  Vérification de l'environnement..."
if [ ! -d "$BACKEND_DIR/node_modules" ]; then
    echo "   ⚠️  node_modules manquant dans le backend. Installation..."
    cd "$BACKEND_DIR" && npm install
    cd "$ROOT_DIR"
fi

# 2. Synchronisation Prisma
echo "2️⃣  Génération du client Prisma..."
cd "$BACKEND_DIR"
npx prisma generate
cd "$ROOT_DIR"

# 3. Vérifier si les ports sont occupés
echo "3️⃣  Libération des ports..."

kill_port() {
    local port=$1
    if [ "$OS_TYPE" == "windows" ]; then
        local pid=$(netstat -ano | grep ":$port" | grep "LISTENING" | awk '{print $5}' | head -n 1)
        if [ ! -z "$pid" ]; then
            taskkill -F -PID $pid 2>/dev/null
        fi
    else
        if lsof -ti :$port > /dev/null 2>&1; then
            lsof -ti :$port | xargs kill -9 2>/dev/null
        fi
    fi
}

kill_port 3000
kill_port 4200
kill_port 5555

# 4. Démarrer le Backend
echo "4️⃣  Démarrage du Backend (Port 3000)..."
if [ "$OS_TYPE" == "windows" ]; then
    start cmd /k "cd backend && npm run start:dev"
elif [ "$OS_TYPE" == "macos" ]; then
    osascript -e "tell application \"Terminal\" to do script \"cd '$BACKEND_DIR' && npm run start:dev\""
else
    cd "$BACKEND_DIR" && npm run start:dev &
fi

# 5. Démarrer le Frontend
echo "5️⃣  Démarrage du Frontend (Port 4200)..."
if [ "$OS_TYPE" == "windows" ]; then
    start cmd /k "cd frontend && npm start"
elif [ "$OS_TYPE" == "macos" ]; then
    osascript -e "tell application \"Terminal\" to do script \"cd '$FRONTEND_DIR' && npm start\""
else
    cd "$FRONTEND_DIR" && npm start &
fi

# 6. Démarrer Prisma Studio
echo "6️⃣  Démarrage de Prisma Studio (Port 5555)..."
if [ "$OS_TYPE" == "windows" ]; then
    start cmd /k "cd backend && npx prisma studio"
elif [ "$OS_TYPE" == "macos" ]; then
    osascript -e "tell application \"Terminal\" to do script \"cd '$BACKEND_DIR' && npx prisma studio\""
fi

echo ""
echo "========================================"
echo "  ✅ Démarrage initié (Fenêtres séparées)"
echo "========================================"
echo ""
echo "📊 Services :"
echo "   🔧 Backend       : http://localhost:3000"
echo "   📱 Frontend      : http://localhost:4200"
echo "   🗄️  Prisma Studio : http://localhost:5555"
echo ""

