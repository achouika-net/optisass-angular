# ❓ FAQ QUESTIONS COMMUNES

**Consultez ceci avant d'asker!** (Les réponses y sont probablement)

---

## 🏪 MÉTIER OPTIQUE

### Q: C'est quoi une "Fiche"?
**A:** Dossier optique client = prescription oculaire
- Sphère (SPH): -20 à +20
- Cylindre (CYL): -8 à 0
- Axe: 0 à 180 degrés
- Valides 2 ans (expiration)

Exemple: `-3.50 sph, -0.75 cyl, 180 axe` = ordonnance optométriste

### Q: Différence entre Devis, Facture, Avoir?
**A:**
| Doc | Statut | Paiement | Stock |
|-----|--------|---------|-------|
| **Devis** | Proposition | ❌ Non | ❌ Non |
| **Facture** | Validée | ✓ Oui | ✓ Oui |
| **Avoir** | Remboursement | ✓ Négatif | ✓ Retour |

Flux: `DEVIS_EN_COURS` → `VALIDEE` → `PAYEE` → `SOLDEE`

### Q: Points fidélité Choukra c'est quoi?
**A:**
- **Accumulation**: +0.1 points par DH dépensé
- **Bonuses**:
  - Nouveau client: +20
  - Création fiche: +30
  - Parrainage: +50 (parraineur), +20 (parrainé)
- **Redemption**: 500 points = 50 DH remise
- **Réseau**: Client A → Client B (parrain/filleul)

### Q: Commission vendeurs comment ça marche?
**A:**
- **Calcul**: HT ligne × taux
- **Taux**:
  - Monture: 5-8%
  - Verre: 2-3%
  - Lentille: 3-5%
- **Condition**: Facture doit être PAYEE
- **Intégration**: Auto-ajoutée au bulletin de paie

### Q: Caisse quotidienne, c'est quoi?
**A:**
- Journal des paiements du jour
- Modes tracés: Espèces, Cartes, Chèques, Virements
- Clôture: Solde théorique vs réel rapproché
- Si écart > 5 DH: justification requise

---

## 💻 TECHNIQUE

### Q: Comment fonctionne multi-tenant?
**A:**
- Chaque centre = données totalement isolées
- **Règle**: ALL queries incluent: `where { centreId: userCentreId, ... }`
- Centre A ne voit JAMAIS données centre B
- Admin ne peut bypass isolation
- **Test**: Login centre A, rechercher client centre B = ❌ Empty

### Q: Erreur "Stock insuffisant" - pourquoi?
**A:**
Avant validation facture, système vérifie stock:
1. Récupère produit requis
2. Compare quantité disponible vs demandée
3. Si `dispo < demandé` → Erreur

**Solution**: Ajouter stock (acheter fournisseur) ou modifier facture

### Q: Pourquoi points fidélité pas appliqués?
**A:**
Points créés SEULEMENT si:
1. Facture en statut: `PAYEE`
2. Client existe et actif
3. Montant > 0
4. Pas déjà créé pour cette facture (idempotent)

**Debug**: Vérifier statut facture + check logs `PointsHistory`

### Q: TVA - elle s'ajoute comment?
**A:**
- **Calcul**: TTC = HT × 1.20
- **Automatique**: Système applique 20% sur validation
- **Deducible**: Si SIRET valide
- **Export**: Sage automatique pour comptabilité

### Q: Commission pas calculée - pourquoi?
**A:**
Commission créée seulement si:
1. Facture `PAYEE` ✓
2. Vendeur assigné ✓
3. Produits ont taux commission ✓
4. Mois comptable valide ✓

**Debug**: Vérifier facture statut + vendeur ID + produit taux

---

## 🔒 SÉCURITÉ

### Q: Puis-je voir données autre centre?
**A:** **NON** - Système rejette automatiquement
- Query filtrée par centreId
- Vous ne pouvez pas bypass (même comme admin)
- Tentatives loggées (sécurité)

### Q: Mes données sont-elles chiffrées?
**A:** ✓ En transit (HTTPS) + ✓ Stockée:
- Mots de passe: bcrypt
- Données sensibles: AES-256
- Backups: Chiffrés aussi

### Q: Qui peut voir mon audit trail?
**A:** Seulement:
- Vous (votre propre actions)
- Admin du centre (audit complet)
- Support technique (si ticket ouvert)
- Jamais autre utilisateur

### Q: Comment changer permission?
**A:** Admin du centre:
1. User management
2. Sélectionner user
3. Changer rôle (VENDEUR → MANAGER)
4. Sauvegarder
5. Action loggée dans audit

---

## 📊 DATA

### Q: Où sont les données stockées?
**A:** PostgreSQL Database
- Chiffré at rest
- Backups: quotidiens + archivés
- Restauration testée régulièrement
- Région: [TBD - à completer]

### Q: Comment exporter données?
**A:**
| Type | Method | Format |
|------|--------|--------|
| Factures | Dashboard → Export | CSV/Excel |
| Clients | Client List → Bulk | CSV |
| Reports | Reports menu | PDF/Excel |
| Comptabilité | Accounting → Sage Export | Sage XML |

**Restriction**: Seulement données votre centre

### Q: Combien de temps garder données?
**A:**
- Factures: 6 ans minimum (légal Morocco)
- Clients: Indéfini (ou suppression sur demande)
- Audit logs: 2 ans
- Backups: 90 jours archivés

---

## 🚀 DEPLOYMENT

### Q: Quand nouvelle version sort?
**A:**
- Schedule: [TBD - à completer]
- Notice: 1 semaine avant (email)
- Downtime: 0-5 min (no data loss)
- Déploiement auto (no action needed)

### Q: Mes données vont-elles perdre?
**A:** **NON**
- Backups automatiques AVANT déploiement
- Migrations testées (DB stays compatible)
- Rollback possible si problème
- Zero data loss guarantee

### Q: App lent après déploiement - pourquoi?
**A:**
1. Cache en train de rebuild → Attendre 5 min
2. DB indexes en train d'optimizer → Attendre 10 min
3. Cache cloudflare stale → Ctrl+Shift+Delete
4. Bug réel → Contact support

### Q: Comment reporter bug?
**A:**
1. Prendre screenshot + steps
2. Consulter [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
3. Si non-résolu: Support ticket
4. Include: Centre ID, exact error, browser/version

---

## 🛠️ USAGE

### Q: Comment créer nouveau utilisateur?
**A:**
Admin center:
1. Settings → Users
2. "Ajouter Utilisateur"
3. Email + Name + Role
4. Confirmation email envoyée
5. User set password on first login

### Q: Password oublié - quoi faire?
**A:**
1. Login page → "Mot de passe oublié"
2. Email reçu avec lien reset (expire 24h)
3. Cliquer link → Entrer nouveau password
4. Login à nouveau

**Admin**: Peut reset password de quelqu'un d'autre

### Q: Puis-je être admin 2 centres?
**A:** ✓ **Oui**
- Vous êtes assigned à centre A + B
- Vous switchez entre centres (dropdown)
- Données strictement séparées par centre
- Audit trail montre quel centre par action

### Q: Comment changer paramètres centre?
**A:**
Settings → [Centre name] Configuration:
- Horaires ouverture
- Logo/couleurs
- Conventions avec fournisseurs
- Politiques remboursement
- Taux commission
- Etc.

**Permission**: Admin only

---

## 📞 SUPPORT

### Q: Erreur "Multi-tenant isolation failed"?
**A:** Contact support immédiatement! 🚨
- Incident de sécurité potentiel
- Données pas leaking (système refusé)
- Logs sauvegardés pour investigation

### Q: Endpoint 404 not found?
**A:**
1. Vérifier URL spelling
2. Vérifier API version (/api/v1 vs /v2)
3. Vérifier centreId dans header
4. Vérifier authentification (JWT valid)
5. Check [ANALYSE_OPTISAAS_COMPLETE.json](../03-SPECIFICATIONS/ANALYSE_OPTISAAS_COMPLETE.json)

### Q: Validation erreur pas claire?
**A:**
1. Lire erreur message (souvent descriptive)
2. Consulter [DTOCS_MODELES.md](../03-SPECIFICATIONS/DTOCS_MODELES.md) for validations
3. Vérifier inputs match DTO type
4. Contact support if unclear

---

## 🎓 APPRENTISSAGE

### Q: Par où commencer?
**A:** 
1. [QUICKSTART_5MIN.md](../01-GUIDES_RAPIDES/QUICKSTART_5MIN.md)
2. Votre guide rapide (Backend/Frontend/PM)
3. [ONBOARDING_DEVELOPER.md](../05-CHECKLISTS/ONBOARDING_DEVELOPER.md)
4. Consulter checklists avant chaque action

### Q: Documentation pas à jour?
**A:** 
- Version docs: [Last updated: 2026-01-15]
- Report: [Contact]: support@optisaas.com
- Chercher: Ctrl+F docs (souvent réponse dedans)

### Q: Besoin exemple code?
**A:**
- Consulter modules existants: `/src/modules/[name]/`
- Backend pattern: Service → Controller → Route
- Frontend pattern: Component → Service → API
- Tests: `*.spec.ts` files

---

## ❌ COMMON MISTAKES

### ❌ Ne pas filtrer centreId
```typescript
// ✗ WRONG - Cross-tenant data leak!
const factures = await prisma.facture.findMany();

// ✓ CORRECT
const factures = await prisma.facture.findMany({
  where: { centreId: userCentreId }
});
```

### ❌ Hardcoder secrets
```typescript
// ✗ WRONG
const apiKey = "sk_test_123456789";

// ✓ CORRECT
const apiKey = process.env.STRIPE_API_KEY;
```

### ❌ Pas valider input
```typescript
// ✗ WRONG - SQL injection risk!
const query = `SELECT * FROM users WHERE email = '${email}'`;

// ✓ CORRECT - Use parameterized
await prisma.user.findUnique({ where: { email } });
```

### ❌ Créer facture sans vérifier stock
```typescript
// ✗ WRONG - Peut avoir stock négatif
await facture.create(data);

// ✓ CORRECT
if (stock < quantité) throw new Error("Stock insuffisant");
await facture.create(data);
```

---

## 🆘 SI VOUS ÊTES VRAIMENT BLOQUÉ

1. **Relire documentation** - 90% des questions dedans
2. **Chercher dans logs** - Error message souvent très clair
3. **Google error** - Stack Overflow souvent a la réponse
4. **Ask team colleague** - Pas de question bête!
5. **Open support ticket** - Dernière resort

---

## 📚 DOCS RAPIDES

| Besoin | Fichier |
|--------|---------|
| Overview | [../01-GUIDES_RAPIDES/QUICKSTART_5MIN.md](../01-GUIDES_RAPIDES/QUICKSTART_5MIN.md) |
| Backend dev | [../01-GUIDES_RAPIDES/POUR_DEVELOPER_BACKEND.md](../01-GUIDES_RAPIDES/POUR_DEVELOPER_BACKEND.md) |
| Frontend dev | [../01-GUIDES_RAPIDES/POUR_DEVELOPER_FRONTEND.md](../01-GUIDES_RAPIDES/POUR_DEVELOPER_FRONTEND.md) |
| Règles métier | [../03-SPECIFICATIONS/SPECIFICATION_FINALE_OPTISAAS.md](../03-SPECIFICATIONS/SPECIFICATION_FINALE_OPTISAAS.md) section 5 |
| API endpoints | [../03-SPECIFICATIONS/ANALYSE_OPTISAAS_COMPLETE.json](../03-SPECIFICATIONS/ANALYSE_OPTISAAS_COMPLETE.json) |
| Validations | [../03-SPECIFICATIONS/DTOCS_MODELES.md](../03-SPECIFICATIONS/DTOCS_MODELES.md) |
| Workflows | [../02-DOCUMENTATION_TECHNIQUE/FLUX_PROCESSUS.md](../02-DOCUMENTATION_TECHNIQUE/FLUX_PROCESSUS.md) |
| Terminology | [GLOSSAIRE_METIER.md](GLOSSAIRE_METIER.md) |
| Errors | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |

---

**Si votre question n'est pas ici, contact team! 💬**
