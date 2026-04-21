#!/bin/bash

# 🧪 VALIDATION SCRIPT - Virtual Try-On Feature
# Quick local validation without Docker
# Usage: bash scripts/validate-essayage-virtuel.sh

set -e

echo "🚀 OPTISAAS - Virtual Try-On Feature Validation"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counter
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $2"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}: $2"
        ((TESTS_FAILED++))
    fi
}

# 1. CHECK BRANCH
echo -e "${BLUE}[1/8] Checking Git branch...${NC}"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" = "feature/essayage-virtuel" ]; then
    test_result 0 "On correct branch: $BRANCH"
else
    test_result 1 "Expected branch: feature/essayage-virtuel, Got: $BRANCH"
fi
echo ""

# 2. CHECK BACKEND FILES
echo -e "${BLUE}[2/8] Checking backend virtual-tryon files...${NC}"
BACKEND_FILES=(
    "backend/src/features/virtual-tryon/virtual-tryon.controller.ts"
    "backend/src/features/virtual-tryon/virtual-tryon.service.ts"
    "backend/src/features/virtual-tryon/virtual-tryon.module.ts"
    "backend/src/features/virtual-tryon/dto/create-virtual-tryon.dto.ts"
)

for file in "${BACKEND_FILES[@]}"; do
    if [ -f "$file" ]; then
        test_result 0 "File exists: $file"
    else
        test_result 1 "File missing: $file"
    fi
done
echo ""

# 3. CHECK DATABASE MIGRATIONS
echo -e "${BLUE}[3/8] Checking database migrations...${NC}"
if [ -f "backend/prisma/migrations/20260420_add_virtual_tryon/migration.sql" ]; then
    test_result 0 "Migration file exists"
    MIGRATION_LINES=$(wc -l < "backend/prisma/migrations/20260420_add_virtual_tryon/migration.sql")
    echo -e "  📊 Migration size: $MIGRATION_LINES lines"
else
    test_result 1 "Migration file not found"
fi
echo ""

# 4. CHECK PRISMA SCHEMA
echo -e "${BLUE}[4/8] Checking Prisma schema...${NC}"
if grep -q "model VirtualTryon" backend/prisma/schema.prisma; then
    test_result 0 "VirtualTryon model defined in schema"
    FIELDS=$(grep -A 20 "model VirtualTryon" backend/prisma/schema.prisma | grep "@" | wc -l)
    echo -e "  📊 Model fields: $FIELDS"
else
    test_result 1 "VirtualTryon model not found in schema"
fi
echo ""

# 5. CHECK FRONTEND FILES
echo -e "${BLUE}[5/8] Checking frontend components...${NC}"
FRONTEND_FILES=(
    "frontend/src/app/features/virtual-tryon/virtual-tryon.component.ts"
    "frontend/src/app/features/virtual-tryon/virtual-tryon.component.html"
    "frontend/src/app/features/virtual-tryon/virtual-mirror/virtual-mirror.component.ts"
)

FRONTEND_EXISTS=true
for file in "${FRONTEND_FILES[@]}"; do
    if [ -f "$file" ]; then
        test_result 0 "File exists: $file"
    else
        if [ "$file" != "frontend/src/app/features/virtual-tryon/virtual-mirror/virtual-mirror.component.ts" ]; then
            FRONTEND_EXISTS=false
        fi
        test_result 1 "File missing: $file"
    fi
done
echo ""

# 6. CHECK DOCKER FILES
echo -e "${BLUE}[6/8] Checking Docker configuration...${NC}"
DOCKER_FILES=(
    "docker-compose.staging.yml"
    "backend/Dockerfile.staging"
    "frontend/Dockerfile.staging"
)

for file in "${DOCKER_FILES[@]}"; do
    if [ -f "$file" ]; then
        test_result 0 "Docker config exists: $file"
    else
        test_result 1 "Docker config missing: $file"
    fi
done
echo ""

# 7. CHECK ENVIRONMENT CONFIG
echo -e "${BLUE}[7/8] Checking environment configuration...${NC}"
if [ -f ".env.staging" ]; then
    test_result 0 ".env.staging exists"
    ENV_VARS=$(grep -c "^[^#]" .env.staging)
    echo -e "  📊 Environment variables: $ENV_VARS"
else
    test_result 1 ".env.staging not found"
fi
echo ""

# 8. CHECK BUILD ARTIFACTS
echo -e "${BLUE}[8/8] Checking TypeScript build...${NC}"
if [ -d "backend/dist" ] && [ "$(ls -1 backend/dist | wc -l)" -gt 0 ]; then
    test_result 0 "Backend dist folder exists"
    DIST_FILES=$(find backend/dist -type f | wc -l)
    echo -e "  📊 Compiled files: $DIST_FILES"
else
    test_result 1 "Backend dist folder not found or empty"
fi
echo ""

# SUMMARY
echo "=============================================="
echo -e "${BLUE}📊 VALIDATION SUMMARY${NC}"
echo "=============================================="
echo -e "✅ Tests Passed:  ${GREEN}$TESTS_PASSED${NC}"
echo -e "❌ Tests Failed:  ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 ALL VALIDATIONS PASSED!${NC}"
    echo -e "✅ Feature branch is ready for deployment"
    exit 0
else
    echo ""
    echo -e "${RED}⚠️  SOME VALIDATIONS FAILED${NC}"
    echo -e "Please review the failures above"
    exit 1
fi
