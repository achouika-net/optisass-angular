# 👨‍💻 GUIDE RAPIDE - DÉVELOPPEUR BACKEND

**Temps de lecture**: 15 minutes  
**Objectif**: Comprendre l'architecture et démarrer le développement

---

## 🎯 RÉSUMÉ EN 30 SECONDES

OptiSaas = Plateforme gestion centres optiques

**Tech Stack**: NestJS (TypeScript) + PostgreSQL (Prisma) + Docker

**Architecture**: 32 modules métier indépendants + API REST

**Votre travail**: Implémenter les services métier avec validations complètes

---

## 🏗️ STRUCTURE QUE VOUS ALLEZ RENCONTRER

```
backend/src/features/
├── factures/              ← Documents (Devis/Factures/Avoirs)
├── clients/               ← Base clients
├── fiches/                ← Dossiers optiques clients
├── paiements/             ← Encaissements
├── loyalty/               ← Points fidélité
├── stock-movements/       ← Mouvements stock
├── products/              ← Catalogue
├── caisse/                ← Gestion caisse
├── journee-caisse/        ← Caisse quotidienne
├── personnel/             ← Employés + commissions
├── payroll/               ← Bulletins paie
├── accounting/            ← Exports Sage
└── [+ 20 autres modules...]

Chaque module = {
  ├── *.controller.ts      ← Routes API (@Get, @Post, etc.)
  ├── *.service.ts         ← Logique métier
  ├── *.module.ts          ← Configuration
  ├── dto/                 ← Data Transfer Objects
  └── entities/            ← Types Prisma
}
```

---

## 📊 3 MODULES CRITIQUES (À MAÎTRISER)

### 1. Factures
```typescript
// Vous devrez implémenter:
- Numérotation atomique (DV/BC/FAC/AV uniques)
- États contrôlés (DEVIS_EN_COURS → VALIDEE → PAYEE → SOLDEE)
- Vérification stock AVANT validation
- TVA automatique 20%
- Points fidélité auto-attribués

Endpoints clés:
POST   /factures              (créer)
GET    /factures/:id          (voir)
PUT    /factures/:id          (modifier)
POST   /factures/:id/validate (valider + checker stock)
```

### 2. Stock-Movements
```typescript
// Vous devrez implémenter:
- 5 types mouvements: ENTREE, SORTIE, TRANSFERT, RETOUR, CONFECTION
- Vérification quantité disponible
- Mise à jour auto de Product.quantiteActuelle
- Alertes stock bas

Triggers auto:
- Facture PAYEE → MouvementStock SORTIE créé
- BonLivraison reçu → MouvementStock ENTREE créé
```

### 3. Paiements
```typescript
// Vous devrez implémenter:
- Enregistrement paiement (4 modes: ESPECES, CARTE, CHEQUE, VIREMENT)
- Auto-création OperationCaisse
- Auto-création PointsHistory
- Auto-calcul Commission
- Auto-update Facture.resteAPayer

Validation:
- montant ≤ resteAPayer
- mode cohérent
```

---

## 🔑 RÈGLES MÉTIER ESSENTIELLES

### Validations Obligatoires
```typescript
// Avant chaque opération:
✓ Entités existent (Client, Centre, Fournisseur)
✓ Montants logiques (HT ≤ TTC, achat ≤ vente)
✓ Formats corrects (email, téléphone, SIRET)
✓ Transitions d'état autorisées
✓ Stock vérifié (si applicable)
✓ Multi-tenant isolé (where centreId = @tenant)
```

### Transactions Atomiques
```typescript
// Toujours utiliser prisma.$transaction():
const facture = await prisma.$transaction(async (tx) => {
  // 1. Créer facture
  const f = await tx.facture.create({ ... });
  
  // 2. Créer mouvements stock
  await tx.mouvementStock.create({ ... });
  
  // 3. Mettre à jour points
  await tx.pointsHistory.create({ ... });
  
  // 4. Retourner tout ou rien
  return f;
});
```

### Audit Trail
```typescript
// À logger TOUJOURS:
- User ID (qui a fait l'action)
- Timestamp exact
- Entity + ID
- Avant/après les modifications
- Centre concerné

Exemple:
{
  userId: "user-123",
  action: "UPDATE_FACTURE",
  entityId: "facture-456",
  changes: {
    statut: { avant: "DEVIS", après: "VALIDEE" }
  },
  centreId: "centre-001",
  timestamp: "2026-03-15T14:23:45Z"
}
```

---

## 💻 COMMANDES DE BASE

### Setup
```bash
# 1. Installer dépendances
npm install

# 2. Setup Prisma
npm run prisma:migrate

# 3. Générer client Prisma
npx prisma generate

# 4. Voir DB dans Prisma Studio
npx prisma studio
```

### Développement
```bash
# 1. Démarrer serveur
npm run start:dev

# 2. Tests
npm test

# 3. Build prod
npm run build
```

---

## 📚 DOCUMENTS À CONSULTER

### Urgent (À lire maintenant)
- **[../03-SPECIFICATIONS/SPECIFICATION_FINALE_OPTISAAS.md](../03-SPECIFICATIONS/SPECIFICATION_FINALE_OPTISAAS.md)**
  - Sections 3-5: Modèles données + Modules backend + Règles métier

### Important (À consulter avant de coder)
- **[../03-SPECIFICATIONS/DTOCS_MODELES.md](../03-SPECIFICATIONS/DTOCS_MODELES.md)**
  - Validations précises pour chaque DTO

### Référence (Garder à portée)
- **[../02-DOCUMENTATION_TECHNIQUE/MODELES_DONNEES.md](../02-DOCUMENTATION_TECHNIQUE/MODELES_DONNEES.md)**
  - Entités Prisma détaillées

---

## ⚡ PREMIERS PAS (1h)

### 30 min: Lecture
1. Lire [SPECIFICATION_FINALE_OPTISAAS.md](../03-SPECIFICATIONS/SPECIFICATION_FINALE_OPTISAAS.md) sections 3-4 (Modèles + Modules)
2. Comprendre le cycle vente (section 6.1)

### 20 min: Setup
1. `npm install`
2. `npm run prisma:migrate`
3. `npx prisma studio` (voir schéma)

### 10 min: Inspection
1. Ouvrir `/src/features/` dans VSCode
2. Consulter un module simple (ex: `products/`)
3. Comprendre la structure (controller, service, DTO, module)

---

## 🚨 PIÈGES COURANTS

### ❌ PAS BON
```typescript
// 1. Pas de transaction
const facture = await prisma.facture.create(...);
await prisma.stock.update(...);
// → Risque incohérence si crash

// 2. Pas d'isolation tenant
const documents = await prisma.facture.findMany();
// → Peut retourner autres centres!

// 3. Pas de validation
if (montant < 0) { } // Insuffisant!
// → Ajouter: @Min(0), @IsPositive(), etc.

// 4. Pas d'audit
await prisma.facture.update(...);
// → Aucune traçabilité!
```

### ✅ BON
```typescript
// 1. Avec transaction
const facture = await prisma.$transaction(async (tx) => {
  const f = await tx.facture.create(...);
  await tx.stock.update(...);
  return f;
});

// 2. Avec isolation
const docs = await prisma.facture.findMany({
  where: { centreId: userCentre }
});

// 3. Avec validation
@IsPositive()
@Min(0.01)
montant: number;

// 4. Avec audit
await auditService.log({
  action: 'UPDATE_FACTURE',
  entityId: facture.id,
  changes: { statut: { avant, après } }
});
```

---

## 🔐 SÉCURITÉ (CRITQUE!)

### Multi-tenant (OBLIGATOIRE)
```typescript
// TOUTES les queries DOIVENT filter par centreId
const factures = await prisma.facture.findMany({
  where: {
    centreId: req.user.centreId  // ← OBLIGATOIRE
  }
});

// JAMAIS faire:
const factures = await prisma.facture.findMany(); // ❌ DANGER!
```

### Validation DTOs
```typescript
// Toujours utiliser class-validator
export class CreateFactureDto {
  @IsUUID()
  clientId: string;
  
  @IsEnum(FactureType)
  type: FactureType;
  
  @IsPositive()
  @Min(0.01)
  totalTTC: number;
}
```

---

## 🧪 TESTING PATTERN

```typescript
describe('FacturesService', () => {
  it('should create facture and update stock', async () => {
    // 1. Setup
    const client = await createTestClient();
    
    // 2. Action
    const facture = await service.create({
      clientId: client.id,
      ...
    });
    
    // 3. Assertions
    expect(facture.numero).toBe('DV 000001');
    expect(facture.statut).toBe('DEVIS_EN_COURS');
    
    // 4. Vérifier side-effects
    const stock = await prisma.product.findUnique(...);
    // Stock ne devrait PAS baisser (seulement à VALIDEE)
  });
});
```

---

## 📞 HELP!

**"Facture ne crée pas OperationCaisse"**
→ Vérifier Paiement créé avant (trigger auto)

**"Stock négatif?"**
→ Vérifier transaction atomique + vérification avant VALIDEE

**"Points fidélité n'apparaissent pas"**
→ Vérifier Facture PAYEE (trigger à VALIDEE+PAYEE)

**"Commission n'est pas calculée"**
→ Vérifier Facture PAYEE + CommissionRule existe

→ Consulter: [04-RESSOURCES/TROUBLESHOOTING.md](../04-RESSOURCES/TROUBLESHOOTING.md)

---

## ✅ CHECKLIST AVANT DE CODER

- [ ] Lire [SPECIFICATION_FINALE_OPTISAAS.md](../03-SPECIFICATIONS/SPECIFICATION_FINALE_OPTISAAS.md) sections 3-5
- [ ] Consulter [DTOCS_MODELES.md](../03-SPECIFICATIONS/DTOCS_MODELES.md) pour validations
- [ ] Setup local: `npm install && npm run prisma:migrate`
- [ ] Ouvrir Prisma Studio: `npx prisma studio`
- [ ] Inspecter module existant pour pattern
- [ ] Lire 5 critères sécurité ci-dessus
- [ ] Prêt à développer ✅

---

## 🚀 BON CODE!

Questions? → Consulter [../04-RESSOURCES/FAQ_COMMUNES.md](../04-RESSOURCES/FAQ_COMMUNES.md)
