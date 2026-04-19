# 📊 GUIDE RAPIDE - PRODUCT MANAGER

**Temps de lecture**: 20 minutes  
**Objectif**: Comprendre métier et valider règles

---

## 🎯 RÉSUMÉ EXÉCUTIF

**OptiSaas** = Logiciel SaaS pour gestion **centres optiques** marocains (lunetterie)

**Clients cibles**: Propriétaires petits/moyens centres optiques (5-50 employés)

**Modèle revenu**: Abonnement mensuel par centre (pricing TBD)

**Capacités clés**: 
- ✅ Gestion clients + dossiers optiques
- ✅ Cycle commercial complet (Devis→Facture→Paiement)
- ✅ Stock multi-entrepôt
- ✅ Points fidélité avec parrainage
- ✅ Paie automatisée
- ✅ Caisse + comptabilité
- ✅ Multi-centres

---

## 💼 PROCESSUS MÉTIER (Ce que les utilisateurs font)

### Jour Client (6 étapes)
```
1. CLIENT ENTRE AU MAGASIN
   └─ Vendeur crée fiche optique
   └─ Prescription saisie (sphère, cylindre, axe)
   
2. SÉLECTION PRODUITS
   └─ Monture + verres + lentilles
   └─ Vendeur génère DEVIS (HT, TVA, TTC calculés auto)
   
3. VALIDATION CLIENT
   └─ Client accepte prix
   └─ Système vérifie stock (erreur si rupture)
   └─ Vendeur génère commande fournisseur si besoin
   
4. PAIEMENT INITIAL
   └─ Client paie (espèces/carte/chèque)
   └─ Facture créée automatiquement
   └─ Points fidélité gagnés (+0.1 par DH)
   └─ Commission vendeur calculée
   
5. CONFECTION
   └─ Fournisseur expédie produits
   └─ Opticien confectionne (assemble monture + verres)
   
6. LIVRAISON
   └─ Client reprend lunettes
   └─ Dossier clôturé
   
RÉSULTAT: CA généré, client satisfait, données tracées
```

---

## 💰 MODÈLE ÉCONOMIQUE & KPIs

### Chiffre d'Affaires (CA)
```
CA = Σ(Factures PAYEE + PARTIELLE × totalTTC)

Segmentations visibles:
├─ Par vendeur    → Leaderboard performances
├─ Par centre     → Comparaison succursales
├─ Par produit    → Montures vs Verres vs Lentilles
└─ Par mois       → Tendances

Target: Suivi temps réel (dashboard)
```

### Points Fidélité (Rétention)
```
Acquisition: +0.1 points/DH dépensé
  └─ Nouveau client: +20 bonus
  └─ Création fiche: +30 bonus
  └─ Parrainage: +50 (parraineur), +20 (parrainé)

Redemption: 500 points min = 50 DH remise
  └─ Engagement client (+20% avg repurchase)

Target: 70% clients avec 500+ points (6 mois)
```

### Commissions Vendeurs
```
Trigger: Facture PAYEE
Calcul: Montant facture × taux par type article

Types articles:
├─ Monture: 5-8%
├─ Verre: 2-3%
├─ Lentille: 3-5%
└─ Accessoire: 2%

Intégration: Salaire mensuel automatisé

Target: Vendeurs motivés, CA +30% avec bonnes commissions
```

### Stock & Rotations
```
Visibility: Quantités actuelles + alertes bas

Rotations: Nombre fois article vendu/an
  └─ Montures: 4-6x (tendance saisonnière)
  └─ Verres: Haute (demande fréquente)
  └─ Lentilles: Très haute (usure)

Target: Zéro rupture client, rotation optimale
```

---

## 🔐 SÉCURITÉ MÉTIER

### Multi-Centre (Isolation)
```
Chaque centre = Données totalement isolées
  └─ Utilisateurs du centre A ne voient RIEN du centre B
  └─ Ni clients, ni factures, ni stock, ni paie

Validation: 
  └─ Header Tenant identifie centre requête
  └─ Toutes les queries filtrent par centreId
  └─ Cross-centre: IMPOSSIBLE sauf admin global

Bénéfice: Concurrence loyale (secret commercial protégé)
```

### Rôles & Permissions
```
ADMIN              → Tout voir/modifier (centre)
MANAGER            → Gestion opérations (employés, factures, stock)
VENDEUR            → Vente seulement (clients, fiches, devis)
CAISSIER           → Caisse seulement (paiements, caisse quotidienne)
OPTICIEN           → Confection seulement (fiches, production)

Validation: Permissions granulaires par fonction
```

### Audit Trail (Traçabilité)
```
TOUT est tracé: Qui a fait quoi, quand, avant/après

Exemples:
├─ 14:23 - Ahmed créé Facture FAC001 pour Alaoui (600 DH)
├─ 14:25 - Système auto: FAC001 → PAYEE + Stock -1 + Points +60
├─ 14:26 - Leila enregistré Paiement 600 DH (espèces)
├─ 14:27 - Système auto: Commission vendeur Ahmed +48 DH (8%)
├─ 16:00 - Directeur exporté CA du jour (rapport)
└─ 17:30 - Caissier clôturé JourneeCaisse (FERMEE)

Bénéfice: Responsabilité, détection fraude, audit légal
```

---

## 📈 RÈGLES MÉTIER CRITIQUES À VALIDER

### ✅ Factures (Document commercial)
```
Numérotation:     Unique (DV 000001, DV 000002, ...)
États:            DEVIS_EN_COURS → VALIDEE → PAYEE → SOLDEE
Stock:            Vérifié AVANT validation (bloque si rupture)
TVA:              Automatique 20% (droit comptable)
Points:           +0.1/DH à validation+paiement

Validation: ✓ Montants logiques, ✓ Client existe, ✓ Transitions autorisées
```

### ✅ Stock (Mouvements tracés)
```
Entree:           Réception fournisseur (augmente quantité)
Sortie:           Facture payée (diminue quantité)
Transfert:        Inter-entrepôt (redistribution)
Retour:           Client mécontent (augmente quantité)

Alertes:          Stock bas (notification automatique)
Vérification:     AVANT facture PAYEE (bloque si insuffisant)

Validation: ✓ Quantités > 0, ✓ Entrepôts existent
```

### ✅ Fidélité Choukra (Parrainage)
```
Accumulation:     0.1 points/DH dépensé
Bonuses:          Nouveau client (+20), fiche (+30), parrainage (+50/+20)
Seuil:            500 points min pour remise
Conversion:       10 points = 1 DH remise
Parrainage:       Lien permanent client A → client B

Validation: ✓ Points ne dupliquent pas, ✓ Remise ≤ 50% facture
```

### ✅ Commissions (Motivation vendeurs)
```
Trigger:          Facture PAYEE uniquement
Calcul:           HT ligne × taux article
Intégration:      Bulletin paie mensuel
Période:          Mensuelle (YYYY-MM)

Types articles:   MONTURE (5-8%), VERRE (2-3%), LENTILLE (3-5%), etc.

Validation: ✓ Commissions positives, ✓ Vendeur assigné, ✓ Facture payée
```

### ✅ Caisse (Trésorerie)
```
Ouverture:        Fond initial + caissier identifié
Transactions:     Chaque paiement → OperationCaisse
Clôture:          Solde théorique vs réel rapproché
Écarts:           Justifiés si > 0.01 DH

Modes:            Espèces, Cartes, Chèques, Virements (comptage séparé)

Validation: ✓ Solde réel ≥ 0, ✓ Écart justifié si > 5 DH
```

### ✅ Comptabilité (Légalité)
```
Export Sage:      Format marocain standard
TVA:              20% standard (collectée vs déductible)
Documentsvalides: Factures VALIDEE + PAYEE seulement
Audit:            Trail complet pour inspecteur

Validation: ✓ Montants cohérents, ✓ TVA correcte, ✓ Docs numérotés
```

---

## 📊 METRICS À SUIVRE

### Quotidien
```
- CA du jour (par vendeur, par centre)
- Paiements reçus (vs prévisions)
- Stock bas (alertes produits)
- Caisse (solde, écarts)
```

### Mensuel
```
- CA mensuel (trend, croissance)
- Top 3 vendeurs (CA)
- Rotation stock (vitesse vente)
- Fidélité (points générés, utilisés)
- Commissions totales
- Masse salariale
```

### Annuel
```
- CA par centre
- Croissance YoY
- Client retention
- Profitabilité (CA - COGS - paie)
```

---

## 🚀 ROADMAP EXEMPLE (Phases)

### Phase 1: MVP (2026 Q2)
```
✅ Gestion clients + fiches
✅ Cycle vente (Devis→Facture)
✅ Paiements simples
✅ Stock basique
✅ Multi-centre isolation
```

### Phase 2: Fidélité + Caisse (Q3)
```
✅ Points Choukra complet
✅ Parrainage réseau
✅ Caisse quotidienne
✅ Rapprochement automatisé
```

### Phase 3: Paie + Comptabilité (Q4)
```
✅ Commissions vendeurs
✅ Bulletins paie PDF
✅ Export Sage comptable
✅ Rapports TVA/bilans
```

### Phase 4: Analytics + Mobile (2027)
```
✅ Dashboards avancés
✅ App mobile pour vendeurs
✅ Intégrations paiement en ligne
✅ Notifications SMS/WhatsApp
```

---

## 📚 DOCUMENTS ESSENTIELS

### Pour décisions stratégiques
- [../03-SPECIFICATIONS/RESUME_EXECUTIF.md](../03-SPECIFICATIONS/RESUME_EXECUTIF.md)
- [../03-SPECIFICATIONS/SPECIFICATION_FINALE_OPTISAAS.md](../03-SPECIFICATIONS/SPECIFICATION_FINALE_OPTISAAS.md) section 5 (règles métier)

### Pour validations fonctionnelles
- [../02-DOCUMENTATION_TECHNIQUE/FLUX_PROCESSUS.md](../02-DOCUMENTATION_TECHNIQUE/FLUX_PROCESSUS.md)
- [../04-RESSOURCES/GLOSSAIRE_METIER.md](../04-RESSOURCES/GLOSSAIRE_METIER.md)

### Pour questions rapides
- [../04-RESSOURCES/FAQ_COMMUNES.md](../04-RESSOURCES/FAQ_COMMUNES.md)

---

## ✅ VALIDATION MÉTIER CHECKLIST

- [ ] Cycle vente compris (6 étapes)
- [ ] Règles fidélité validées (acquisition, redemption, parrainage)
- [ ] Commissions structure approuvée (taux par article)
- [ ] Multi-centre isolation acceptée (aucun partage données)
- [ ] Audit trail pertinent pour légalité
- [ ] KPIs alignés avec stratégie
- [ ] Roadmap phases réalistes
- [ ] Prêt pour développement ✅

---

## 🎁 BONUS: QUESTIONS CLIENT

**"Comment optimiser CA?"**
→ Focus commissions vendeurs (5-8% motifie) + fidélité (rétention +20%)

**"Risque fraude comment?"**
→ Audit trail complet + caisse rapprochée + permissions strictes

**"Scalabilité?"**
→ Multi-centre + cloud ready + DB optimisée (test 500 centres)

**"Concurrence?"**
→ Données totalement isolées par centre (secret commercial)

---

**Bonne gestion! 🚀**

Questions? → [../04-RESSOURCES/FAQ_COMMUNES.md](../04-RESSOURCES/FAQ_COMMUNES.md)
