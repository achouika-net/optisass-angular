# 🚀 Virtual Try-On Feature - Deployment Guide

## Feature Overview

**Essayage Virtuel** is a cutting-edge AR-powered feature that allows customers to virtually try glasses and sunglasses using their webcam.

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Angular + Three.js + face-api.js | Real-time AR rendering + face detection |
| **Backend** | NestJS + Prisma | API + database management |
| **Database** | PostgreSQL | Store try-on sessions & analytics |
| **Cache** | Redis | Session management + analytics caching |
| **Storage** | MinIO | Image/video storage for try-on results |
| **Monitoring** | Prometheus + Grafana | Performance metrics & dashboards |
| **Orchestration** | Docker Compose | Local staging deployment |

---

## Pre-Deployment Checklist

### System Requirements
- [ ] Docker & Docker Compose (v20+)
- [ ] Node.js 18+
- [ ] PostgreSQL 15+
- [ ] Minimum 4GB RAM
- [ ] Modern browser with WebRTC support (Chrome 60+, Firefox 50+, Safari 15+)

### Environment Variables

Create `.env.staging` with:

```bash
# Database
DB_PASSWORD_STAGING=<strong-password-32-chars>

# JWT
JWT_SECRET_STAGING=<jwt-secret-64-chars>

# MinIO
MINIO_USER_STAGING=minioadmin
MINIO_PASSWORD_STAGING=<strong-password-32-chars>

# Grafana
GRAFANA_PASSWORD_STAGING=<grafana-password-32-chars>

# API URLs
FRONTEND_URL=http://localhost:4200
BACKEND_URL=http://localhost:3001
```

---

## Quick Start Deployment

### 1. Build & Start Services

```bash
# Navigate to project root
cd golden-cluster

# Start all services (PostgreSQL, Backend, Frontend, Redis, MinIO, Nginx, Monitoring)
docker-compose -f docker-compose.staging.yml up -d

# Wait for services to be healthy (30-60 seconds)
docker-compose -f docker-compose.staging.yml ps
```

### 2. Run Database Migrations

```bash
# Inside backend container
docker-compose -f docker-compose.staging.yml exec backend-staging npm run prisma:migrate

# Seed with sample data
docker-compose -f docker-compose.staging.yml exec backend-staging npm run prisma:seed
```

### 3. Verify Deployment

```bash
# Check service health
docker-compose -f docker-compose.staging.yml exec backend-staging curl http://localhost:3000/health

# View logs
docker-compose -f docker-compose.staging.yml logs -f backend-staging
```

### 4. Access Services

| Service | URL | Credentials |
|---------|-----|-------------|
| **Frontend** | http://localhost:4200 | N/A |
| **Backend API** | http://localhost:3001/api | N/A |
| **Nginx Proxy** | http://localhost:80 | N/A |
| **Grafana Dashboard** | http://localhost:3001 | admin / password |
| **Prometheus** | http://localhost:9091 | N/A |
| **MinIO Console** | http://localhost:9001 | minioadmin / password |
| **PostgreSQL** | localhost:5433 | optisaas_staging / password |
| **Redis** | localhost:6380 | N/A |

---

## Virtual Try-On API Endpoints

### Create Try-On Session
```bash
POST /api/virtual-tryon
Content-Type: application/json

{
  "productId": "uuid-of-product",
  "cameraImage": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "faceDetectionData": {
    "faceBox": { "x": 100, "y": 50, "width": 200, "height": 250 },
    "landmarks": [...],
    "expressions": { "neutral": 0.8, "happy": 0.1 },
    "age": 28,
    "gender": "male"
  },
  "productType": "GLASSES",
  "centreId": "auto"
}

Response: {
  "id": "tryon-session-uuid",
  "productId": "product-uuid",
  "resultImageUrl": "/public/tryon-results/result-123.jpg",
  "confidenceScore": 92,
  "createdAt": "2026-04-20T10:00:00Z"
}
```

### Get Client History
```bash
GET /api/virtual-tryon/history/:clientId

Response: [
  {
    "id": "tryon-1",
    "product": { "id": "...", "name": "Ray-Ban Wayfarers", "price": 150 },
    "confidenceScore": 92,
    "createdAt": "2026-04-20T10:00:00Z"
  }
]
```

### Get Analytics
```bash
GET /api/virtual-tryon/analytics

Response: {
  "totalTryons": 245,
  "averageConfidence": 88.5,
  "byProductType": [
    { "productType": "GLASSES", "_count": 180 },
    { "productType": "SUNGLASSES", "_count": 65 }
  ],
  "period": { "startDate": "...", "endDate": "..." }
}
```

---

## Performance Optimization

### Frontend (Angular)
- **Code Splitting**: Virtual try-on module lazy-loaded
- **Image Optimization**: WebP format for camera feeds
- **Face Detection Models**: Cached locally after first download (5MB)
- **Rendering**: Three.js WebGL acceleration

### Backend (NestJS)
- **Caching Strategy**: 
  - Client history: 5 minutes TTL
  - Analytics: 1 hour TTL
- **Database Indexes**: On centreId, clientId, createdAt
- **Rate Limiting**: 100 requests/minute per user

### Database (PostgreSQL)
```sql
-- Pre-created indexes
CREATE INDEX idx_virtual_tryon_centre_id ON "VirtualTryon"("centreId");
CREATE INDEX idx_virtual_tryon_client_id ON "VirtualTryon"("clientId");
CREATE INDEX idx_virtual_tryon_created_at ON "VirtualTryon"("createdAt");
```

---

## Monitoring & Logs

### Real-Time Logs
```bash
# All services
docker-compose -f docker-compose.staging.yml logs -f

# Specific service
docker-compose -f docker-compose.staging.yml logs -f backend-staging
```

### Metrics (Prometheus/Grafana)

Access: http://localhost:3001 (Grafana)

**Pre-configured Dashboards:**
- API Response Times
- Database Query Performance
- Memory/CPU Usage
- Virtual Try-On Session Count
- Confidence Score Distribution

### Application Logs

Logs are stored in:
```
backend-staging: /app/logs/
frontend-staging: /var/log/nginx/
```

---

## Testing

### Unit Tests
```bash
docker-compose -f docker-compose.staging.yml exec backend-staging npm run test
```

### Integration Tests
```bash
docker-compose -f docker-compose.staging.yml exec backend-staging npm run test:e2e
```

### Load Testing (Virtual Try-On)
```bash
# Using Artillery
artillery run load-tests/virtual-tryon.yml

# Expected: 100 req/s sustained, p99 latency < 500ms
```

---

## Troubleshooting

### Camera Permission Issues
**Problem**: "Camera access denied" error
```
Solution:
1. Check browser permissions for localhost
2. Ensure HTTPS in production
3. Use chrome://extensions -> localhost permissions
```

### Face Detection Models Not Loading
**Problem**: "Failed to load face detection models" (404)
```
Solution:
1. Verify /public/models directory exists
2. Check network tab in DevTools
3. Ensure CORS headers are correct
4. Models should be downloaded from GitHub (automatic)
```

### Database Connection Errors
**Problem**: "Cannot connect to PostgreSQL"
```
Solution:
docker-compose -f docker-compose.staging.yml exec postgres-staging pg_isready
```

### Out of Memory (OOM) on Canvas Rendering
**Problem**: Large images cause memory spike
```
Solution:
1. Limit camera resolution to 720p
2. Compress images server-side
3. Increase Docker memory allocation: 
   docker-compose -f docker-compose.staging.yml --compatibility up
```

---

## Rollback Plan

### Quick Rollback
```bash
# Stop all services
docker-compose -f docker-compose.staging.yml down

# Switch to previous main branch
git checkout main
git pull origin main

# Restart with previous version
docker-compose -f docker-compose.staging.yml up -d
```

### Database Rollback
```bash
# Restore from backup
docker-compose -f docker-compose.staging.yml exec postgres-staging \
  psql -U optisaas_staging -d optisaas_staging < backup.sql
```

---

## Security Checklist

- [ ] CORS whitelist configured (not wildcard)
- [ ] JWT secrets strong (32+ chars)
- [ ] Database passwords stored in .env (never in git)
- [ ] Rate limiting enabled (100/minute)
- [ ] Audit logging enabled for all try-ons
- [ ] SSL certificates valid
- [ ] Input sanitization enabled
- [ ] File uploads scanned for malware
- [ ] Sensitive data (images) purged after 30 days

---

## Next Steps for Production

1. **SSL/TLS**: Install real certificates (Let's Encrypt)
2. **Auto-scaling**: Configure Kubernetes or AWS ECS
3. **CDN**: Serve images via CloudFront/CloudFlare
4. **Backup Strategy**: Automated PostgreSQL backups
5. **Disaster Recovery**: Multi-region setup
6. **Load Testing**: Conduct stress tests (10K concurrent)
7. **Security Audit**: Third-party penetration testing
8. **Compliance**: GDPR compliance for image storage

---

## Support & Documentation

- **API Documentation**: `/api-docs` (Swagger UI)
- **Postman Collection**: `./postman/virtual-tryon.json`
- **Architecture Diagram**: `./docs/architecture.md`
- **Issues**: GitHub Issues / Jira

---

**Branch**: `feature/essayage-virtuel`  
**Status**: 🟢 Ready for Staging  
**Last Updated**: April 20, 2026
