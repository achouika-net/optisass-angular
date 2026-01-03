#!/bin/bash

echo "========================================"
echo "  Démarrage des serveurs OptiSaaS"
echo "========================================"
echo ""

# 1. Vérifier si les ports sont occupés
echo "1️⃣  Vérification des ports..."

# Fonction pour tuer un processus sur un port (Windows/Bash)
kill_port() {
    local port=$1
    if [ "$OS" == "Windows_NT" ]; then
        # Windows
        local pid=$(netstat -ano | grep ":$port" | grep "LISTENING" | awk '{print $5}' | head -n 1)
        if [ ! -z "$pid" ]; then
            taskkill -F -PID $pid 2>/dev/null
        fi
    else
        # Linux / MacOS
        lsof -ti :$port | xargs kill -9 2>/dev/null || true
    fi
}

kill_port 3000
kill_port 4200
kill_port 5555

# 2. Démarrer le Backend
echo "2️⃣  Démarrage du Backend (Port 3000)..."
if [ "$OS" == "Windows_NT" ]; then
    start cmd /k "cd backend && npm run start:dev"
else
    # Linux / MacOS (Generic)
    cd backend && npm run start:dev &
    cd ..
fi

echo "   ⏳ Attente du démarrage NestJS (5 secondes)..."
sleep 5

# 3. Démarrer le Frontend
echo "3️⃣  Démarrage du Frontend (Port 4200)..."
if [ "$OS" == "Windows_NT" ]; then
    start cmd /k "cd frontend && npm start"
else
    cd frontend && npm start &
    cd ..
fi

# 4. Démarrer Prisma Studio
echo "4️⃣  Démarrage de Prisma Studio (Port 5555)..."
if [ "$OS" == "Windows_NT" ]; then
    start cmd /k "cd backend && npx prisma studio"
fi

echo ""
echo "========================================"
echo "  ✅ Tous les serveurs sont en cours de démarrage"
echo "========================================"
echo ""
echo "📊 Services :"
echo "   🔧 Backend       : http://localhost:3000"
echo "   📱 Frontend      : http://localhost:4200"
echo "   🗄️  Prisma Studio : http://localhost:5555"
echo ""
echo "💡 Pour arrêter tous les serveurs, fermez les fenêtres de commande."

