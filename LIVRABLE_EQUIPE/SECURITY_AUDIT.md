# 🔒 AUDIT DE SÉCURITÉ - OPTISAAS

**Date**: 2026-04-19  
**Analyste**: Copilot AI Security Audit  
**Status**: 🔴 **CRITIQUE - Corrections Requises**  
**Score Global**: 5.5/10

---

## 📋 TABLE DES MATIÈRES

1. [Résumé Exécutif](#résumé-exécutif)
2. [Vulnérabilités Critiques](#vulnérabilités-critiques)
3. [Vulnérabilités Hautes](#vulnérabilités-hautes)
4. [Vulnérabilités Moyennes](#vulnérabilités-moyennes)
5. [Points Forts](#points-forts)
6. [Recommandations](#recommandations)
7. [Plan d'Action](#plan-daction)

---

## 📊 RÉSUMÉ EXÉCUTIF

### Scorecard

| Domaine | Score | Status | Détails |
|---------|-------|--------|---------|
| **Architecture** | 7/10 | ✅ | NestJS bien structuré |
| **Authentification** | 8/10 | ✅ | JWT OK, mais secrets dangereux |
| **Validation** | 7/10 | ✅ | DTOs OK, whitelist désactivé |
| **Secrets Management** | 🔴 3/10 | 🔴 | Fallbacks dangereux |
| **CORS & Headers** | 🔴 2/10 | 🔴 | CORS ouvert, pas de Helmet |
| **Logging** | 🟡 5/10 | 🟡 | Sans limites, erreurs exposées |
| **Multi-tenancy** | ✅ 8/10 | ✅ | Isolation correcte théoriquement |
| **Encryption** | 🟡 5/10 | 🟡 | SSL non vérifié, no at-rest |
| **Rate Limiting** | 🔴 0/10 | 🔴 | **MANQUANT** |
| **HTTP Headers** | 🔴 1/10 | 🔴 | **MANQUANT (Helmet)** |

**SCORE GLOBAL: 🔴 4.8/10 - URGENT**

---

## 🔴 VULNÉRABILITÉS CRITIQUES

### 1. CORS Trop Permissif (CVSS 8.6 - HIGH)

**📍 Localisation**: `backend/src/main.ts:32-36`

**Code Vulnérable**:
```typescript
app.enableCors({
  origin: true,  // ❌ ACCEPTE TOUTES LES ORIGINES!
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  credentials: true,
});
```

**Risques**:
- ✗ Cross-Site Request Forgery (CSRF)
- ✗ Attaques cross-origin
- ✗ Vols de données via JS malveillant
- ✗ Session hijacking

**Impact Métier**:
- Clients peuvent perdre argent (facturation frauduleuse)
- Données sensibles (fiches patients) volées
- Réputation endommagée

**Fix**:
```typescript
app.enableCors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['https://yourdomain.com'],
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 3600,
  preflightContinue: false,
});
```

---

### 2. Secrets Avec Fallback Dangereux (CVSS 9.1 - CRITICAL)

**📍 Localisation**: `backend/src/common/storage/storage.service.ts:18`

**Code Vulnérable**:
```typescript
const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin';  // ❌ DÉFAUT CONNU!
```

**Risques**:
- ✗ Accès MinIO compromis si env manquante
- ✗ Uploads malveillants possibles
- ✗ Accès aux fichiers clients
- ✗ Credentials connues publiquement (minioadmin)

**Impact Métier**:
- Tous les uploads/documents accessibles
- Données patients exposées
- Perte de contrôle d'accès

**Fix**:
```typescript
const secretKey = process.env.MINIO_SECRET_KEY;
if (!secretKey) {
  throw new Error(
    '🔴 FATAL: MINIO_SECRET_KEY env var REQUIRED. ' +
    'NEVER use defaults in production!'
  );
}
```

---

### 3. SSL/TLS Non Vérifiés (CVSS 7.5 - HIGH)

**📍 Localisation**: `backend/src/features/marketing/marketing.service.ts:219`

**Code Vulnérable**:
```typescript
rejectUnauthorized: false,  // ❌ ACCEPTE CERTIFICATS INVALIDES!
```

**Risques**:
- ✗ Man-in-the-Middle (MITM) attacks
- ✗ Interception emails/SMS
- ✗ Injection de contenu malveillant
- ✗ Vol de credentials

**Impact Métier**:
- Emails de facturation modifiés
- RIB malveillants injectés dans factures
- Communications compromises

**Fix**:
```typescript
// PRODUCTION: TOUJOURS vérifier certificats
const nodeEnv = process.env.NODE_ENV;
const shouldRejectUnauthorized = nodeEnv !== 'development';

// Si dev avec self-signed cert: utiliser --insecure-skip-verify ailleurs
rejectUnauthorized: shouldRejectUnauthorized,
```

---

### 4. Mot de Passe Par Défaut (CVSS 7.3 - HIGH)

**📍 Localisation**: `backend/src/features/users/users.service.ts:50`

**Code Vulnérable**:
```typescript
const password = userData.password || 'password123';  // ❌ DÉFAUT FAIBLE!
```

**Risques**:
- ✗ Comptes par défaut avec mot de passe connu
- ✗ Accès non autorisés
- ✗ Escalade de privilèges

**Impact Métier**:
- N'importe qui peut se connecter avec `password123`
- Accès à tous les centres optiques
- Vols de données clients

**Fix**:
```typescript
if (!userData.password) {
  throw new BadRequestException(
    'Password is REQUIRED for new users. No defaults allowed.'
  );
}
const hashedPassword = await bcrypt.hash(userData.password, 10);
```

---

## 🟠 VULNÉRABILITÉS HAUTES

### 5. Whitelist Validation Désactivé (CVSS 6.5 - MEDIUM-HIGH)

**📍 Localisation**: `backend/src/main.ts:21-27`

**Code Vulnérable**:
```typescript
new ValidationPipe({
  whitelist: false,  // ❌ ACCEPTE PROPS EXTRA!
  transform: true,
  exceptionFactory: (errors) => { ... }
});
```

**Risques**:
- ✗ Property injection (ajouter admin: true, etc)
- ✗ Modification de données non contrôlées
- ✗ Escalade de privilèges

**Fix**:
```typescript
new ValidationPipe({
  whitelist: true,                    // ✅ Reject unknown props
  forbidNonWhitelisted: true,        // ✅ Throw error if extras
  transform: true,                    // ✅ Transform types
  transformOptions: {
    enableImplicitConversion: true,
  },
  stopAtFirstError: false,
});
```

---

### 6. Logs Sans Limite de Taille (CVSS 6.2 - MEDIUM-HIGH)

**📍 Localisation**: `backend/src/main.ts:42-48`

**Code Vulnérable**:
```typescript
fs.appendFileSync(logFile, `...`);  // ❌ LOGS ILLIMITÉS!
// Fichier peut croître indéfiniment → Disk exhaustion
```

**Risques**:
- ✗ Disk exhaustion DoS
- ✗ Crash serveur
- ✗ Perte de service
- ✗ Coûts cloud illimités

**Impact Métier**:
- Application inaccessible
- Données non sauvegardées
- Perte de chiffre d'affaires

**Fix**:
```typescript
const LOG_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const LOG_MAX_FILES = 10;

function appendLog(logFile: string, message: string) {
  try {
    if (fs.existsSync(logFile)) {
      const stats = fs.statSync(logFile);
      if (stats.size > LOG_MAX_SIZE) {
        // Archive and rotate
        fs.renameSync(logFile, `${logFile}.${Date.now()}`);
        // Clean old logs
        const files = fs.readdirSync(path.dirname(logFile))
          .filter(f => f.startsWith(path.basename(logFile)))
          .sort()
          .reverse();
        files.slice(LOG_MAX_FILES).forEach(f => {
          fs.unlinkSync(path.join(path.dirname(logFile), f));
        });
      }
    }
    fs.appendFileSync(logFile, message);
  } catch (e) {
    console.error('Log write failed:', e);
  }
}
```

---

### 7. Erreurs Détaillées Exposées (CVSS 5.3 - MEDIUM)

**📍 Localisation**: `backend/src/main.ts:25`

**Code Vulnérable**:
```typescript
console.error('❌ Validation Errors:', JSON.stringify(errors, null, 2));
// Retourne JSON détaillé en production = Information Disclosure
```

**Risques**:
- ✗ Information disclosure
- ✗ Attaquant connaît structure DTOs
- ✗ Reconnaissance préalable aux attaques
- ✗ Énumération de champs

**Fix**:
```typescript
exceptionFactory: (errors) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // Log details but don't expose
    console.error('Validation failed:', JSON.stringify(errors, null, 2));
    return new BadRequestException('Invalid input data');
  }
  
  // Dev: expose for debugging
  return new BadRequestException(
    errors.map(e => ({
      property: e.property,
      constraints: e.constraints
    }))
  );
};
```

---

## 🟡 VULNÉRABILITÉS MOYENNES

### 8. Rate Limiting Manquant (CVSS 5.3 - MEDIUM)

**Risques**:
- ✗ Brute force attacks
- ✗ DoS attacks
- ✗ Énumération d'utilisateurs
- ✗ API scraping

**Fix**:
```bash
npm install @nestjs/throttler
```

**Module**:
```typescript
// app.module.ts
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,      // 60 seconds window
      limit: 100,   // Max 100 requests per minute
    }),
    // ... autres modules
  ],
})
export class AppModule {}
```

**Par Route**:
```typescript
import { Throttle } from '@nestjs/throttler';

@Post('/login')
@Throttle(5, 60)  // 5 attempts per 60 seconds
async login(@Body() dto: LoginDto) {
  // ...
}
```

---

### 9. HTTP Headers de Sécurité Manquants (CVSS 5.0 - MEDIUM)

**Manquant**: Helmet.js

**Risques**:
- ✗ Clickjacking (X-Frame-Options)
- ✗ XSS (Content-Security-Policy)
- ✗ Mime-type sniffing
- ✗ HSTS bypass

**Fix**:
```bash
npm install helmet
```

**Setup**:
```typescript
// main.ts
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
    },
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
}));
```

---

### 10. HTTPS Redirect Manquant (CVSS 4.3 - MEDIUM)

**Risque**: Man-in-the-middle attacks si HTTP utilisé

**Fix**:
```typescript
// middleware/https.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class HttpsRedirectMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (process.env.NODE_ENV === 'production') {
      const xForwardedProto = req.get('x-forwarded-proto');
      if (xForwardedProto && xForwardedProto !== 'https') {
        return res.redirect(301, `https://${req.get('host')}${req.originalUrl}`);
      }
    }
    next();
  }
}

// app.module.ts
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpsRedirectMiddleware).forRoutes('*');
  }
}
```

---

## ✅ POINTS FORTS

### Points Fort Existants

| Point | Score | Détails |
|-------|-------|---------|
| **Prisma ORM** | ✅ 9/10 | Protection SQL injection via parameterized queries |
| **Password Hashing** | ✅ 9/10 | Utilise bcrypt avec salt=10 (bon) |
| **Input Validation** | ✅ 8/10 | ValidationPipe + class-validator DTOs |
| **Multi-tenant** | ✅ 8/10 | Filtrage centreId (bien documenté) |
| **JWT Auth** | ✅ 8/10 | Implémentation standard bonne |
| **RBAC** | ✅ 8/10 | Rôles par centre bien séparé |
| **Exception Handling** | ✅ 7/10 | Exception filters centralisés |
| **Compression** | ✅ 7/10 | Gzip activé pour performance |

---

## 🎯 RECOMMANDATIONS

### Immédiat (Critiques - Cette semaine)

**Priority 1**: Fixer CORS
```typescript
// ✅ À faire: origin: ['https://domain.com']
// ❌ Jamais: origin: true
```

**Priority 2**: Éliminer secrets par défaut
```typescript
// ✅ À faire: throw error si env manquante
// ❌ Jamais: || 'defaultPassword'
```

**Priority 3**: Vérifier certificats SSL
```typescript
// ✅ Production: rejectUnauthorized: true
// ❌ Production: rejectUnauthorized: false
```

### Court Terme (Hautes - Cette semaine)

- [ ] Activer `whitelist: true` dans ValidationPipe
- [ ] Implémenter Rate Limiting (@nestjs/throttler)
- [ ] Ajouter Helmet pour headers de sécurité
- [ ] Implémenter log rotation
- [ ] Masquer erreurs détaillées en production

### Moyen Terme (Cette semaine/semaine prochaine)

- [ ] Audit logging centralisé complet
- [ ] Secrets vault (Vaults, AWS Secrets Manager)
- [ ] HTTPS redirect middleware
- [ ] Implement CSRF protection
- [ ] Code signing pour uploads

### Long Terme (Mois 1-2)

- [ ] Penetration testing professionnel
- [ ] SIEM (Security Information Event Management)
- [ ] Encryption at-rest pour données sensibles
- [ ] Web Application Firewall (WAF)
- [ ] DDoS protection (Cloudflare, AWS Shield)

---

## 🚀 PLAN D'ACTION

### Phase 1: CRITIQUE (Jour 1)

```bash
# 1. Fix CORS
# 2. Fix Secrets
# 3. Fix SSL
# 4. Test & Deploy
```

**Temps**: 2-3 heures
**Risk**: Bas (fix simples)

---

### Phase 2: HAUTES (Jour 2)

```bash
# 1. Whitelist validation
# 2. Rate limiting
# 3. Helmet headers
# 4. Log rotation
# 5. Error masking
npm install @nestjs/throttler helmet
```

**Temps**: 4-5 heures
**Risk**: Bas (nouvelles dépendances testées)

---

### Phase 3: MOYENNES (Jour 3-4)

```bash
# 1. Audit logging
# 2. Secrets management
# 3. HTTPS redirect
# 4. CSRF protection
npm install helmet-csp csrf
```

**Temps**: 6-8 heures
**Risk**: Moyen (changements architecturaux)

---

### Phase 4: LONG TERME (Semaine 2-3)

```bash
# 1. Code review sécurité
# 2. Dependency audit
# 3. Penetration testing
# 4. Compliance checks (GDPR, etc)
```

**Temps**: 20-30 heures  
**Risk**: Élevé (changements majeurs)

---

## 📋 CHECKLIST IMMÉDIATE

- [ ] CORS: Whitelist spécifique
- [ ] MINIO_SECRET_KEY: Env var required (no fallback)
- [ ] SSL/TLS: rejectUnauthorized = true (prod)
- [ ] Passwords: Required (no defaults)
- [ ] Validation: whitelist = true
- [ ] Logs: Limit size to 10MB, rotate
- [ ] Errors: Hide details in production
- [ ] Dependencies: npm audit (aucune CRITICAL)
- [ ] Environment: .env.example avec NO secrets
- [ ] Testing: Security tests inclus

---

## 📊 ROADMAP SÉCURITÉ 2026

```timeline
├─ Semaine 1: Critiques fixes + hautes priorité
├─ Semaine 2: Moyennes priorité + audit
├─ Semaine 3: Code review complet + deps update
├─ Semaine 4: Penetration testing
└─ Mois 2+: Compliance (GDPR, PCI-DSS if needed)
```

---

## 📞 ESCALADE

**Problèmes critiques détectés?**
1. Stop deploys à production
2. Fix immédiatement (Phase 1)
3. Test complètement
4. Deploy patch release

**Questions?** Voir [SECURITY_RECOMMENDATIONS.md](SECURITY_RECOMMENDATIONS.md)

---

**Status: 🔴 AUDIT TERMINÉ - CORRECTIONS REQUISES AVANT PRODUCTION**

*Généré par: Copilot AI Security Audit*  
*Date: 2026-04-19*
