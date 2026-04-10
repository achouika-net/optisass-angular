#!/bin/bash
set -e

BIN_PATH="/home/ubuntu/.nvm/versions/node/v22.21.1/bin"
PROJ_DIR="/home/ubuntu/optisaas_prod_optimized_v3"
ZIP_FILE="/home/ubuntu/backend_dist_only.zip"
PASS="OptiSaas_Secure_!2026"

echo "--- CLEANING DIRECTORY ---"
echo "$PASS" | sudo -S rm -rf "$PROJ_DIR"
mkdir -p "$PROJ_DIR"

echo "--- EXTRACTING BUILD ---"
unzip -o "$ZIP_FILE" -d "$PROJ_DIR"

echo "--- SETTING PERMISSIONS ---"
echo "$PASS" | sudo -S chown -R ubuntu:ubuntu "$PROJ_DIR"
echo "$PASS" | sudo -S chmod -R 755 "$PROJ_DIR"

echo "--- INSTALLING DEPENDENCIES ---"
cd "$PROJ_DIR"
"$BIN_PATH/npm" install

echo "--- APPLYING DATABASE CHANGES ---"
"$BIN_PATH/node" "$BIN_PATH/npx" prisma db push --accept-data-loss

echo "--- RESTARTING SERVICE ---"
"$BIN_PATH/pm2" delete optisaas-backend-demo || true
"$BIN_PATH/pm2" start "$PROJ_DIR/dist/src/main.js" --name "optisaas-backend-demo" --cwd "$PROJ_DIR" --env production

echo "--- DEPLOYMENT FINISHED ---"
