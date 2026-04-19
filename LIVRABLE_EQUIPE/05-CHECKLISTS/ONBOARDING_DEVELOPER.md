# 👋 CHECKLIST ONBOARDING - NOUVEAU DÉVELOPPEUR

**Durée**: ~2-3 heures au démarrage + 1 semaine apprentissage continu

---

## 📅 JOUR 1 (1.5 heures)

### ✅ Setup Local (30 min)
- [ ] Clone repo: `git clone [url]`
- [ ] Install deps: `npm install` (backend + frontend)
- [ ] Create `.env` avec DB credentials
- [ ] `docker-compose up -d` (DB PostgreSQL)
- [ ] Backend: `npm start` → http://localhost:3000/api
- [ ] Frontend: `npm start` → http://localhost:4200
- [ ] Vérifier zéro erreurs console
- [ ] **Checkpoint**: 2 terminaux actifs, 0 erreurs

### ✅ Lire Documentation (45 min)
- [ ] **[../01-GUIDES_RAPIDES/QUICKSTART_5MIN.md](../01-GUIDES_RAPIDES/QUICKSTART_5MIN.md)** (5 min)
- [ ] **Votre guide rapide** (15 min):
  - Backend? → [../01-GUIDES_RAPIDES/POUR_DEVELOPER_BACKEND.md](../01-GUIDES_RAPIDES/POUR_DEVELOPER_BACKEND.md)
  - Frontend? → [../01-GUIDES_RAPIDES/POUR_DEVELOPER_FRONTEND.md](../01-GUIDES_RAPIDES/POUR_DEVELOPER_FRONTEND.md)
- [ ] **[../03-SPECIFICATIONS/SPECIFICATION_FINALE_OPTISAAS.md](../03-SPECIFICATIONS/SPECIFICATION_FINALE_OPTISAAS.md)** (10 min):
  - Section 1: Présentation générale
  - Section 2: Architecture (votre stack)
  - **Checkpoint**: Comprendre l'overview

### ✅ Déboguer IDE (15 min)
- [ ] VSCode extensions installées:
  - [ ] Prisma (prisma.prisma)
  - [ ] Prettier
  - [ ] ESLint
  - [ ] TypeScript
- [ ] Format file: Cmd+Shift+P → Format Document
- [ ] Pas d'erreurs rouges dans VSCode
- [ ] **Checkpoint**: IDE prêt

---

## 📅 JOUR 2 (1.5 heures)

### ✅ Comprendre Codebase (45 min)

**Backend (si vous êtes backend dev)**:
```bash
# Ouvrir VSCode
code backend/

# Navigation:
- backend/src/main.ts         → Point d'entrée
- backend/src/modules/        → 32 services (factures, clients, etc.)
- backend/prisma/schema.prisma → BD schéma (24 models)

# Lire 3 modules simples (progressif):
1. backend/src/modules/products/
2. backend/src/modules/clients/
3. backend/src/modules/factures/  (plus complexe)
```

**Frontend (si vous êtes frontend dev)**:
```bash
# Ouvrir VSCode
code frontend/

# Navigation:
- frontend/src/app/         → App root
- frontend/src/app/features/   → 18 modules UI
- frontend/src/app/core/    → Services partagés

# Inspecter 3 modules simples:
1. src/app/features/authentication/
2. src/app/features/commercial/
3. src/app/features/finance/     (plus complexe)
```

- [ ] Analyser au moins 3 fichiers existants (comprendre patterns)
- [ ] Vérifier nommage conventions (camelCase, PascalCase)
- [ ] Noter questions pour mentor

### ✅ Consulter Spécifications (30 min)
- [ ] **[../03-SPECIFICATIONS/DTOCS_MODELES.md](../03-SPECIFICATIONS/DTOCS_MODELES.md)**:
  - Lire DTOs pour 3 entités clés (Client, Facture, Product)
  - Voir validations (Min, Max, Pattern)
  - **Checkpoint**: Comprendre DTOs

- [ ] **[../02-DOCUMENTATION_TECHNIQUE/FLUX_PROCESSUS.md](../02-DOCUMENTATION_TECHNIQUE/FLUX_PROCESSUS.md)**:
  - Lire Flux 1: Cycle Vente
  - **Checkpoint**: Comprendre workflow client

### ✅ Tests Locaux (15 min)
- [ ] Backend: `npm run test` (au moins 1 test passe)
- [ ] Frontend: `npm run test` (au moins 1 test passe)
- [ ] Vérifier couverture tests (> 50% cible)
- [ ] Lire 1 test unitaire (comprendre pattern)

---

## 📅 SEMAINE 1 (Continu)

### ✅ Mentoring Sessions (Planifier)
- [ ] 30 min: Overview architecture avec mentor
- [ ] 30 min: Q&A codebase
- [ ] 30 min: Review premier PR

### ✅ Premiers Commits
- [ ] Créer branche: `git checkout -b feat/onboarding-task-[votre-nom]`
- [ ] **Task facile recommandée**:
  - Backend: Ajouter validation champ à un DTO existant
  - Frontend: Ajouter bouton/input simple à écran existant
- [ ] Commit + Push
- [ ] Créer PR avec description détaillée
- [ ] Recueillir feedback mentor
- [ ] Merge après approbation

### ✅ Immersion Continue
- [ ] 1 heure: Explorer module "clients" (CRUD basique)
- [ ] 1 heure: Explorer module "factures" (logique complexe)
- [ ] 30 min: Lire audit trail code (sécurité)
- [ ] **Checkpoint**: Comfort level +30%

---

## 🆘 SI VOUS ÊTES BLOQUÉ

### Setup Issues
| Problème | Solution |
|----------|----------|
| DB connection refusée | Vérifier `.env` vs `docker-compose.yml` |
| Port 3000 déjà utilisé | `lsof -i :3000` puis `kill -9 [PID]` |
| Dépendances NPM erreur | `rm -rf node_modules package-lock.json && npm install` |

### Code Issues
| Problème | Solution |
|----------|----------|
| Import path refusé | Vérifier chemins relatifs dans `tsconfig.json` |
| Type erreur TypeScript | Consulter `DTOCS_MODELES.md` pour types corrects |
| Validation échoue | Lire règles dans `SPECIFICATION_FINALE section 7` |

### Docmentation Issues
| Problème | Solution |
|----------|----------|
| Endpoint pas trouvé | Consulter `ANALYSE_OPTISAAS_COMPLETE.json` |
| Règle métier unclear | Lire `SPECIFICATION_FINALE section 5` |
| Workflow pas clair | Consulter `FLUX_PROCESSUS.md` |

---

## 📞 CONTACTS & RESSOURCES

### Documentation
- Spécifications: [../03-SPECIFICATIONS/](../03-SPECIFICATIONS/)
- Tech Docs: [../02-DOCUMENTATION_TECHNIQUE/](../02-DOCUMENTATION_TECHNIQUE/)
- FAQ: [../04-RESSOURCES/FAQ_COMMUNES.md](../04-RESSOURCES/FAQ_COMMUNES.md)
- Troubleshooting: [../04-RESSOURCES/TROUBLESHOOTING.md](../04-RESSOURCES/TROUBLESHOOTING.md)

### Slack/Discord Channels
- #general → Questions générales
- #backend → Tech backend NestJS
- #frontend → Tech frontend Angular
- #help → Débogages

### Mentors Assignés
- Backend Dev → Mentor: [À remplir]
- Frontend Dev → Mentor: [À remplir]

---

## 🎓 LEARNING PATH (Progression)

### Week 1
```
✓ Setup + Documentation
✓ Premiers commits simples
✓ Comprendre 1 module simple
```

### Week 2
```
✓ Ajouter feature simple (1-2 endpoints ou écrans)
✓ Écrire tests unitaires
✓ Merger 1-2 PRs
```

### Week 3-4
```
✓ Implémenter feature medium (avec validations)
✓ Gérer multi-tenant isolation
✓ Implémenter transaction atomique (si backend)
✓ Merger 3-4 PRs
```

### Week 5+
```
✓ Autonome pour features complexes
✓ Mentor pour nouveaux devs
✓ Contribuer architecture decisions
```

---

## ✅ VALIDATION CHECKPOINT

**Fin Week 1, vous devez connaître:**

- [ ] Folder structure (backend/frontend)
- [ ] 5 modules clés (clients, factures, produits, paiements, stock)
- [ ] Pattern code (service→controller, component→service)
- [ ] DTOs & validations
- [ ] Multi-tenant isolation (filtrage centreId)
- [ ] Comment lancer tests
- [ ] Où chercher documentation
- [ ] Comment déboguer
- [ ] Où chercher quand vous êtes bloqué

**Si OUI sur tous**: Vous êtes officiellement onboardé ✅

---

## 🚀 NEXT STEPS

1. **Attendre première task assignée** par team lead
2. **Start avec issues label "good-first-issue"**
3. **Participer code review** (observer puis contribuer)
4. **Poser questions** (pas de question bête!)

---

**Bienvenue dans l'équipe! 🎉**

Questions? Demander mentor ou consulter [../04-RESSOURCES/FAQ_COMMUNES.md](../04-RESSOURCES/FAQ_COMMUNES.md)
