#!/bin/bash

echo "========================================"
echo "  Démarrage des serveurs OptiSaaS"
echo "========================================"
echo ""

# 1. Démarrer PostgreSQL
echo "1️⃣  Démarrage de PostgreSQL..."
if lsof -i :5432 > /dev/null 2>&1; then
    echo "   ✅ PostgreSQL est déjà en cours d'exécution"
else
    echo "   🚀 Démarrage de PostgreSQL..."
    brew services start postgresql@15
    echo "   ⏳ Attente de PostgreSQL (5 secondes)..."
    sleep 5

    if lsof -i :5432 > /dev/null 2>&1; then
        echo "   ✅ PostgreSQL démarré avec succès"
    else
        echo "   ❌ Erreur : PostgreSQL n'a pas pu démarrer"
        exit 1
    fi
fi
echo ""

# 2. Démarrer le Backend
echo "2️⃣  Démarrage du Backend (Port 3000)..."
cd /Applications/MAMP/htdocs/Workspace/optisass-angular/backend

# Arrêter le processus existant sur le port 3000 si présent
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
sleep 1

# Démarrer en arrière-plan dans un nouveau terminal
osascript -e 'tell application "Terminal" to do script "cd /Applications/MAMP/htdocs/Workspace/optisass-angular/backend && npm run start:dev"'
echo "   ✅ Backend démarré dans une nouvelle fenêtre Terminal"
echo "   ⏳ Attente du démarrage NestJS (10 secondes)..."
sleep 10

# Vérifier que le backend est bien démarré
if lsof -i :3000 > /dev/null 2>&1; then
    echo "   ✅ Backend actif sur http://localhost:3000"
else
    echo "   ⚠️  Le backend n'a pas démarré. Vérifiez la fenêtre Terminal pour les erreurs."
fi
echo ""

# 3. Démarrer le Frontend
echo "3️⃣  Démarrage du Frontend (Port 4200)..."
cd /Applications/MAMP/htdocs/Workspace/optisass-angular/frontend

# Arrêter le processus existant sur le port 4200 si présent
lsof -ti :4200 | xargs kill -9 2>/dev/null || true
sleep 1

# Démarrer en arrière-plan dans un nouveau terminal
osascript -e 'tell application "Terminal" to do script "cd /Applications/MAMP/htdocs/Workspace/optisass-angular/frontend && npm start"'
echo "   ✅ Frontend démarré dans une nouvelle fenêtre Terminal"
echo "   ⏳ Attente de la compilation Angular (15 secondes)..."
sleep 15

# Vérifier que le frontend est bien démarré
if lsof -i :4200 > /dev/null 2>&1; then
    echo "   ✅ Frontend actif sur http://localhost:4200"
else
    echo "   ⚠️  Le frontend n'a pas démarré. Vérifiez la fenêtre Terminal pour les erreurs."
fi
echo ""

# 4. Démarrer Prisma Studio
echo "4️⃣  Démarrage de Prisma Studio (Port 5555)..."
cd /Applications/MAMP/htdocs/Workspace/optisass-angular/backend

# Arrêter le processus existant sur le port 5555 si présent
lsof -ti :5555 | xargs kill -9 2>/dev/null || true
sleep 1

# Démarrer en arrière-plan dans un nouveau terminal
osascript -e 'tell application "Terminal" to do script "cd /Applications/MAMP/htdocs/Workspace/optisass-angular/backend && npx prisma studio"'
echo "   ✅ Prisma Studio démarré dans une nouvelle fenêtre Terminal"

echo ""
echo "========================================"
echo "  ✅ Tous les serveurs sont démarrés"
echo "========================================"
echo ""
echo "📊 Services actifs :"
echo "   💾 PostgreSQL    : Port 5432"
echo "   🔧 Backend       : http://localhost:3000/api"
echo "   📱 Frontend      : http://localhost:4200"
echo "   🗄️  Prisma Studio : http://localhost:5555"
echo ""
echo "✅ Trois nouvelles fenêtres Terminal ont été ouvertes :"
echo "   - Terminal 1 : Backend NestJS"
echo "   - Terminal 2 : Frontend Angular"
echo "   - Terminal 3 : Prisma Studio"
echo ""
echo "⚠️  Si le frontend ne fonctionne pas immédiatement :"
echo "   - Attendez 30 secondes supplémentaires (compilation Angular)"
echo "   - Vérifiez la fenêtre Terminal du frontend pour les erreurs"
echo "   - Rafraîchissez la page dans votre navigateur"
echo ""
echo "🌐 Ensuite, ouvrez votre navigateur à : http://localhost:4200"
echo ""
echo "💡 Pour arrêter tous les serveurs : ./stop-dev.sh"
echo ""

