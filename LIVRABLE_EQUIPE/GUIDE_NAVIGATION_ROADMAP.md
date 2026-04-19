# 📚 GUIDE DE NAVIGATION & ROADMAP - OPTISAAS ERP

**Document Principal**: Index global + Roadmap implémentation  
**Audience**: Équipe développement + Product  
**Statut**: 🟢 Prêt pour action

---

## 🗂️ INDEX DOCUMENTATIONS

### Documentation Principale (3 Parties)

| Document | Modules | Focus | Lignes |
|----------|---------|-------|--------|
| **Part 1** | AUTH, CENTERS, PRODUCTS, FICHES, FACTURES, CLIENTS, CONVENTIONS, SALES-CONTROL, CAISSE, PAIEMENTS, ACCOUNTING, STATS | Core systems ventes | 15,000+ |
| **Part 2** | SUPPLIERS, SUPPLIER-INVOICES, BON-LIVRAISON, STOCK-MOVEMENTS, IMPORTS, LOYALTY, MARKETING, NOTIFICATIONS, MAILER, OPERATION-CAISSE, TREASURY | Approvisionnement & Communications | 10,000+ |
| **Part 3** | COMPANY-SETTINGS, PDF, UPLOADS, PERSONNEL, PAYSLIP, ATTENDANCE, FUNDING-REQUESTS, GLASS-PARAMETERS, Interconnections, Patterns | Support & Architecture | 8,000+ |

### Documents Spécialisés (Créés précédemment)

1. **METIER_OPTIQUE_AVANCE.md** (85KB)
   - OCR ordonnances
   - Virtual try-on
   - IA suggestions
   - Montage/Centrage

2. **ANALYSE_COMPLETE_DEPENSES_CAISSE_STOCK.md** (75KB)
   - Flux Dépense→Caisse
   - Impact Stock
   - Impact Client
   - Interconnections

---

## 🗺️ CARTOGRAPHIE MODULES

### Par Responsabilité

```
🔐 AUTHENTIFICATION & SÉCURITÉ
├─ auth.service.ts
└─ users.service.ts

🏢 INFRASTRUCTURE ORGANISATION
├─ centers.service.ts
├─ groups.service.ts
├─ company-settings.service.ts
├─ warehouses.service.ts
└─ personnel.service.ts

📦 PRODUITS & STOCK
├─ products.service.ts
├─ stock-movements.service.ts
├─ glass-parameters.service.ts
└─ imports.service.ts

👥 CLIENTS & RELATIONS
├─ clients.service.ts
├─ loyalty.service.ts
├─ conventions.service.ts
└─ fiches.service.ts (prescriptions)

💰 VENTES & FINANCES
├─ factures.service.ts
├─ paiements.service.ts
├─ sales-control.service.ts
├─ commission.service.ts
├─ caisse.service.ts
├─ journee-caisse.service.ts
├─ operation-caisse.service.ts
├─ accounting.service.ts
└─ treasury.service.ts

🛒 APPROVISIONNEMENT
├─ suppliers.service.ts
├─ supplier-invoices.service.ts
├─ bon-livraison.service.ts
└─ funding-requests.service.ts

👔 RESSOURCES HUMAINES
├─ payroll.service.ts
├─ payslip.service.ts
├─ attendance.service.ts
└─ commission.service.ts

📊 REPORTING & OUTILS
├─ stats.service.ts
├─ notifications.service.ts
├─ mailer.service.ts
├─ pdf.service.ts
├─ uploads.service.ts
└─ marketing.service.ts
```

---

## 🔄 FLUX PRINCIPAUX (À IMPLÉMENTER/AMÉLIORER)

### 1️⃣ FLUX VENTE COMPLÈTE

**STATUS**: ✅ Implémenté  
**AMÉLIORATIONS**: 
- [ ] Virtual try-on intégration (GLASS_PARAMETERS)
- [ ] IA suggestions produits (ML service)
- [ ] Paiement 3D Secure (Maroc Payment Gateway)
- [ ] Gestion retours/avoirs améliorée

**Timeline**: Phase 2 (Juin 2026)

### 2️⃣ STOCK & INVENTAIRE

**STATUS**: ✅ Base implémentée  
**AMÉLIORATIONS**:
- [ ] Prévisions automatiques (ML)
- [ ] Gestion multi-entrepôt (transferts optimisés)
- [ ] Codes barres scanning (mobile app)
- [ ] Comptage physique workflow
- [ ] Ajustements automatiques

**Timeline**: Phase 2 (Juin 2026)

### 3️⃣ FISCAL & COMPTABILITÉ

**STATUS**: ✅ Export Sage implémenté  
**AMÉLIORATIONS**:
- [ ] Export CIEL (alternative)
- [ ] Déclaration TVA automatique (SIMPL)
- [ ] Déclaration d'impôts (IS/IR) assistance
- [ ] Balance sheet améliorée
- [ ] Cash flow forecast

**Timeline**: Phase 3 (Août 2026)

### 4️⃣ PAIE AVANCÉE

**STATUS**: ✅ Calculs implémentés  
**AMÉLIORATIONS**:
- [ ] Support 2025 régime UPDATE (LF 2025)
- [ ] Bulletins signés électroniquement
- [ ] Dépôt CNSS automatique (e-service)
- [ ] Simulations IR (employee dashboard)
- [ ] Arrêts maladie intégration

**Timeline**: Phase 2 (Juin 2026) - Fiscal update

### 5️⃣ MARKETING & FIDÉLITÉ

**STATUS**: ⚠️ Base implémentée  
**AMÉLIORATIONS**:
- [ ] SMS campaigns (intégration opérateur Maroc)
- [ ] WhatsApp OTP + notifications
- [ ] Programme parrainage amélioré (gamification)
- [ ] Coupons/vouchers système
- [ ] Segment automatique (RFM analysis)

**Timeline**: Phase 2 (Juin 2026)

---

## 🐛 BUGS & EDGE CASES IDENTIFIÉS + SOLUTIONS

### 🔴 CRITIQUE (À corriger immédiatement)

#### BUG-001: Data Leak - Pas de filtrage centre

**Description**: Requêtes sans filtrage `centreId` permettent accès à données d'autres centres

**Cause Racine**: 
```typescript
// ❌ DANGEREUX
const factures = await prisma.facture.findMany({
  where: { statut: "VALIDE" }  // Toutes les factures de TOUS les centres!
});
```

**Impact**: 🔴 CRITIQUE - Client A peut voir factures Client B d'autre centre

**Solution**:
```typescript
// ✅ CORRECT - Ajouter filtrage centre systématique
const factures = await prisma.facture.findMany({
  where: { 
    centreId: userCentreId,  // ← MANDATORY
    statut: "VALIDE"
  }
});

// Pattern à appliquer partout:
// 1. GetUserCentre() depuis JWT token
// 2. Vérifier user.centreRoles includes centreId
// 3. Ajouter where: { centreId: ... }
```

**Audit**: Chercher dans codebase tous les `.findMany()` sans `centreId`

**Fix Effort**: 4h  
**Priority**: 🔴 URGENT (Cette semaine)

---

#### BUG-002: Stock décrémente sans Transaction

**Description**: Stock decrement en dehors de transaction - risque rupture stock

**Cause Racine**:
```typescript
// ❌ DANGEREUX - Pas atomique
const paiement = await prisma.paiement.create({...});
await prisma.product.update({...});  // Peut échouer!
// Si crash ici → paiement créé mais stock pas décrémenté
```

**Impact**: 🔴 CRITIQUE - Stock physique ≠ stock système

**Solution**:
```typescript
// ✅ CORRECT - Transaction ACID
await prisma.$transaction(async (tx) => {
  // Étape 1: Créer paiement
  const paiement = await tx.paiement.create({
    data: { factureId, montant, ... }
  });
  
  // Étape 2: Vérifier stock disponible
  const products = await tx.product.findMany({
    where: { id: { in: productIds } }
  });
  
  if (products.some(p => p.quantiteActuelle < required)) {
    throw new ConflictException("Stock insuffisant");
  }
  
  // Étape 3: Décrémenter stock
  for (const product of products) {
    await tx.product.update({
      where: { id: product.id },
      data: { quantiteActuelle: { decrement: qty } }
    });
  }
  
  // Étape 4: Créer mouvements stock
  await tx.mouvementStock.createMany({
    data: movements
  });
  
  // ROLLBACK AUTO si erreur
}, { timeout: 5000 });
```

**Fix Effort**: 6h  
**Priority**: 🔴 URGENT (Cette semaine)

---

#### BUG-003: Commission sans vérification montant

**Description**: Commission calculée sur montants non validés (négatifs, zéro)

**Cause Racine**:
```typescript
// ❌ DANGEREUX
const commission = facture.montantHT * percentageCommission;
// Si montantHT = -1000, commission = -500 (paiement vendeur!)
```

**Impact**: 🔴 CRITIQUE - Vendeurs payés pour retours

**Solution**:
```typescript
// ✅ CORRECT - Validation stricte
async calculateCommission(facture: Facture) {
  // 1. Vérifier montant valide
  if (!facture.montantHT || facture.montantHT <= 0) {
    throw new BadRequestException("Invalid amount");
  }
  
  // 2. Vérifier statut valid
  if (!["VALIDE", "PAYEE"].includes(facture.statut)) {
    return null;  // Pas de commission sur DEVIS
  }
  
  // 3. Vérifier vendeur assigné
  if (!facture.vendeurId) {
    return null;
  }
  
  // 4. Récupérer règle
  const rule = await prisma.commissionRule.findFirst({
    where: { 
      centreId: facture.centreId,
      vendeurId: facture.vendeurId
    }
  });
  
  if (!rule || rule.percentCommission <= 0) return null;
  
  // 5. Calculer avec validations
  const montantCommission = Number(
    (facture.montantHT * (rule.percentCommission / 100)).toFixed(2)
  );
  
  if (montantCommission < 0 || !isFinite(montantCommission)) {
    throw new BadRequestException("Commission calc error");
  }
  
  return montantCommission;
}
```

**Fix Effort**: 3h  
**Priority**: 🔴 URGENT (Cette semaine)

---

#### BUG-004: Validation client-side insuffisante

**Description**: Montants négatifs, zéro, NaN acceptés par API

**Cause Racine**: Pas de validation Prisma + API validation partielle

**Impact**: 🟡 HAUTE - Données corrompues possibles

**Solution**:
```typescript
// ✅ CORRECT - Validation Prisma + DTO
// 1. Schema Prisma
model Paiement {
  montant Float @gt(0)  // > 0 obligatoire
}

// 2. DTO avec class-validator
export class CreatePaiementDto {
  @IsPositive()
  @IsNumber()
  montant: number;
  
  @IsEnum(['ESPECES', 'CARTE', 'CHEQUE', 'VIREMENT'])
  mode: string;
  
  @IsUUID()
  factureId: string;
}

// 3. Controller avec validation
@Post()
@UseInterceptors(ValidationPipe)
async create(@Body() dto: CreatePaiementDto) {
  // DTO déjà validé ici
  return this.service.create(dto);
}

// 4. Service avec double-check
async create(dto: CreatePaiementDto) {
  if (dto.montant <= 0) {
    throw new BadRequestException("Montant doit être > 0");
  }
  if (!isFinite(dto.montant)) {
    throw new BadRequestException("Montant invalide");
  }
  // ... créer
}
```

**Fix Effort**: 8h  
**Priority**: 🔴 URGENT (Cette semaine)

---

### 🟡 HAUTE (À corriger bientôt)

#### BUG-005: Cheque sans relance automatique

**Solution**:
```typescript
// Créer scheduled job qui relance cheques EN_ATTENTE
// CronJob (chaque jour 9h):
@Cron('0 9 * * *')
async checkExpiredChecks() {
  const overdue = await prisma.paiement.findMany({
    where: {
      mode: 'CHEQUE',
      statut: 'EN_ATTENTE',
      dateEcheance: { lt: new Date() }
    }
  });
  
  for (const paiement of overdue) {
    await this.mailer.sendRelance(paiement);
  }
}
```
**Fix Effort**: 5h

#### BUG-006: Loyalité & retours

**Solution**:
```typescript
// Annuler points quand retour enregistré
async handleReturn(factureId: string) {
  const facture = await prisma.facture.findUnique({
    where: { id: factureId }
  });
  
  // Trouver entry points pour cette facture
  const pointsEntry = await prisma.pointsHistory.findFirst({
    where: { factureId }
  });
  
  if (pointsEntry) {
    // Annuler points
    await prisma.pointsHistory.create({
      data: {
        clientId: facture.clientId,
        type: 'PERTE',
        montantPoints: -pointsEntry.montantPoints,
        raison: 'RETOUR',
        motif: `Annulation retour ${factureId}`
      }
    });
    
    // Update client
    await prisma.client.update({
      where: { id: facture.clientId },
      data: {
        pointsFidelite: { decrement: pointsEntry.montantPoints }
      }
    });
  }
}
```
**Fix Effort**: 4h

#### BUG-007: Export Sage insuffisant

**Solution**:
```typescript
// Améliorer filtrage
async generateSageExport(filter: {
  dateStart: Date;
  dateEnd: Date;
  centreId: string;
  exportComptable?: boolean;
}) {
  const factures = await prisma.facture.findMany({
    where: {
      centreId: filter.centreId,
      dateEmission: { gte: filter.dateStart, lte: filter.dateEnd },
      statut: { in: ['VALIDE', 'PAYEE'] },
      exportComptable: filter.exportComptable !== false,
      type: 'FACTURE'  // Only fiscal invoices
    }
  });
  // ...
}
```
**Fix Effort**: 3h

#### BUG-008: Stock alert hardcodé

**Solution**:
```typescript
// Rendre seuil configurable
model ProductConfiguration {
  seuilAlertPercentage: Float @default(20)  // 20% du stock normal
}

// Usage:
if (product.quantiteActuelle < (product.quantiteNormale * config.seuilAlertPercentage / 100)) {
  alert!
}
```
**Fix Effort**: 2h

---

### 🟡 MOYENNE (À considérer)

#### BUG-009 + BUG-010 + BUG-011 + BUG-012

| Bug | Solution Rapide |
|-----|---|
| **BUG-009** (PDF slow) | Streaming + pagination / Worker queue |
| **BUG-010** (Cache) | Redis invalidation sur points update |
| **BUG-011** (i18n) | Extraire templates en BD + i18n key |
| **BUG-012** (Antivirus) | ClamAV service + scan on upload |

**Total Fix Effort**: 20h  
**Timeline**: Phase 2 (Juillet 2026)

---

## 🚀 FEATURES À IMPLÉMENTER

### Phase 1 (Juin 2026) - Stabilité & Security

```
PRIORITÉ 1 (Semaine 1-2):
[ ] Corriger BUG-001 à 004 (data leak, stock, commission)
[ ] Audit de sécurité complet (centre isolation)
[ ] Tests unitaires 50% minimum
[ ] Validation Prisma strict schema

PRIORITÉ 2 (Semaine 3-4):
[ ] Corriger BUG-005 à 008
[ ] Améliorer logging/audit trail
[ ] Performance optimizations (indexation)
[ ] Documentation inline code (50% coverage)

PRIORITÉ 3 (Semaine 5-6):
[ ] Corriger BUG-009 à 012
[ ] E2E tests workflow vente
[ ] Cache layer setup
[ ] API documentation (Swagger)
```

### Phase 2 (Août 2026) - Fonctionnalités Avancées

```
OPTIQUE:
[ ] OCR ordonnances (API Tesseract)
[ ] Virtual try-on (3D engine)
[ ] IA suggestions (ML model + recommenders)

LOYALTY:
[ ] SMS campaigns (SMS API Maroc)
[ ] Gamification (badges, challenges)
[ ] Parrainage system upgrade

PAYROLL 2025:
[ ] Update régime fiscal 2025 (LF 2025/2026)
[ ] Signature électronique bulletins
[ ] CNSS e-service intégration

STOCK:
[ ] Mobile app scanning (React Native)
[ ] Prévisions stock (forecasting model)
[ ] Multi-warehouse transfers
```

### Phase 3 (Octobre 2026) - Integration Complète

```
FISCAL:
[ ] Alternative Sage export (CIEL, Tally)
[ ] Déclaration TVA (SIMPL export)
[ ] IS annual reporting

TREASURY:
[ ] Trésorerie forecasting
[ ] Bank reconciliation automatique
[ ] Cash flow analysis

ANALYTICS:
[ ] BI dashboards (Metabase/Superset)
[ ] Predictive analytics
[ ] Anomaly detection
```

---

## 📋 CHECKLIST IMPLÉMENTATION (Par Module)

### ✅ MODULES PRODUCTIFS

```
✅ AUTH/USERS
   ├─ Login/Logout
   ├─ JWT Auth
   ├─ Role-based access
   └─ User management CRUD

✅ CENTERS/GROUPS
   ├─ Multi-site support
   ├─ Data isolation
   ├─ Hierarchy management
   └─ User-center mapping

✅ FACTURES
   ├─ DEVIS generation
   ├─ DEVIS→BC transition
   ├─ BC→FACTURE validation
   ├─ Avoir creation
   └─ Status management

✅ CAISSE/PAIEMENTS
   ├─ Payment modes (ESPECES, CARTE, CHEQUE, VIREMENT)
   ├─ Stock guard check
   ├─ Commission trigger
   ├─ OperationCaisse creation
   └─ JourneeCaisse updates

✅ STOCK
   ├─ Product CRUD
   ├─ Quantity tracking
   ├─ Alert system
   ├─ Movement history
   └─ Warehouse management

✅ ACCOUNTING
   ├─ Sage export (TSV)
   ├─ Balance sheet generation
   ├─ Journal entries
   └─ Account mapping
```

### ⚠️ MODULES À VALIDER

```
⚠️ LOYALTY
   ✅ Points earning
   ✅ Points history
   ❌ Rewards redemption
   ❌ Expiration handling
   ❌ Return impact

⚠️ PAYROLL
   ✅ Salary calculation (pre-2025)
   ⚠️ 2025 regime (partial)
   ✅ Payslip generation
   ❌ CNSS export
   ❌ Email delivery

⚠️ MARKETING
   ⚠️ Campaign CRUD
   ❌ SMS sending (not configured)
   ⚠️ Email campaigns
   ❌ Analytics tracking

⚠️ ATTENDANCE
   ✅ Check-in/out
   ❌ Auto retenues
   ❌ Holiday management
   ❌ Timesheet approval
```

### ❌ MODULES INCOMPLETS

```
❌ GLASS_PARAMETERS
   - Paramètres stockés
   ❌ OCR extraction (not implemented)
   ❌ IA suggestions (not implemented)
   ❌ Virtual try-on (not implemented)

❌ NOTIFICATIONS
   ✅ Email templates
   ❌ SMS templates (not configured)
   ❌ Push notifications
   ❌ Webhooks

❌ UPLOADS
   ✅ File storage
   ❌ Antivirus scanning
   ❌ Document OCR
   ❌ S3 integration

❌ IMPORTS
   ✅ CSV parsing
   ✅ Validation
   ❌ Mapping UI
   ❌ Error handling details
```

---

## 🔍 POINTS CRITIQUES À VALIDER

### 1. Multi-Tenancy & Security

**Tests Requis**:
- [ ] User A ne peut pas voir données User B
- [ ] Centre A data isolée de Centre B
- [ ] Warehouse access per role
- [ ] SQL injection prevention
- [ ] XSS prevention

**Command**:
```bash
npm run test:security
npm run test:multi-tenancy
```

### 2. Transactions & Data Integrity

**Tests Requis**:
- [ ] Paiement + Stock decrement atomic
- [ ] Commission calc + Payroll atomic
- [ ] BON_LIVRAISON + Mouvement stock atomic
- [ ] Rollback on error

**Command**:
```bash
npm run test:transactions
npm run test:concurrency
```

### 3. Audit Trail & Compliance

**Logs À Vérifier**:
- [ ] Toutes créations/modifications enregistrées
- [ ] User audit (qui a modifié quoi)
- [ ] Timestamp systématique
- [ ] Impossible de modifier logs

**Command**:
```bash
npm run test:audit
```

### 4. Performance & Scalability

**Benchmarks**:
- [ ] Facture list < 1s (1000 items)
- [ ] Stock query < 500ms
- [ ] Report generation < 5s
- [ ] Concurrent users: 50+

**Command**:
```bash
npm run perf:benchmark
npm run load:test -- --users 50
```

---

## 📞 CONTACTS & ESCALATION

### Support Technique

| Domaine | Contact | Disponibilité |
|---------|---------|--|
| **Architecture** | (Lead Dev) | Lundi-Vendredi 9-17h |
| **Optique/Métier** | (Business Analyst) | Lundi-Vendredi 10-16h |
| **DB/Performance** | (DBA) | On-demand |
| **Sécurité** | (Security Team) | On-demand |
| **Paie/Fiscal** | (Comptable) | Mardi-Jeudi 14-17h |

### Escalation

```
Level 1: Developer → Team Lead
Level 2: Team Lead → Architect
Level 3: Architect → CTO
Level 4: CTO → Board (critical)
```

---

## 📚 RESSOURCES & RÉFÉRENCES

### Documentation Interne

- [Architecture.md](../ARCHITECTURE.md)
- [README.docker.md](../README.docker.md)
- [Setup Guide](../SETUP.md)

### External Resources

- [Prisma Docs](https://www.prisma.io/docs/)
- [NestJS Docs](https://docs.nestjs.com/)
- [Moroccan Tax (2025)](https://www.tax.gov.ma/)
- [Payment APIs (Maroc)](https://stripe.com/docs)

### Tools

```bash
# Local dev
npm run dev
npm run test
npm run lint

# Database
npm run db:migrate
npm run db:seed
npm run db:studio

# Production
npm run build
npm run start:prod
```

---

## ✨ NEXT STEPS

### Immédiatement (Today)

- [ ] Lire ANALYSE_COMPLETE_38_MODULES (3 parts)
- [ ] Identifier bugs critiques (BUG-001 à 004)
- [ ] Setup test environment
- [ ] Assign ownership par module

### Cette Semaine

- [ ] Corriger data leak + security issues
- [ ] Setup CI/CD pipeline
- [ ] Add unit tests (min 50%)
- [ ] Code review architecture

### Ce Mois

- [ ] Stabiliser production (bugs)
- [ ] Performance optimization
- [ ] Documentation inline (50%)
- [ ] Prepare Phase 2 features

### Roadmap 6 Mois

```
Juin 2026: Stabilité + Sécurité (Phase 1)
Août 2026: Features avancées (Phase 2)
Octobre 2026: Intégrations complètes (Phase 3)
Décembre 2026: AI + Analytics (Phase 4)
```

---

## 🎯 CONCLUSION

### Documentation Livrée

✅ **33,000+ lignes** d'analyse exhaustive  
✅ **38/38 modules** documentés complètement  
✅ **Workflows** décrits avec code examples  
✅ **Interconnections** mappées globalement  
✅ **Bugs** identifiés et priorizés  
✅ **Roadmap** planifiée (6 mois)

### Prochaines Actions

1. **Immédiat**: Lire documentation (ce jour)
2. **Jour 1**: Identifier priorités avec team
3. **Jour 2**: Assigner ownership + sprints
4. **Jour 3**: Lancer corrections bugs critiques

### Support

Pour toute question:
- 📧 Email: dev-team@optisaas.ma
- 💬 Slack: #development
- 📞 Phone: (212) XXX-XXX-XXX

---

**Document Finalisé**: 2026-04-19  
**Status**: ✅ LIVRÉ EXHAUSTIF  
**Version**: 1.0  
**Next Review**: 2026-06-01

*Fin de la documentation complète OptiSaas ERP*
