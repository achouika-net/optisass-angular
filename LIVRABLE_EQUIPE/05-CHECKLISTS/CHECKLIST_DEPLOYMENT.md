# 🚀 CHECKLIST DÉPLOIEMENT & DEPLOYMENT READINESS

**Usage**: Avant chaque déploiement (staging, production)

---

## 📋 PRÉ-DÉPLOIEMENT (3 jours avant)

### Code Freeze
- [ ] All PRs merged to main branch
- [ ] No pending commits in queue
- [ ] Tag release created: `v[YYYY.MM.DD]`
- [ ] Release notes drafted

### Testing Complete
- [ ] Unit tests: 100% passing
- [ ] Integration tests: 100% passing
- [ ] E2E tests: 100% passing
- [ ] Coverage: ≥ 80% maintained
- [ ] Code review approved by ≥ 2 reviewers
- [ ] No critical/high severity issues

### Build Verification
- [ ] Backend build succeeds: `npm run build`
- [ ] Frontend build succeeds: `npm run build`
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] Bundle size acceptable
- [ ] Docker images build successfully

---

## 🗄️ DATABASE & MIGRATIONS

### Migrations Ready
- [ ] New migrations created (if schema changes)
- [ ] Migrations tested locally:
  ```bash
  npm run prisma:migrate:dev
  npm run prisma:migrate:reset  # Test in clean DB
  ```
- [ ] Rollback migrations tested:
  - Can we safely rollback if deploy fails?
  - Data not corrupted in rollback?

- [ ] No breaking changes without deprecation period
- [ ] Data seed scripts updated (if applicable)

### Backups
- [ ] Current production DB backed up (manual + automated)
- [ ] Backup location verified: `backup-2026-01-15.sql`
- [ ] Backup restore tested:
  ```bash
  psql -U user < backup-2026-01-15.sql
  # Verify data integrity
  ```

### Schema Changes
- [ ] All new fields have defaults
- [ ] All nullable fields nullable in schema
- [ ] Indexes added for performance queries
- [ ] No missing foreign key constraints

---

## 🔐 SECURITY CHECKLIST

- [ ] All secrets in `.env`, not in code
- [ ] No credentials committed to git
- [ ] JWT secrets rotated (if needed)
- [ ] API keys validated/active
- [ ] Database credentials updated
- [ ] SSL certificates valid:
  ```bash
  openssl x509 -in cert.pem -noout -dates
  ```

### Security Audit
- [ ] OWASP Top 10 checklist reviewed
- [ ] SQL injection impossible
- [ ] XSS prevention in place
- [ ] CSRF tokens present
- [ ] Rate limiting configured
- [ ] Input validation strict
- [ ] Output sanitization applied

---

## 🔧 ENVIRONMENT SETUP

### Configuration
- [ ] `.env.prod` file reviewed
  - [ ] DATABASE_URL correct
  - [ ] API_URL correct
  - [ ] JWT_SECRET set
  - [ ] CORS origins set
  - [ ] LOG_LEVEL appropriate

- [ ] Docker compose prod reviewed:
  ```yaml
  # docker-compose.prod.yml
  - Environment variables correct
  - Port mappings correct
  - Volume mounts correct
  - Resource limits set
  ```

### Infrastructure
- [ ] Server resources adequate
  - [ ] RAM ≥ 4GB
  - [ ] Disk ≥ 50GB free
  - [ ] CPU adequate for load
  
- [ ] Network configured
  - [ ] Firewall rules set
  - [ ] Ports open (80, 443)
  - [ ] DNS updated (if domain change)
  - [ ] SSL cert installed

---

## 📊 MONITORING & LOGGING

### Observability
- [ ] Logs collected:
  - [ ] Backend logs → Log aggregation (ELK, etc.)
  - [ ] Frontend errors → Error tracking (Sentry, etc.)
  - [ ] DB logs monitored

- [ ] Metrics exposed:
  - [ ] API response time
  - [ ] Error rate
  - [ ] DB query time
  - [ ] CPU/Memory usage
  - [ ] Disk space

- [ ] Alerts configured:
  - [ ] Error rate spike (> 5%)
  - [ ] Response time slow (> 500ms)
  - [ ] DB down
  - [ ] Disk space low (< 10%)
  - [ ] Server down

### Dashboards
- [ ] Grafana/Dashboard ready showing:
  - [ ] Request count/minute
  - [ ] Error rate
  - [ ] Response times (p50, p95, p99)
  - [ ] Database performance
  - [ ] Server resources

---

## 📦 DEPLOYMENT SCRIPT

### Docker Deployment
```bash
#!/bin/bash
# deploy.sh

echo "1. Pull latest code"
git pull origin main
git checkout v[VERSION]

echo "2. Build images"
docker-compose build

echo "3. Run migrations"
docker-compose exec backend npx prisma migrate deploy

echo "4. Start services"
docker-compose up -d

echo "5. Health checks"
curl http://localhost:3000/api/health
curl http://localhost:4200

echo "✓ Deployment complete"
```

### Steps
- [ ] Deployment script tested locally
- [ ] No manual steps needed (fully automated)
- [ ] Rollback script exists and tested
- [ ] Deployment estimated duration: ≤ 5 min
- [ ] Deployment window scheduled (low-traffic time)

---

## ✅ HEALTH CHECKS

### Backend Health
```bash
# API responding
curl http://localhost:3000/api/health

# Database connected
curl http://localhost:3000/api/db-status

# Cache working
curl http://localhost:3000/api/cache-status

# External services
curl http://localhost:3000/api/services-status
```

- [ ] All health checks return 200 OK
- [ ] Response time < 100ms

### Frontend Health
- [ ] App loads: http://localhost:4200
- [ ] No console errors (F12)
- [ ] Login works
- [ ] Dashboard loads data
- [ ] One full workflow tested

---

## 🔄 SMOKE TEST PLAN (Post-Deployment)

### Tier 1 (Critical Flows)
```
1. Login → Verify authentication works
2. Dashboard → Verify data loads
3. Create Client → Verify CRUD works
4. Create Facture → Verify workflow
5. Record Paiement → Verify transaction
6. Check Stock → Verify isolation
```

- [ ] All tier 1 flows tested
- [ ] No errors in console
- [ ] Data persists to database

### Tier 2 (Important Features)
```
7. Loyalty points visible
8. Commissions calculated
9. Caisse balancing
10. Multi-centre isolation
```

- [ ] All tier 2 features working

---

## 🔍 MONITORING (First 24h)

### Error Rate
- [ ] Monitor error logs every 30 min
- [ ] Alert if error rate > 5%
- [ ] Check error types (are they expected?)

### Performance
- [ ] Monitor API latency
- [ ] Alert if p95 > 500ms
- [ ] Check database queries (slow logs)

### User Activity
- [ ] Monitor active users
- [ ] Check for unusual patterns
- [ ] Verify no mass failures

### Data Integrity
- [ ] Random spot-checks on data
- [ ] Verify audit trails logged
- [ ] Check multi-tenant isolation
- [ ] Verify calculations correct

### Resources
- [ ] Check server CPU/Memory
- [ ] Check disk space
- [ ] Check database connections
- [ ] Check external service connections

---

## 🆘 ROLLBACK PROCEDURE

### If Critical Issue Detected
```bash
# 1. Stop services
docker-compose stop

# 2. Revert to previous version
git checkout v[PREVIOUS_VERSION]

# 3. Revert database (if applicable)
psql < backup-previous.sql

# 4. Rebuild and restart
docker-compose up -d

# 5. Verify health checks
curl http://localhost:3000/api/health

# 6. Notify stakeholders
```

- [ ] Rollback script tested
- [ ] Rollback time documented: ≤ 15 min
- [ ] Backups available for rollback
- [ ] Team knows rollback procedure

### Communication
- [ ] Rollback announcement prepared
- [ ] Stakeholders notified
- [ ] Root cause analysis scheduled
- [ ] Fix timeline communicated

---

## 📋 DEPLOYMENT CHECKLIST

### Pre-Deployment (3 days)
- [ ] Code freeze
- [ ] All tests passing
- [ ] Migrations tested
- [ ] Backups complete
- [ ] Environment ready
- [ ] Monitoring configured
- [ ] Smoke tests planned
- [ ] Team available

### During Deployment (execution)
- [ ] Deployment script runs
- [ ] Health checks pass
- [ ] Error logs clean
- [ ] Performance normal
- [ ] Smoke tests pass
- [ ] Team monitoring

### Post-Deployment (24h monitoring)
- [ ] Error rate < 1%
- [ ] Performance normal
- [ ] Users reporting no issues
- [ ] Data integrity verified
- [ ] Audit trails logging
- [ ] Alerts not firing

### Sign-Off
- [ ] PM approves deployment
- [ ] Tech lead signs off
- [ ] Operations confirms stable
- [ ] Documentation updated
- [ ] Release notes published

---

## 📝 DEPLOYMENT LOG TEMPLATE

```
DATE: [YYYY-MM-DD]
VERSION: v[VERSION]
DEPLOYED_BY: [Name]
DEPLOYMENT_DURATION: [TIME]

PRE-DEPLOYMENT:
□ Code freeze
□ Tests passing
□ Migrations tested
□ Backups verified
□ Monitoring ready

DEPLOYMENT STEPS:
□ Pull code
□ Build images
□ Run migrations
□ Start services
□ Health checks

SMOKE TESTS:
□ Login working
□ Dashboard data
□ CRUD operations
□ Workflows functional
□ Data isolation

ISSUES FOUND:
[List any issues]

RESOLUTION:
[How resolved]

POST-DEPLOYMENT MONITORING:
[24h observations]

SIGN-OFF:
PM: ___________
Tech Lead: ___________
Operations: ___________
```

---

## 🆘 COMMON DEPLOYMENT ISSUES

| Issue | Solution |
|-------|----------|
| Build fails | Check dependencies, clear node_modules |
| Migration fails | Rollback DB, review migration code |
| Services won't start | Check ports, verify config, check logs |
| Data loss after deploy | Verify backup restore works |
| Performance degradation | Check DB indexes, review queries |
| Users can't login | Check JWT secret, verify auth service |

---

## 📞 DEPLOYMENT TEAM

- **Tech Lead**: [Name] → Overall responsibility
- **Backend Dev**: [Name] → Backend deployment
- **Frontend Dev**: [Name] → Frontend deployment
- **DevOps**: [Name] → Infrastructure
- **PM**: [Name] → Approval & communication
- **QA**: [Name] → Smoke testing

---

**Safe deployments! 🚀**

Questions? Check [../04-RESSOURCES/TROUBLESHOOTING.md](../04-RESSOURCES/TROUBLESHOOTING.md)
