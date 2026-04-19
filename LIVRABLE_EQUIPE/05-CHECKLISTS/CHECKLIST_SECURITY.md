# 🛡️ CHECKLIST SÉCURITÉ

**Usage**: Audit sécurité complet avant déploiement production

---

## 🔐 AUTHENTIFICATION & JWT

### JWT Configuration
- [ ] Secret JWT strong (≥32 caractères aléatoires)
- [ ] Secret NOT in code (dans `.env`)
- [ ] Expiration token: ≤ 24h (recommendé 2h)
- [ ] Refresh token mechanism implémenté
- [ ] Revocation token possible (blacklist ou DB check)

### Login/Logout
- [ ] Password hashed avec bcrypt (salt rounds ≥ 10)
- [ ] Pas de plaintext password en logs/responses
- [ ] Logout invalide token
- [ ] Failed login attempts logged (pour brute-force detection)
- [ ] Account lockout after N failed attempts (3-5)

### Session Management
- [ ] Session timeout après inactivité (15-30 min)
- [ ] Concurrent sessions limited (1-2 par user)
- [ ] User cannot login 2x simultaneously
- [ ] Logout from one device → logout from all

---

## 🏢 MULTI-TENANT ISOLATION

### Data Segregation (CRITIQUE)
- [ ] ALL queries filter by centreId
  ```typescript
  // ✓ CORRECT
  where: { centreId: userCentreId, ... }
  
  // ✗ INCORRECT
  where: { id: entityId }  // Missing centreId!
  ```

- [ ] Aucune query sans centreId filter
- [ ] Tester: User A ne voit PAS data User B
- [ ] Tester: Admin ne peut bypass isolation
- [ ] Database indexes on (centreId, id) pour perfs

### User-Centre Mapping
- [ ] Chaque user assigné à centre(s)
- [ ] Permissions par centre
- [ ] User ne peut pas self-assign à autre centre
- [ ] Admin ne peut assigner centre sans validations

### API Endpoints
- [ ] ALL endpoints validate user center access
- [ ] Endpoint rejet si user ne belongs à centre
- [ ] centreId pas modifiable par client
- [ ] centreId extrait from JWT token (pas from request)

---

## 🔑 AUTORISATION & RBAC

### Role-Based Access Control
- [ ] Rôles définis: ADMIN, MANAGER, VENDEUR, CAISSIER, OPTICIEN
- [ ] Permissions explicit per role
- [ ] No wildcard permissions ("*")
- [ ] Permission check BEFORE action
  ```typescript
  @CheckPermission('CREATE_FACTURES')
  createFacture(...) {
    // Only reaches here if permission granted
  }
  ```

### Endpoint Protection
- [ ] Authentication required (@Auth decorator)
- [ ] Authorization required (@CheckPermission decorator)
- [ ] Sensitive endpoints require re-authentication
- [ ] Audit log who accessed what

### Permission Hierarchy
- [ ] ADMIN > MANAGER > Specialist roles
- [ ] Lower roles cannot escalate permissions
- [ ] Testing: Try access with insufficient permissions (should 403)

---

## 📝 INPUT VALIDATION

### Type Validation
- [ ] All inputs validated on backend (NEVER trust client)
- [ ] Request body validated with DTOs
- [ ] Path params validated (type, length)
- [ ] Query params validated (type, whitelist values)

### Length/Format
- [ ] String max length enforced (prevent buffer overflow)
- [ ] Number min/max enforced
- [ ] Email format validated (RFC 5322)
- [ ] Phone format validated
- [ ] Date format validated (ISO 8601)

### Dangerous Characters
- [ ] SQL injection impossible:
  - [ ] Use parameterized queries (Prisma uses)
  - [ ] Never concat strings in SQL
  - [ ] Test with `'; DROP TABLE--` input (should fail safely)

- [ ] XSS impossible:
  - [ ] HTML entities escaped on output
  - [ ] JavaScript not allowed in user input
  - [ ] Test with `<img src=x onerror=alert('xss')>` (should fail safely)

- [ ] Command injection impossible:
  - [ ] Never pass user input to shell commands
  - [ ] Whitelist allowed values

---

## 🔒 DATA PROTECTION

### Encryption at Rest
- [ ] Sensitive fields encrypted in DB:
  - [ ] Passwords (bcrypt)
  - [ ] Bank details
  - [ ] Social security numbers
  - [ ] Medical records

- [ ] Encryption key NOT in code
- [ ] Encryption key in secure key management (AWS KMS, etc.)

### Encryption in Transit
- [ ] HTTPS only (TLS 1.2+)
- [ ] HTTP redirects to HTTPS
- [ ] HSTS header set
- [ ] SSL certificate valid (not expired)
- [ ] Certificate from trusted CA

### Data Backup
- [ ] Backups encrypted
- [ ] Backups stored separately (not same server)
- [ ] Backup restoration tested regularly
- [ ] Retention policy: 30-90 days

---

## 🚫 OUTPUT ENCODING

### Response Sanitization
- [ ] User input sanitized before returning
- [ ] HTML entities escaped:
  ```typescript
  // ✓ CORRECT
  const safe = html.escape(userInput);
  
  // ✗ INCORRECT
  const unsafe = userInput;  // Potential XSS
  ```

- [ ] JSON responses safe (no injection)
- [ ] CSV exports safe (no formula injection)
- [ ] PDF generation safe

### Error Messages
- [ ] Errors don't reveal system internals
- [ ] ✓ "Username or password invalid"
- [ ] ✗ "User 'john@email.com' not found" (information leak)
- [ ] ✗ Stack traces in production
- [ ] ✗ Database query errors in responses

---

## 🚨 LOGGING & MONITORING

### Audit Trail
- [ ] All mutations logged (CREATE, UPDATE, DELETE)
- [ ] Audit record: user, action, timestamp, before/after
- [ ] Immutable logs (cannot edit after creation)
- [ ] Retention: 1+ years

```typescript
// Template
await prisma.auditLog.create({
  data: {
    userId: user.id,
    action: 'CREATE_FACTURE',
    entityType: 'Facture',
    entityId: facture.id,
    timestamp: new Date(),
    details: { before: null, after: facture }
  }
});
```

### Security Events
- [ ] Failed login attempts logged
- [ ] Permission denials logged
- [ ] Configuration changes logged
- [ ] Alerts for suspicious activity:
  - [ ] 10+ failed logins in 5 min
  - [ ] Access outside business hours
  - [ ] Mass data exports
  - [ ] Privilege escalation attempts

### Log Storage
- [ ] Logs NOT in application logs (separate secure storage)
- [ ] Logs encrypted
- [ ] Logs centralized (not scattered across servers)
- [ ] Access to logs restricted (audit who views logs)

---

## 🔄 API SECURITY

### Rate Limiting
- [ ] Rate limit per IP: 100 req/min default
- [ ] Rate limit per user: 1000 req/hour
- [ ] Stricter limits on sensitive endpoints:
  - [ ] Login: 5 attempts/15 min
  - [ ] Password reset: 3/hour
  - [ ] File upload: 100/day per user

### CORS
- [ ] CORS origins whitelisted (NOT `*`)
- [ ] Allowed origins: exact domain names only
- [ ] Methods restricted (only needed: GET, POST, PUT, DELETE)
- [ ] Credentials: only if needed

### Versioning
- [ ] API versioned (/api/v1, /api/v2)
- [ ] Old versions deprecated with notice
- [ ] Security patches applied to all active versions

---

## 🔑 SECRETS MANAGEMENT

### Environment Variables
- [ ] Secrets in `.env` (not `.env.example`)
- [ ] `.env` in `.gitignore` (never commit!)
- [ ] `.env.example` shows template only (no real values)
- [ ] Rotation: secrets rotated every 90 days

### Secret Types
```
DATABASE_URL=postgresql://user:password@host/db
JWT_SECRET=very-long-random-string-min-32-chars
API_KEY_STRIPE=sk_test_...
EMAIL_PASSWORD=secure-password
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
ENCRYPTION_KEY=...
```

### No Hardcoded Secrets
- [ ] No secrets in code files
- [ ] No secrets in config files (committed)
- [ ] No secrets in comments
- [ ] No secrets in logs
- [ ] No secrets in error messages

---

## 🧬 DEPENDENCY SECURITY

### NPM Packages
- [ ] Regular updates: `npm audit`
- [ ] No vulnerabilities: `npm audit` returns 0
- [ ] Outdated packages updated: `npm outdated`
- [ ] Lock file committed (package-lock.json)

### Dangerous Packages
- [ ] Don't use unmaintained packages
- [ ] Don't use overly-permissive packages
- [ ] Check download stats (must be active)
- [ ] Check last update date (not > 1 year old)
- [ ] Check GitHub issues (active maintenance)

### Permission Scopes
- [ ] Packages use least privilege
- [ ] Minimize dependencies
- [ ] Scan for supply chain attacks: `npm audit` checks npm registry

---

## 🛡️ DATABASE SECURITY

### Access Control
- [ ] DB user NOT root/admin
- [ ] DB user has minimal permissions needed
- [ ] DB password strong (≥16 characters)
- [ ] DB connection string NOT in public repos

### Query Security
- [ ] Parameterized queries only (Prisma does this)
- [ ] No dynamic SQL concat
- [ ] SQL injection tests pass
- [ ] No credentials in connection string (environment variables)

### Backups
- [ ] Backups encrypted
- [ ] Backups permissions restricted (read-only, owner only)
- [ ] Backup location offline or air-gapped
- [ ] Test restore weekly

---

## 🖥️ SERVER SECURITY

### Operating System
- [ ] OS updated (latest patches)
- [ ] Firewall enabled
- [ ] Unused ports closed
- [ ] SSH keys configured (no password SSH)
- [ ] SSH default port changed (not 22)

### File Permissions
- [ ] Application files: 755 (executable), 644 (readable)
- [ ] Config files: 600 (owner read-write only)
- [ ] Sensitive directories: 700 (owner only)
- [ ] No world-readable secrets

### Resource Limits
- [ ] Process limits set (prevent DoS)
- [ ] Memory limits set per process
- [ ] CPU limits set per process
- [ ] File descriptor limits set

---

## 📞 VULNERABILITY MANAGEMENT

### Scanning
- [ ] SAST (Static Analysis): SonarQube or similar
- [ ] DAST (Dynamic Analysis): OWASP ZAP
- [ ] Dependency scan: npm audit, Snyk
- [ ] Container scan: Trivy (if Docker)

### Patch Management
- [ ] Critical patches within 24h
- [ ] High patches within 7 days
- [ ] Medium patches within 30 days
- [ ] All patches tested before deployment

### Incident Response
- [ ] Security incident plan written
- [ ] Team trained on procedure
- [ ] Contacts updated (on-call engineers)
- [ ] Communication plan ready

---

## ✅ SECURITY CHECKLIST (FINAL)

### Must-Have (Non-negotiable)
- [ ] Multi-tenant isolation working
- [ ] HTTPS only
- [ ] Passwords bcrypt hashed
- [ ] JWT secrets secure
- [ ] RBAC enforced
- [ ] Input validation complete
- [ ] SQL injection impossible
- [ ] XSS impossible
- [ ] Audit trail logging
- [ ] No hardcoded secrets

### Should-Have (Strongly recommended)
- [ ] Rate limiting
- [ ] CORS configured
- [ ] Secrets in key management
- [ ] Backups encrypted
- [ ] Vulnerability scanning
- [ ] Dependency updates
- [ ] Error handling (no stack traces)
- [ ] HSTS header
- [ ] Security headers (CSP, X-Frame-Options)

### Nice-to-Have (Extra security)
- [ ] Penetration testing
- [ ] Bug bounty program
- [ ] Security certifications (SOC 2, ISO 27001)
- [ ] Web Application Firewall (WAF)
- [ ] DDoS protection
- [ ] Geo-blocking

---

## 🆘 SECURITY INCIDENT

### If Breach Detected

1. **Immediate**: Isolate affected system
2. **Within 1h**: Notify leadership + security team
3. **Within 24h**: Notify affected users
4. **Within 72h**: Report to regulators (if required)
5. **Root cause analysis**
6. **Remediation plan**
7. **Communication**: "Here's what happened, here's what we did"

---

## 📚 RESOURCES

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- CWE Top 25: https://cwe.mitre.org/top25/
- NIST Cybersecurity Framework: https://www.nist.gov/cyberframework/

---

**Security is everyone's responsibility! 🛡️**

Questions? → [../04-RESSOURCES/FAQ_COMMUNES.md](../04-RESSOURCES/FAQ_COMMUNES.md)
