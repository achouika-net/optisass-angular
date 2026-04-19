# ✅ CHECKLIST IMPLÉMENTATION - AVANT DE CODER

**Usage**: Avant de démarrer ANY feature

---

## 🎯 PHASE 1: COMPRÉHENSION (NON-NÉGOCIABLE)

- [ ] **Feature bien définie**
  - [ ] Description user story (5-10 lignes)
  - [ ] Acceptance criteria listé (3+ points)
  - [ ] Link vers issue/ticket

- [ ] **Spécification métier**
  - [ ] Feature est dans SPECIFICATION_FINALE_OPTISAAS.md?
  - [ ] Toutes les règles métier lues?
  - [ ] Questions métier clarifiées avec PM?

- [ ] **API/Endpoints documentés**
  - [ ] Endpoint existe dans ANALYSE_OPTISAAS_COMPLETE.json?
  - [ ] Method HTTP correct (GET/POST/PUT/DELETE)?
  - [ ] Path params et query params clairs?
  - [ ] Request/Response formats définis?

- [ ] **DTOs & Validations**
  - [ ] CreateXxxDto défini dans DTOCS_MODELES.md?
  - [ ] Tous les validators présents (Min, Max, Pattern)?
  - [ ] Messages erreur en français?

- [ ] **Data Models**
  - [ ] Entité Prisma existante ou nouvelle?
  - [ ] Si nouveau: modèle schéma défini?
  - [ ] Toutes les relations claires?

---

## 🔒 PHASE 2: SÉCURITÉ & MULTI-TENANT

**OBLIGATOIRE pour TOUS les endpoints:**

- [ ] **Multi-tenant Isolation**
  - [ ] Feature filtrée par centreId?
  - [ ] Where clause inclut: `where: { centreId: userCentreId, ... }`?
  - [ ] Aucune données cross-centre possible?
  - [ ] Test: 2 centres, vérifier isolation?

- [ ] **Permissions & RBAC**
  - [ ] Rôle required défini (@Auth(roles: [...]))?
  - [ ] Non-admin ne peut pas bypasss?
  - [ ] Audit qui a fait l'action?

- [ ] **Validations Input**
  - [ ] All inputs validés DTOs (backend + frontend)?
  - [ ] Pas d'injection SQL possible?
  - [ ] Pas de XSS possible?

- [ ] **Audit Trail**
  - [ ] userId du qui a créé/modifié tracé?
  - [ ] Timestamp inclus?
  - [ ] Avant/après log si mutation sensible?

---

## 💼 PHASE 3: RÈGLES MÉTIER

**Dépend du module, vérifier si applicable:**

### Factures/Paiements
- [ ] Validations montant (> 0, ≤ max)?
- [ ] Transitions statut autorisées (DEVIS → PAYEE → SOLDEE)?
- [ ] Stock check AVANT paiement?
- [ ] Points fidélité calculés (0.1/DH)?
- [ ] Commission vendeur calculée?
- [ ] TVA appliquée (20%)?
- [ ] **ATOMIC TRANSACTION** (pas de partial state)?

### Stock/Mouvements
- [ ] Quantité jamais negative?
- [ ] Entrepôt source ≠ destination si transfert?
- [ ] Alerte si quantité < seuil?
- [ ] Historique mouvements tracé?

### Fidélité/Choukra
- [ ] Points lockés si client blacklisté?
- [ ] Bonus parrainage appliqué (parraineur +50, parrainé +20)?
- [ ] Conversion 10 pts = 1 DH exact?
- [ ] Pas de double point pour même facture?

### Commissions/Paie
- [ ] Commission créée uniquement si Facture PAYEE?
- [ ] Montant = HT × taux par type article?
- [ ] Taux: MONTURE 5-8%, VERRE 2-3%, LENTILLE 3-5%?
- [ ] Mois comptabilisé correct (YYYY-MM)?

### Caisse
- [ ] Mode paiement tracé (ESPECES, CARTE, CHEQUE, VIREMENT)?
- [ ] Référence chèque/virement sauvegardée?
- [ ] Solde caisse jamais negative?

---

## 🏗️ PHASE 4: IMPLÉMENTATION BACKEND

### Structure
- [ ] Service créé: `src/modules/[module]/[module].service.ts`
- [ ] Controller créé: `src/modules/[module]/[module].controller.ts`
- [ ] Module créé: `src/modules/[module]/[module].module.ts`
- [ ] DTOs importés: `src/modules/[module]/dto/`

### Patterns
- [ ] Service injecte PrismaService?
- [ ] Controller injecte Service?
- [ ] @Param/@Query/@Body décorateurs utilisés?
- [ ] HttpException pour erreurs (pas de console.error)?

### Transactions
- [ ] Multi-step logic utilise Prisma.$transaction?
  ```typescript
  return this.prisma.$transaction(async (tx) => {
    // Multiple operations atomically
  });
  ```
- [ ] En cas d'erreur, tout rollback?

### Validations
- [ ] CreateXxxDto appliqué au POST?
- [ ] Validateur execute avant service (class-validator)?
- [ ] Erreur validation retourne 400 (pas 500)?

### Testing
- [ ] Service unit tests: `[name].service.spec.ts`?
- [ ] Cas nominal teste?
- [ ] Cas erreur teste?
- [ ] Multi-tenant isolation teste?
- [ ] Couverture > 80%?

---

## 🎨 PHASE 5: IMPLÉMENTATION FRONTEND

### Composants
- [ ] Component créé: `src/app/features/[module]/[name].component.ts`
- [ ] Template créé: `[name].component.html`
- [ ] Style créé: `[name].component.scss`
- [ ] Module déclaré dans module parent?

### Reactive Forms
- [ ] FormGroup/FormControl créés?
- [ ] Validators appliqués (Validators.required, etc.)?
- [ ] Custom validators si besoin?
- [ ] Messages erreur affichés?

### Services & API
- [ ] Service créé: `[module].service.ts`
- [ ] HttpClient utilisé pour API calls?
- [ ] Endpoint URL correspond à backend?
- [ ] RxJS operators utilisés (tap, catchError, etc.)?

### UI/UX
- [ ] Responsive (Material Breakpoints)?
- [ ] Loading spinner pendant requête?
- [ ] Message erreur affiché (snackbar/toast)?
- [ ] Message succès affiché?
- [ ] Désactiver submit button pendant requête?
- [ ] Textes en français?

### Validations Affichage
- [ ] Invalid field highlight (rouge border)?
- [ ] Error message inline?
- [ ] Real-time validation si applicable?

### Testing
- [ ] Component unit tests: `[name].component.spec.ts`?
- [ ] Service unit tests: `[name].service.spec.ts`?
- [ ] Cas nominal teste?
- [ ] Cas erreur teste?
- [ ] Couverture > 80%?

---

## 🔗 PHASE 6: INTÉGRATION

### Backend-Frontend
- [ ] API call correcte (URL, method, headers)?
- [ ] Request data format match DTO?
- [ ] Response data parsed correctement?
- [ ] Error handling côté frontend?

### Database
- [ ] Migration Prisma créée si schéma change?
  ```bash
  npx prisma migrate dev --name [name]
  ```
- [ ] Schema.prisma validé?
- [ ] Pas d'erreur DB on test data?

### Configuration
- [ ] Environment variables`.env` si besoin?
- [ ] Secrets pas committés?
- [ ] Deploys modes testes (dev, staging, prod)?

---

## ✔️ PHASE 7: TESTING COMPLET

### Manual Testing
- [ ] Feature fonctionne en 1 centre?
- [ ] Feature isolée multi-centre (data pas cross-centre)?
- [ ] Erreurs handled gracefully?
- [ ] Performance acceptable (<200ms par API call)?

### Edge Cases
- [ ] Données vides?
- [ ] Données très grande (1000+ items)?
- [ ] Valeurs limites (min, max)?
- [ ] Caractères spéciaux (accents, arabique)?
- [ ] Timezone differences?

### Security Tests
- [ ] User A ne peut pas voir data User B?
- [ ] Admin override fonctionne si needed?
- [ ] Injection SQL impossible?
- [ ] XSS impossible?

---

## 📝 PHASE 8: DOCUMENTATION

- [ ] Code commenté (logique métier complexe)?
- [ ] JSDoc pour public methods?
- [ ] README.md si nouveau module?
- [ ] Feature documentée dans SPECIFICATION_FINALE si applicable?
- [ ] Endpoint documenté en API docs (Swagger)?

---

## 🚀 PHASE 9: CODE REVIEW PREPARATION

- [ ] Code lintée: `npm run lint -- --fix`?
- [ ] Formatée: Prettier auto-applied?
- [ ] No console.log/console.error au deploy?
- [ ] No commented code?
- [ ] No TODO sans context?
- [ ] PR description complète?
  - Quoi changé?
  - Pourquoi?
  - Comment tester?
  - Screenshots si UI?

---

## ✅ PHASE 10: FINAL CHECKLIST

- [ ] All tests passing: `npm run test`?
- [ ] Build passes: `npm run build`?
- [ ] No TypeScript errors?
- [ ] No linting errors?
- [ ] Feature complètement implémentée vs AC?
- [ ] Aucune brique manquante?
- [ ] Documentation à jour?
- [ ] Prêt pour production?

---

## 🎯 CHECKLIST RAPIDE (TL;DR)

```
AVANT CODER:
□ Feature bien définie
□ Rules métier comprises
□ DTOs définis
□ Endpoints documentés
□ Multi-tenant plan

EN CODANT:
□ Filtrer centreId (sécurité)
□ Validations complètes (DTOs)
□ Transactions atomiques (complexe)
□ Audit trail (userId)
□ Tests > 80%

AVANT MERGE:
□ Linting OK
□ Tests OK
□ PR description complète
□ Code review autorisée
```

---

## 📞 BESOIN D'AIDE?

| Question | Réponse Où |
|----------|-----------|
| Règle métier? | SPECIFICATION_FINALE section 5 |
| API endpoint? | ANALYSE_OPTISAAS_COMPLETE.json |
| DTO validation? | DTOCS_MODELES.md |
| Workflow? | FLUX_PROCESSUS.md |
| Common error? | TROUBLESHOOTING.md |
| FAQ? | FAQ_COMMUNES.md |

---

**Bon code! ✅**
