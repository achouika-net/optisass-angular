#!/bin/bash
set -e

# Load environment (crucial if using NVM)
[ -f ~/.bashrc ] && . ~/.bashrc
[ -f ~/.nvm/nvm.sh ] && . ~/.nvm/nvm.sh

echo "--- DEPLOYMENT START ---"

# Target directory
TARGET_DIR="/home/ubuntu/projects/optisaas-prod-optimized"
mkdir -p "$TARGET_DIR"

# Unzip the lite backend
unzip -o /home/ubuntu/project_optimized.zip -d "$TARGET_DIR"
cd "$TARGET_DIR"

# Find Node/NPM/PM2 paths if they are not in PATH
NPM_CMD=$(which npm || find /home/ubuntu -name npm -type f | head -n 1)
PM2_CMD=$(which pm2 || find /home/ubuntu -name pm2 -type f | head -n 1)

echo "Using NPM: $NPM_CMD"
echo "Using PM2: $PM2_CMD"

# Install dependencies (fast)
"$NPM_CMD" install

# Build the project
"$NPM_CMD" run build

# Apply the database indexes (Prisma)
"$NPM_CMD" run prisma:push || npx prisma db push --accept-data-loss

# Stop the old process (if possible) and start the new one
# We'll name the new process 'optisaas-backend-optimized'
# and ensure it runs on port 3000 (set in .env)
"$PM2_CMD" delete optisaas-backend-demo || true
"$PM2_CMD" start dist/main.js --name "optisaas-backend-demo" --env production

echo "--- DEPLOYMENT FINISHED ---"
