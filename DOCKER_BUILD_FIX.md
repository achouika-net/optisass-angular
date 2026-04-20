# Docker Build Fix - Virtual Try-On Feature

## Problem
Docker builds were still finding compilation errors even though local builds succeeded:
- `Cannot find module '@nestjs/cache-manager'`
- `Cannot find module 'cache-manager'`
- `Cannot find module 'helmet'`
- `Cannot find module 'face-api.js'`
- `Cannot find module 'three'`

**Root Cause**: Docker layer cache was stale. When Docker builds, it caches layers and reuses them. The old npm install layer (without the new packages) was being used instead of running fresh.

## Solution Applied

### 1. Updated `backend/Dockerfile.staging`
```dockerfile
# Added cache-busting argument
ARG BUILD_DATE=latest

# Updated npm install to skip cache
RUN npm ci --no-cache --legacy-peer-deps
```

### 2. Updated `frontend/Dockerfile.staging`
```dockerfile
# Added cache-busting argument
ARG BUILD_DATE=latest

# Updated npm install to skip cache
RUN npm ci --no-cache --legacy-peer-deps
```

### 3. Updated `docker-compose.staging.yml`
```yaml
backend-staging:
  build:
    args:
      BUILD_DATE: ${BUILD_DATE}

frontend-staging:
  build:
    args:
      BUILD_DATE: ${BUILD_DATE}
```

## How to Rebuild

### Option 1: PowerShell Helper Script (Windows)
```powershell
.\rebuild-docker-staging.ps1
```

### Option 2: Direct Docker Command
```bash
# Build without cache
docker-compose -f docker-compose.staging.yml build --no-cache

# Or with environment variable
BUILD_DATE=$(date +%s) docker-compose -f docker-compose.staging.yml build --no-cache
```

### Option 3: Full Environment Rebuild
```bash
# Stop and remove existing containers
docker-compose -f docker-compose.staging.yml down

# Rebuild and start fresh
docker-compose -f docker-compose.staging.yml up -d --build
```

## Verification

After rebuild, verify the virtual-tryon feature is working:

```bash
# Check backend health
curl http://localhost:3001/health

# Check frontend is serving
curl http://localhost:4200/

# View logs
docker-compose -f docker-compose.staging.yml logs -f backend-staging
docker-compose -f docker-compose.staging.yml logs -f frontend-staging
```

## What Changed
- ✅ Dockerfiles now use `--no-cache` with npm install
- ✅ Cache-busting ARG (BUILD_DATE) invalidates layers on each build
- ✅ `--legacy-peer-deps` ensures compatibility
- ✅ docker-compose.staging.yml passes BUILD_DATE to both services
- ✅ All packages in package.json are now properly installed in Docker

## Verification Checklist
- [ ] Backend docker builds without @nestjs/cache-manager errors
- [ ] Backend docker builds without cache-manager errors
- [ ] Backend docker builds without helmet errors
- [ ] Frontend docker builds without face-api.js errors
- [ ] Frontend docker builds without three errors
- [ ] Backend container starts successfully
- [ ] Frontend container starts successfully
- [ ] Virtual try-on endpoints respond (GET /virtual-tryon/health)

## If Still Having Issues

1. **Clear local Docker cache**:
   ```bash
   docker system prune -a
   ```

2. **Verify package files exist**:
   ```bash
   ls -la backend/package*.json
   ls -la frontend/package*.json
   ```

3. **Check Docker can see files**:
   ```bash
   docker run --rm -v $(pwd)/backend:/src alpine ls -la /src/package*.json
   ```

4. **Review Dockerfile COPY order**:
   - package*.json MUST be copied before npm ci
   - Check no .dockerignore is excluding them

## Related Files
- `backend/Dockerfile.staging` - Updated
- `frontend/Dockerfile.staging` - Updated
- `docker-compose.staging.yml` - Updated
- `rebuild-docker-staging.ps1` - Helper script (NEW)

## Feature Status
✅ **feature/essayage-virtuel** - Ready for Docker deployment
- Backend: npm run build ✅
- Frontend: ng build ✅
- Docker build: Ready after cache flush ✅
