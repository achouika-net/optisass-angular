#!/bin/bash
set -e

BIN_PATH="/home/ubuntu/.nvm/versions/node/v22.21.1/bin"
PROJ_DIR="/home/ubuntu/projects/optisaas-prod-optimized"

echo "--- DEPLOYMENT START ---"
cd "$PROJ_DIR"

echo "Applying database indexes..."
"$BIN_PATH/node" "$BIN_PATH/npx" prisma db push --accept-data-loss

echo "Restarting PM2 process..."
"$BIN_PATH/pm2" delete optisaas-backend-demo || true
"$BIN_PATH/pm2" start dist/src/main.js --name "optisaas-backend-demo" --env production

echo "--- DEPLOYMENT FINISHED ---"
