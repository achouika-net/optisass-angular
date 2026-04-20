# Rebuild Docker Compose Staging with Cache Busting
# This script rebuilds the virtual-tryon feature containers without cache

Write-Host "🔄 Rebuilding Docker Staging Environment (No Cache)" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# Build with timestamp to invalidate cache
$BuildDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Write-Host "Build Date: $BuildDate" -ForegroundColor Yellow

# Rebuild without cache and force recreate
docker-compose -f docker-compose.staging.yml build `
  --no-cache `
  --build-arg BUILD_DATE="$BuildDate"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Docker build successful!" -ForegroundColor Green
    Write-Host "`nTo start the containers, run:" -ForegroundColor Cyan
    Write-Host "docker-compose -f docker-compose.staging.yml up -d" -ForegroundColor Yellow
    Write-Host "`nTo view logs:" -ForegroundColor Cyan
    Write-Host "docker-compose -f docker-compose.staging.yml logs -f" -ForegroundColor Yellow
} else {
    Write-Host "`n❌ Docker build failed!" -ForegroundColor Red
    exit 1
}
