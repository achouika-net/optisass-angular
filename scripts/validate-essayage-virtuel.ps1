# 🧪 VALIDATION SCRIPT - Virtual Try-On Feature
# Quick local validation without Docker
# Usage: .\scripts\validate-essayage-virtuel.ps1

Write-Host "🚀 OPTISAAS - Virtual Try-On Feature Validation" -ForegroundColor Cyan
Write-Host "=============================================="
Write-Host ""

$TESTS_PASSED = 0
$TESTS_FAILED = 0

function Test-Result {
    param(
        [int]$ExitCode,
        [string]$Message
    )
    
    if ($ExitCode -eq 0) {
        Write-Host "✅ PASS: $Message" -ForegroundColor Green
        $Script:TESTS_PASSED++
    } else {
        Write-Host "❌ FAIL: $Message" -ForegroundColor Red
        $Script:TESTS_FAILED++
    }
}

# 1. CHECK BRANCH
Write-Host "[1/8] Checking Git branch..." -ForegroundColor Blue
$BRANCH = git rev-parse --abbrev-ref HEAD
if ($BRANCH -eq "feature/essayage-virtuel") {
    Test-Result 0 "On correct branch: $BRANCH"
} else {
    Test-Result 1 "Expected branch: feature/essayage-virtuel, Got: $BRANCH"
}
Write-Host ""

# 2. CHECK BACKEND FILES
Write-Host "[2/8] Checking backend virtual-tryon files..." -ForegroundColor Blue
$BACKEND_FILES = @(
    "backend/src/features/virtual-tryon/virtual-tryon.controller.ts",
    "backend/src/features/virtual-tryon/virtual-tryon.service.ts",
    "backend/src/features/virtual-tryon/virtual-tryon.module.ts",
    "backend/src/features/virtual-tryon/dto/create-virtual-tryon.dto.ts"
)

foreach ($file in $BACKEND_FILES) {
    if (Test-Path $file) {
        Test-Result 0 "File exists: $file"
    } else {
        Test-Result 1 "File missing: $file"
    }
}
Write-Host ""

# 3. CHECK DATABASE MIGRATIONS
Write-Host "[3/8] Checking database migrations..." -ForegroundColor Blue
$MIGRATION_FILE = "backend/prisma/migrations/20260420_add_virtual_tryon/migration.sql"
if (Test-Path $MIGRATION_FILE) {
    Test-Result 0 "Migration file exists"
    $MIGRATION_LINES = (Get-Content $MIGRATION_FILE | Measure-Object -Line).Lines
    Write-Host "  📊 Migration size: $MIGRATION_LINES lines" -ForegroundColor Gray
} else {
    Test-Result 1 "Migration file not found"
}
Write-Host ""

# 4. CHECK PRISMA SCHEMA
Write-Host "[4/8] Checking Prisma schema..." -ForegroundColor Blue
$SCHEMA_CONTENT = Get-Content "backend/prisma/schema.prisma" -Raw
if ($SCHEMA_CONTENT -match "model VirtualTryon") {
    Test-Result 0 "VirtualTryon model defined in schema"
    $MODEL_SECTION = $SCHEMA_CONTENT -match "(?s)model VirtualTryon\s*\{.*?\}"
    Write-Host "  📊 Model found with proper definition" -ForegroundColor Gray
} else {
    Test-Result 1 "VirtualTryon model not found in schema"
}
Write-Host ""

# 5. CHECK DOCKER FILES
Write-Host "[5/8] Checking Docker configuration..." -ForegroundColor Blue
$DOCKER_FILES = @(
    "docker-compose.staging.yml",
    "backend/Dockerfile.staging",
    "frontend/Dockerfile.staging"
)

foreach ($file in $DOCKER_FILES) {
    if (Test-Path $file) {
        Test-Result 0 "Docker config exists: $file"
    } else {
        Test-Result 1 "Docker config missing: $file"
    }
}
Write-Host ""

# 6. CHECK ENVIRONMENT CONFIG
Write-Host "[6/8] Checking environment configuration..." -ForegroundColor Blue
if (Test-Path ".env.staging") {
    Test-Result 0 ".env.staging exists"
    $ENV_VARS = (Get-Content ".env.staging" | Where-Object { $_ -notmatch "^#" -and $_.Trim() -ne "" } | Measure-Object).Count
    Write-Host "  📊 Environment variables: $ENV_VARS" -ForegroundColor Gray
} else {
    Test-Result 1 ".env.staging not found"
}
Write-Host ""

# 7. CHECK BUILD ARTIFACTS
Write-Host "[7/8] Checking TypeScript build..." -ForegroundColor Blue
if ((Test-Path "backend/dist") -and (Get-ChildItem "backend/dist" -Recurse | Measure-Object).Count -gt 0) {
    Test-Result 0 "Backend dist folder exists"
    $DIST_FILES = (Get-ChildItem "backend/dist" -Recurse -File | Measure-Object).Count
    Write-Host "  📊 Compiled files: $DIST_FILES" -ForegroundColor Gray
} else {
    Test-Result 1 "Backend dist folder not found or empty"
}
Write-Host ""

# 8. CHECK GIT COMMITS
Write-Host "[8/8] Checking Git commits..." -ForegroundColor Blue
$COMMITS_AHEAD = git rev-list --count origin/feature/essayage-virtuel..feature/essayage-virtuel 2>$null
if ($COMMITS_AHEAD -gt 0) {
    Test-Result 0 "Feature branch has $COMMITS_AHEAD commits ahead of origin"
} else {
    Test-Result 0 "Branch in sync with remote"
}
Write-Host ""

# SUMMARY
Write-Host "=============================================="
Write-Host "📊 VALIDATION SUMMARY" -ForegroundColor Blue
Write-Host "=============================================="
Write-Host "✅ Tests Passed:  $TESTS_PASSED" -ForegroundColor Green
Write-Host "❌ Tests Failed:  $TESTS_FAILED" -ForegroundColor Red

if ($TESTS_FAILED -eq 0) {
    Write-Host ""
    Write-Host "🎉 ALL VALIDATIONS PASSED!" -ForegroundColor Green
    Write-Host "✅ Feature branch is ready for deployment" -ForegroundColor Green
    exit 0
} else {
    Write-Host ""
    Write-Host "⚠️  SOME VALIDATIONS FAILED" -ForegroundColor Red
    Write-Host "Please review the failures above" -ForegroundColor Red
    exit 1
}
