# 🔐 RECOMMANDATIONS DE SÉCURITÉ - OPTISAAS

**Date**: 2026-04-19  
**Status**: 📋 Guide d'implémentation  
**Audience**: Équipe sécurité, DevOps, Backend leads

---

## 📋 TABLE DES MATIÈRES

1. [Installation des Dépendances](#installation-des-dépendances)
2. [Implémentation par Phase](#implémentation-par-phase)
3. [Testing et Validation](#testing-et-validation)
4. [Déploiement Sécurisé](#déploiement-sécurisé)
5. [Monitoring et Alertes](#monitoring-et-alertes)
6. [Checklist de Compliance](#checklist-de-compliance)

---

## 📦 INSTALLATION DES DÉPENDANCES

### Packages Requis

```bash
# Security packages
npm install helmet
npm install @nestjs/throttler
npm install class-validator class-transformer
npm install bcrypt

# Optional but recommended
npm install dotenv-vault    # Secrets management
npm install express-rate-limit  # Additional rate limiting
npm install @sentry/node    # Error tracking
npm install winston winston-daily-rotate-file  # Advanced logging

# Dev dependencies
npm install --save-dev @types/express
npm install --save-dev eslint-plugin-security
npm install --save-dev npm-audit-html
```

### Vérification des Vulnérabilités

```bash
# Audit des dépendances
npm audit

# Repair automatically (if safe)
npm audit fix

# Detailed audit report
npm audit --json > audit-report.json
npx npm-audit-html --output audit-report.html
```

---

## 🚀 IMPLÉMENTATION PAR PHASE

### PHASE 1: CRITIQUES (Jour 1 - 2-3 heures)

#### 1.1 Fix CORS Configuration

```typescript
// backend/src/main.ts

// ❌ AVANT
app.enableCors({
  origin: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  credentials: true,
});

// ✅ APRÈS
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:4200')
  .split(',')
  .map(origin => origin.trim());

app.enableCors({
  origin: allowedOrigins,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 3600,
  preflightContinue: false,
});
```

**Test**:
```bash
# Test CORS avec origine non-whitelist (doit échouer)
curl -H "Origin: https://attacker.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS http://localhost:3000/api/auth

# Réponse: 403 (pas d'en-têtes CORS)
```

---

#### 1.2 Fix MinIO Secrets

```typescript
// backend/src/common/storage/storage.service.ts

// ❌ AVANT
const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin';

// ✅ APRÈS
const secretKey = process.env.MINIO_SECRET_KEY;
if (!secretKey) {
  throw new Error(
    '🔴 FATAL: MINIO_SECRET_KEY env var is REQUIRED. ' +
    'NEVER use defaults. Use: openssl rand -base64 32'
  );
}
```

**Action**:
```bash
# Generate secure keys
MINIO_SECRET=$(openssl rand -base64 32)
MINIO_ACCESS=$(openssl rand -base64 32)
echo "MINIO_ACCESS_KEY=$MINIO_ACCESS" >> .env
echo "MINIO_SECRET_KEY=$MINIO_SECRET" >> .env
```

---

#### 1.3 Fix SSL/TLS Verification

```typescript
// backend/src/features/marketing/marketing.service.ts

// ❌ AVANT
rejectUnauthorized: false,

// ✅ APRÈS
const isProduction = process.env.NODE_ENV === 'production';
rejectUnauthorized: isProduction ? true : false,
```

**Action**:
```bash
# Production TOUJOURS: NODE_ENV=production
# Dev avec self-signed: NODE_TLS_REJECT_UNAUTHORIZED=0 (temporaire seulement)
```

---

#### 1.4 Test Phase 1

```bash
# Redémarrer le serveur
npm run start

# Vérifier les logs
# ✅ Rechercher: "CORS_ORIGIN=" "MinIO ready" "Server starting"

# Test endpoints
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/test
```

---

### PHASE 2: HAUTES PRIORITÉ (Jour 2 - 4-5 heures)

#### 2.1 Ajouter Helmet Headers

```typescript
// backend/src/main.ts

import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
```

**Vérifier les headers**:
```bash
curl -i http://localhost:3000/api/test | grep -i "x-frame-options\|x-xss\|x-content-type"
```

---

#### 2.2 Activer Whitelist Validation

```typescript
// backend/src/main.ts

// ❌ AVANT
new ValidationPipe({
  whitelist: false,
  transform: true,
});

// ✅ APRÈS
new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: {
    enableImplicitConversion: true,
  },
});
```

**Test**:
```bash
# Send extra property (doit échouer)
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "Password123!",
    "isAdmin": true
  }'

# Réponse: 400 Bad Request (extra properties not allowed)
```

---

#### 2.3 Implémenter Rate Limiting

```typescript
// backend/src/app.module.ts

import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,      // 60 seconds
      limit: 100,   // 100 requests per minute
    }),
    // autres modules...
  ],
})
export class AppModule {}
```

**Par route**:
```typescript
// backend/src/features/auth/auth.controller.ts

import { Throttle } from '@nestjs/throttler';

@Post('login')
@Throttle(5, 60)  // 5 attempts per 60 seconds
async login(@Body() dto: LoginDto) {
  // ...
}
```

**Test**:
```bash
# Loop requests (doit throttle après 100)
for i in {1..105}; do
  curl http://localhost:3000/api/health
done

# Après 100: 429 Too Many Requests
```

---

#### 2.4 Test Phase 2

```bash
npm run test:security

# Vérifier:
# [ ] Helmet headers présents
# [ ] Validation avec whitelist strict
# [ ] Rate limiting actif
# [ ] Aucune erreur détaillée exposée
```

---

### PHASE 3: MOYENNES PRIORITÉ (Jour 3-4 - 6-8 heures)

#### 3.1 Audit Logging Complet

```typescript
// backend/src/common/audit/audit.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  private logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  async logAction(
    action: string,
    userId: string,
    centreId: string,
    details: any,
    ipAddress: string
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          userId,
          centreId,
          details: JSON.stringify(details),
          ipAddress,
          timestamp: new Date(),
        },
      });
    } catch (e) {
      this.logger.error('Audit log failed:', e);
      // Never throw - audit failure shouldn't break app
    }
  }
}
```

**Utilisation**:
```typescript
@Post('clients')
async createClient(
  @Body() dto: CreateClientDto,
  @Req() req: Request,
  @CurrentUser() user: any
) {
  const client = await this.clientService.create(dto);
  
  // Log audit
  await this.auditService.logAction(
    'CREATE_CLIENT',
    user.id,
    user.centreId,
    { clientId: client.id, name: client.name },
    req.ip
  );
  
  return client;
}
```

---

#### 3.2 Secrets Management avec Vault

```bash
# Option 1: AWS Secrets Manager
npm install aws-sdk

# Option 2: Hashicorp Vault
npm install node-vault

# Option 3: dotenv-vault (simple)
npm install dotenv-vault
npx dotenv-vault new  # Create .env.vault
npx dotenv-vault push  # Push to vault
```

**Utilisation**:
```typescript
// backend/src/config/secrets.config.ts

import * as AWS from 'aws-sdk';

export async function loadSecrets() {
  const secretsManager = new AWS.SecretsManager({
    region: process.env.AWS_REGION,
  });

  try {
    const secret = await secretsManager
      .getSecretValue({ SecretId: 'optisaas/prod/secrets' })
      .promise();

    return JSON.parse(secret.SecretString);
  } catch (e) {
    console.error('Failed to load secrets from AWS:', e);
    // Fallback to env vars
    return process.env;
  }
}
```

---

#### 3.3 Log Rotation

```typescript
// backend/src/common/logger/log-rotation.service.ts

@Injectable()
export class LogRotationService {
  private maxFileSize = 10 * 1024 * 1024; // 10MB
  private maxFiles = 10;

  appendLog(filePath: string, message: string): void {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size > this.maxFileSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        fs.renameSync(filePath, `${filePath}.${timestamp}`);
        
        // Clean old logs
        const files = fs
          .readdirSync(path.dirname(filePath))
          .filter(f => f.startsWith(path.basename(filePath)))
          .sort()
          .reverse();
        
        files.slice(this.maxFiles).forEach(f => {
          fs.unlinkSync(path.join(path.dirname(filePath), f));
        });
      }
    }
    fs.appendFileSync(filePath, message);
  }
}
```

---

#### 3.4 Test Phase 3

```bash
# Vérifier audit logs
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/audit-logs

# Vérifier log rotation (créer logs volumineux)
# [ ] Logs rotatent à 10MB
# [ ] Anciens logs archivés
# [ ] Disk usage stable
```

---

### PHASE 4: LONG TERME (Semaine 2-3 - 20-30 heures)

#### 4.1 Dependency Security Scanning

```bash
# Audit complet
npm audit --audit-level=moderate

# Mise à jour des packages
npm update

# Vérifier les breaking changes
npm outdated
```

---

#### 4.2 OWASP Top 10 Validation

```bash
# Install OWASP validator
npm install owasp-password-strength-test

# Test passwords
const validator = require('owasp-password-strength-test');
const result = validator.test('MyPassword123!');
console.log(result.score); // 4 = strong
```

---

#### 4.3 Penetration Testing Script

```bash
#!/bin/bash
# security-tests.sh

echo "🔐 Running security tests..."

# Test SQL injection protection
echo "Testing SQL injection protection..."
curl -X GET "http://localhost:3000/api/clients?search='; DROP TABLE clients; --"

# Test XSS protection
echo "Testing XSS protection..."
curl -X POST http://localhost:3000/api/clients \
  -H "Content-Type: application/json" \
  -d '{"name": "<script>alert(1)</script>"}'

# Test rate limiting
echo "Testing rate limiting..."
for i in {1..110}; do
  curl -s http://localhost:3000/api/health
done

echo "✅ Security tests completed"
```

---

## 🧪 TESTING ET VALIDATION

### Test Suite de Sécurité

```typescript
// backend/src/security.test.ts

describe('Security Tests', () => {
  
  test('CORS blocks unauthorized origins', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/test')
      .set('Origin', 'https://attacker.com');
    
    expect(response.status).toBe(403);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('Rate limiting blocks excessive requests', async () => {
    let response;
    for (let i = 0; i < 105; i++) {
      response = await request(app.getHttpServer()).get('/api/health');
    }
    
    expect(response.status).toBe(429);
  });

  test('Password validation requires strong passwords', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/users')
      .send({
        email: 'test@test.com',
        password: 'weak'
      });
    
    expect(response.status).toBe(400);
    expect(response.body.message).toContain('password');
  });

  test('Validation rejects unknown properties', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/users')
      .send({
        email: 'test@test.com',
        password: 'StrongPassword123!',
        isAdmin: true  // Should be rejected
      });
    
    expect(response.status).toBe(400);
  });
});
```

**Run tests**:
```bash
npm run test:security
npm run test:security -- --coverage
```

---

## 🚀 DÉPLOIEMENT SÉCURISÉ

### Pre-Deployment Checklist

```bash
# 1. Code review
git log origin/main..HEAD  # Review all changes
npm audit  # Check dependencies

# 2. Build and test
npm run build
npm run test:security
npm run lint

# 3. Environment validation
cat .env.production  # Verify secrets are set
[ -z "$JWT_SECRET" ] && echo "ERROR: JWT_SECRET not set" && exit 1

# 4. Database migration
npm run prisma:migrate deploy

# 5. Create release tag
git tag -a v1.0.1-security -m "Security fixes and hardening"
git push --tags
```

### Docker Security

```dockerfile
# Dockerfile (secure)

# ✅ Use specific version (not 'latest')
FROM node:18.17-alpine

# ✅ Run as non-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

WORKDIR /app

# ✅ Copy only necessary files
COPY --chown=nodejs:nodejs package*.json ./
RUN npm ci --only=production

COPY --chown=nodejs:nodejs dist ./dist

# ✅ Run as non-root user
USER nodejs

# ✅ Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

---

## 📊 MONITORING ET ALERTES

### Logging avec Winston

```typescript
// backend/src/config/logger.config.ts

import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';

export function createLogger() {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.json(),
    transports: [
      new winston.transports.Console({
        format: winston.format.simple(),
      }),
      new DailyRotateFile({
        filename: 'logs/application-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxDays: '14d',
      }),
      new DailyRotateFile({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxDays: '30d',
        level: 'error',
      }),
    ],
  });
}
```

---

### Sentry Integration

```bash
npm install @sentry/node @sentry/tracing
```

```typescript
// backend/src/main.ts

import * as Sentry from '@sentry/node';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });

  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.errorHandler());
}
```

---

## ✅ CHECKLIST DE COMPLIANCE

### OWASP Top 10

- [ ] **A01 Broken Access Control**: RBAC implementé, centreId vérifié
- [ ] **A02 Cryptographic Failures**: Passwords hashés bcrypt, secrets sécurisés
- [ ] **A03 Injection**: Prisma utilisé (parameterized queries)
- [ ] **A04 Insecure Design**: Validation en cascade
- [ ] **A05 Security Misconfiguration**: Helmet headers, HTTPS forced
- [ ] **A06 Vulnerable Components**: npm audit régulier
- [ ] **A07 Authentication Failures**: JWT + password validation
- [ ] **A08 Data Integrity Failures**: Audit logging complet
- [ ] **A09 Logging Failures**: Centralized logging avec rotation
- [ ] **A10 SSRF**: Input validation, URL sanitization

### GDPR (si clients EU)

- [ ] Consentement collecté
- [ ] Droit à l'oubli implémenté
- [ ] Portable des données
- [ ] Notification breach
- [ ] DPA avec processors

### PCI-DSS (si paiements)

- [ ] SSL/TLS 1.2+ obligatoire
- [ ] Pas de stockage PAN (numéro carte)
- [ ] Tokenization avec provider tiers
- [ ] Audit logging complet
- [ ] Accès restreint

---

## 📞 SUPPORT ET ESCALADE

**Problème critique pendant déploiement?**
1. Rollback immédiat
2. Post-mortem dans 24h
3. Fix et redeploy
4. Communication à clients

**Questions?** Consultez:
- [SECURITY_AUDIT.md](SECURITY_AUDIT.md) - Détails des vulnérabilités
- [SECURITY_FIXES.ts](SECURITY_FIXES.ts) - Code corrigé prêt à utiliser
- `.env.example` - Configuration sécurisée

---

**Status**: ✅ **Guide complet de sécurisation**

*Généré par: Copilot AI Security*  
*Date: 2026-04-19*
