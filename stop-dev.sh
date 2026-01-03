#!/bin/bash

echo "========================================"
echo "  Arrêt des serveurs OptiSaaS"
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

# Fonction pour tuer un processus sur un port
kill_port() {
    local port=$1
    echo "🔍 Arrêt du service sur le Port $port..."
    if [ "$OS_TYPE" == "windows" ]; then
        # Windows
        local pid=$(netstat -ano | grep ":$port" | grep "LISTENING" | awk '{print $5}' | head -n 1)
        if [ ! -z "$pid" ]; then
            taskkill -F -PID $pid 2>/dev/null
            echo "   ✅ Port $port libéré"
        else
            echo "   ℹ️  Port $port déjà libre"
        fi
    else
        # Linux / MacOS
        if lsof -ti :$port > /dev/null 2>&1; then
            lsof -ti :$port | xargs kill -9 2>/dev/null
            echo "   ✅ Port $port libéré"
        else
            echo "   ℹ️  Port $port déjà libre"
        fi
    fi
}

kill_port 4200
kill_port 3000
kill_port 5555

echo ""
echo "========================================"
echo "  ✅ Tous les serveurs ont été arrêtés"
echo "========================================"
echo ""

