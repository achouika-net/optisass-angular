# 📊 ANALYSE COMPLÈTE - IMPACT DÉPENSES/FACTURES/BL SUR CAISSE, STOCK, CLIENT & CIRCUIT BC

**Date**: 2026-04-19  
**Statut**: 🔴 **ANALYSE APPROFONDIE - INTERCONNEXIONS CRITIQUES**  
**Audience**: Développeurs, Architectes, Opérationnels

---

## TABLE DES MATIÈRES

1. [Impact Dépenses sur Caisse](#impact-dépenses-sur-caisse)
2. [Impact Factures/BL sur Stock](#impact-factures-bl-sur-stock)
3. [Attachement BL au Dossier Client](#attachement-bl-au-dossier-client)
4. [Circuit Complet Bon de Commande](#circuit-complet-bon-de-commande)
5. [Paramétrage de l'ERP](#paramétrage-de-lerp)
6. [Diagrammes Interconnexions](#diagrammes-interconnexions)

---

## 🏦 IMPACT DÉPENSES SUR CAISSE

### 1.1 Flux Dépense → Caisse

**Modèle Depense**:
```typescript
// backend/prisma/schema.prisma
model Depense {
  id                   String               @id @default(uuid())
  date                 DateTime             @default(now())
  montant              Float
  categorie            String              // "ACHAT_STOCK", "SALAIRE", "LOYER", etc
  description          String?
  modePaiement         String              // "ESPECES", "CHEQUE", "VIREMENT", "LCN"
  statut               String              // "EN_ATTENTE", "VALIDEE", "PAYEE"
  justificatifUrl      String?
  centreId             String
  factureFournisseurId String?              @unique
  bonLivraisonId       String?              @unique
  echeanceId           String?              @unique
  dateEcheance         DateTime?
  reference            String?
  fournisseurId        String?
  creeParId            String?              // User qui crée la dépense
  valideParId          String?              // User qui valide
  employeeId           String?              // Si c'est une paie
  centre               Centre               @relation(fields: [centreId], references: [id])
  factureFournisseur   FactureFournisseur?  @relation(...)
  bonLivraison         BonLivraison?        @relation(...)
}
```

**Workflow Création Dépense**:

```
┌──────────────────────────────────────┐
│ 1. Créer Dépense (Service)           │
│    - montant, date, categorie        │
│    - modePaiement (ESPECES/CHEQUE)   │
│    - statut: EN_ATTENTE              │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ 2. Lier à EcheancePaiement?          │
│    SI modePaiement IN (CHEQUE/LCN)  │
│    - Créer écheance                  │
│    - Statut: EN_ATTENTE              │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ 3. Validation Dépense                │
│    - validePar: User ID              │
│    - statut → VALIDEE                │
│    - SI modePaiement ≠ CHEQUE/LCN    │
│      → Écheance.statut: ENCAISSE     │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ 4. Mise à Jour FactureFournisseur    │
│    SI factureFournisseurId liée      │
│    - Calculer totalPaid (sum echs)   │
│    - Déterminer nouveau statut       │
│    - Mettre à jour status facture    │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ 5. Créer OperationCaisse             │
│    - type: DEPENSE                   │
│    - montant: depense.montant        │
│    - moyenPaiement: depense.mode     │
│    - journeeCaisseId: current day    │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ 6. Mettre à Jour JourneeCaisse       │
│    totalDepenses += depense.montant  │
│    soldeTheorique -= montant         │
└──────────────────────────────────────┘
```

**Code Impact Caisse** (ExpensesService):
```typescript
// backend/src/features/expenses/expenses.service.ts

async create(createExpenseDto: CreateExpenseDto) {
  return this.prisma.$transaction(async (tx) => {
    
    // 1. Créer ou récupérer écheance
    let finalEcheanceId = null;
    if ((data.modePaiement === 'CHEQUE' || data.modePaiement === 'LCN') && dateEcheance) {
      const echeance = await tx.echeancePaiement.create({
        data: {
          type: data.modePaiement,
          reference: reference,
          dateEcheance: normalizeToUTCNoon(dateEcheance) as Date,
          montant: data.montant,
          statut: 'EN_ATTENTE',  // Pas de payement immédiat
          banque: banque,
        },
      });
      finalEcheanceId = echeance.id;
    }

    // 2. SI VALIDÉE ET MOD_PAIEMENT ≠ CHEQUE/LCN → Encaisser immédiatement
    if (finalEcheanceId && data.statut === 'VALIDEE' && 
        data.modePaiement !== 'CHEQUE' && data.modePaiement !== 'LCN') {
      await tx.echeancePaiement.update({
        where: { id: finalEcheanceId },
        data: {
          statut: 'ENCAISSE',      // ✅ Mark as paid
          dateEncaissement: new Date(),
          montant: data.montant,
        },
      });
    }

    // 3. Créer la dépense
    const depense = await tx.depense.create({
      data: { ...data, echeanceId: finalEcheanceId },
    });

    // 4. **CRITICAL**: Créer OperationCaisse automatiquement
    //    Cette opération doit être créée pour que la caisse soit impactée
    await tx.operationCaisse.create({
      data: {
        type: 'DEPENSE',
        montant: depense.montant,
        moyenPaiement: depense.modePaiement,
        reference: depense.reference || `DEP-${depense.id}`,
        motif: depense.description || depense.categorie,
        utilisateur: depense.creeParId,
        journeeCaisseId: currentJourneeId,  // Must get current open caisse day
        typeOperation: 'COMPTABLE',
      },
    });

    // 5. Mettre à jour JourneeCaisse totals
    await tx.journeeCaisse.update({
      where: { id: currentJourneeId },
      data: {
        totalDepenses: { increment: depense.montant },
        soldeTheorique: { decrement: depense.montant },
      },
    });

    // 6. Sync FactureFournisseur si liée
    if (factureFournisseurId) {
      const facture = await tx.factureFournisseur.findUnique({
        where: { id: factureFournisseurId },
        include: { echeances: true },
      });
      
      const totalPaid = facture.echeances
        .filter(e => e.statut === 'ENCAISSE')
        .reduce((sum, e) => sum + e.montant, 0);

      const newStatus = totalPaid >= facture.montantTTC ? 'PAYEE' : 'PARTIELLE';
      
      await tx.factureFournisseur.update({
        where: { id: factureFournisseurId },
        data: { statut: newStatus },
      });
    }

    return depense;
  });
}
```

### 1.2 Statuts et Transitions Dépense

```
┌──────────────┐
│ EN_ATTENTE   │  Créée, non validée
└────┬─────────┘
     │ Validation
     ▼
┌──────────────┐
│  VALIDEE     │  Confirmée → OperationCaisse créée
└────┬─────────┘    → Caisse impactée
     │              → FactureFournisseur synced
     ▼
┌──────────────┐
│   PAYEE      │  Entièrement payée (tous écheances ENCAISSE)
└──────────────┘

Modèles de paiement:
- ESPECES:    VALIDEE → OperationCaisse → Caisse mise à jour
- CHEQUE:     VALIDEE → EcheancePaiement EN_ATTENTE → Caisse impact NULL
- VIREMENT:   VALIDEE → OperationCaisse → Caisse mise à jour  
- LCN:        VALIDEE → EcheancePaiement EN_ATTENTE → Caisse impact NULL
```

---

## 📦 IMPACT FACTURES/BL SUR STOCK

### 2.1 Types de Factures et Impact Stock

**Modèle FactureFournisseur**:
```typescript
model FactureFournisseur {
  id               String
  numeroFacture    String
  type             String  // "ACHAT_STOCK", "ACHAT_SERVICES", "BL", etc
  statut           String  // "A_PAYER", "PARTIELLE", "PAYEE"
  montantHT        Float
  montantTVA       Float
  montantTTC       Float
  centreId         String
  fournisseurId    String
  childBLs         BonLivraison[]  // BL liés
  mouvementsStock  MouvementStock[]  // Stock impacté
}

model BonLivraison {
  id               String
  numeroBL         String
  type             String  // "ACHAT_STOCK", "VENTE_DIRECT", "RETOUR", etc
  statut           String  // "VALIDEE", "LIVREE", "PARTIELLEMENT_LIVREE"
  fournisseurId    String
  clientId         String?  // Client si vente
  ficheId          String?  // Fiche si associé à prescription
  factureFournisseurId String?  // Facture fournisseur parente
  mouvementsStock  MouvementStock[]
}
```

### 2.2 Workflow Création Facture Fournisseur → Stock

```
┌────────────────────────────────────┐
│ 1. Créer FactureFournisseur        │
│    - type: "ACHAT_STOCK"           │
│    - statut: "A_PAYER"             │
│    - montantTTC, dateEmission      │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│ 2. Ajouter Allocations (Articles)  │
│    Bulk Alimentation (Stock Module)│
│    Pour chaque article:            │
│    - prixAchat, quantite, tva      │
│    - warehouseId (entrepotId)      │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│ 3. Créer MouvementStock            │
│    - type: "ENTREE_FOURNISSEUR"    │
│    - produitId: product.id         │
│    - quantite: allocation.quantite │
│    - entrepotDestination: warehouse│
│    - prixAchatUnitaire: prix       │
│    - factureFournisseurId: FK      │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│ 4. Mettre à Jour Product.quantite  │
│    quantiteActuelle += quantite    │
│    Vérifier vs seuilAlerte         │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│ 5. Créer Dépense AUTO (si comptant)│
│    IF supplier.conditions = "comptant"
│      → Créer Depense VALIDEE       │
│      → Sync caisse + facture       │
└────────────────────────────────────┘
```

**Code Impact Stock** (StockMovementsService):
```typescript
// backend/src/features/stock-movements/stock-movements.service.ts

async processBulkAlimentation(dto: BulkAlimentationDto) {
  return await this.prisma.$transaction(async (tx) => {
    
    // 1. Créer FactureFournisseur
    const invoice = await tx.factureFournisseur.create({
      data: {
        numeroFacture: dto.numeroFacture,
        type: dto.type,
        statut: 'A_PAYER',
        montantHT: totalHT,
        montantTTC: totalTTC,
        fournisseurId: dto.fournisseurId,
        centreId: effectiveCentreId,
      },
    });

    // 2. Traiter chaque allocation (article)
    for (const alloc of dto.allocations) {
      
      // 2a. Trouver ou créer Product
      let product = await tx.product.findFirst({
        where: {
          codeInterne: alloc.reference.trim(),
          entrepotId: alloc.warehouseId,
        },
      });

      if (!product) {
        product = await tx.product.create({
          data: {
            codeInterne: alloc.reference,
            designation: alloc.nom,
            prixAchatHT: Number(alloc.prixAchat),
            prixVenteHT: Number(alloc.prixVente),
            quantiteActuelle: 0,  // Updated below
            entrepotId: alloc.warehouseId,
          },
        });
      }

      // 2b. **CRITICAL**: Créer MouvementStock (registre)
      const mouvement = await tx.mouvementStock.create({
        data: {
          type: 'ENTREE_FOURNISSEUR',
          quantite: Number(alloc.quantite),
          dateMovement: new Date(),
          motif: `Achat fournisseur - ${invoice.numeroFacture}`,
          produitId: product.id,
          entrepotDestinationId: alloc.warehouseId,
          prixAchatUnitaire: Number(alloc.prixAchat),
          factureFournisseurId: invoice.id,
          utilisateur: 'SYSTEM',
        },
      });

      // 2c. **CRITICAL**: Mettre à jour Product quantiteActuelle
      await tx.product.update({
        where: { id: product.id },
        data: {
          quantiteActuelle: { increment: Number(alloc.quantite) },
          prixAchatHT: Number(alloc.prixAchat),
        },
      });

      console.log(`✅ Stock +${alloc.quantite} pour ${product.designation}`);
    }

    // 3. Vérifier conditions paiement fournisseur
    const supplier = await tx.fournisseur.findUnique({
      where: { id: dto.fournisseurId },
    });

    const isCashPayment = 
      supplier?.conditionsPaiement?.toLowerCase().includes('comptant');

    // 4. SI comptant → Créer Dépense AUTO
    if (isCashPayment && dto.type !== 'BL' && effectiveCentreId) {
      await tx.depense.create({
        data: {
          montant: totalTTC,
          categorie: 'ACHAT_STOCK',
          modePaiement: 'ESPECES',
          statut: 'VALIDEE',
          factureFournisseurId: invoice.id,
          centreId: effectiveCentreId,
          description: `Paiement auto - ${invoice.numeroFacture}`,
        },
      });

      // Mettre à jour facture statut
      await tx.factureFournisseur.update({
        where: { id: invoice.id },
        data: { statut: 'PAYEE' },
      });

      console.log(`✅ DÉPENSE AUTO créée + caisse impactée`);
    }

    return invoice;
  });
}
```

### 2.3 BonLivraison → Stock Movement

```
┌──────────────────────────────────────┐
│ Créer BonLivraison                   │
│ - numeroBL: unique(fournisseur, BL)  │
│ - type: ACHAT_STOCK (supplier) ou    │
│         VENTE_DIRECT (client)        │
│ - factureFournisseurId: facture      │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ Créer MouvementStock                 │
│ - type: "ENTREE_FOURNISSEUR" ou      │
│         "SORTIE_VENTE"               │
│ - bonLivraisonId: FK                 │
│ - quantite: items count              │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ Mettre à Jour Stock                  │
│ - Product.quantiteActuelle +/-       │
│ - Vérifier seuil alerte              │
│ - Retourner warnings si stock bas    │
└──────────────────────────────────────┘
```

---

## 👤 ATTACHEMENT BL AU DOSSIER CLIENT

### 3.1 Structure Client Enrichie

**Modèle Client**:
```typescript
model Client {
  id                   String
  nom                  String?
  prenom               String?
  telephone            String?
  email                String?
  typeClient           String  // "particulier", "professionnel", "anonyme"
  
  // Famille & Groupe
  groupeFamille        Json?   // Structure: { members: [...], type: "FAMILLE" }
  groupeId             String? // Lien vers Groupe (chaînes optiques)
  groupe               Groupe?
  
  // Dossier Médical
  dossierMedical       Json?   // { prescriptions: [...], allergies: [...] }
  
  // Couverture Sociale
  couvertureSociale    Json?   // { type: "AME", numero: "..." }
  
  // Fiches (Prescriptions)
  fiches               Fiche[]
  
  // Dossier de Vente
  factures             Facture[]
  bonsLivraison        BonLivraison[]
  pointsFidelite       Int     // Loyalty points
  
  // Parrainages
  parrainId            String?
  parrain              Client?
  filleuls             Client[]
  
  // Convention
  conventionId         String?
  convention           Json?
}
```

### 3.2 Workflow: Attachement BL au Client

**Scénario 1: BL ACHAT_STOCK (Fournisseur)**

```
Fournisseur crée BL (ex: "ACHAT 100 verres")
  │
  ├─ fournisseurId: ID_FOURNISSEUR
  ├─ type: "ACHAT_STOCK"
  ├─ clientId: NULL (pas lié à client)
  ├─ ficheId: NULL
  └─ factureFournisseurId: ID_FACTURE
    │
    ▼
  Stock impacté (MouvementStock créé)
    │
    ▼
  Client: Pas d'impact direct
```

**Scénario 2: BL VENTE_DIRECT (Client)**

```
┌─────────────────────────────────┐
│ 1. Créer BL pour vente         │
│    - type: "VENTE_DIRECT"       │
│    - clientId: ID_CLIENT        │ ← **ATTACH CLIENT**
│    - ficheId: ID_FICHE (opt)    │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ 2. Mettre à jour Client         │
│    Si clientId fourni:          │
│    - Ajouter BL à bonsLivraison[]
│    - Calculer historique client │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ 3. Créer MouvementStock         │
│    - type: "SORTIE_VENTE"       │
│    - clientId: ID_CLIENT        │
│    - bonLivraisonId: ID_BL      │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ 4. Affecter à Fiche (optionnel) │
│    Si ficheId fourni:           │
│    - Lier BL à Fiche            │
│    - Attacher au dossier client │
│    - Générer BC/Facture         │
└─────────────────────────────────┘
```

**Code: Attachement BL Client** (BonLivraisonService):
```typescript
// backend/src/features/bon-livraison/bon-livraison.service.ts

async create(createDto: CreateBonLivraisonDto) {
  const { clientId, ficheId, ...inputData } = createDto;

  const blData: any = {
    numeroBL: inputData.numeroBL,
    type: inputData.type || "ACHAT_STOCK",
    fournisseurId: inputData.fournisseurId,
    montantTTC: Number(inputData.montantTTC),
    statut: "VALIDEE",
    clientId: clientId || null,      // ← **CLIENT ATTACHMENT**
    ficheId: ficheId || null,        // ← **FICHE ATTACHMENT**
  };

  return this.prisma.$transaction(async (tx) => {
    // 1. Créer BonLivraison
    const bl = await tx.bonLivraison.create({ data: blData });

    // 2. **IMPORTANT**: Créer MouvementStock associé
    await tx.mouvementStock.create({
      data: {
        type: blData.type === "VENTE_DIRECT" ? "SORTIE_VENTE" : "ENTREE_FOURNISSEUR",
        quantite: calculateItemsCount(inputData.items),
        produitId: firstProduct.id,
        bonLivraisonId: bl.id,
        clientId: clientId,            // ← Stock registre liée à client
        utilisateur: "SYSTEM",
      },
    });

    // 3. SI CLIENT + VENTE → Attacher au dossier
    if (clientId && blData.type === "VENTE_DIRECT") {
      const client = await tx.client.findUnique({ where: { id: clientId } });
      
      // Mettre à jour historique client (via relation)
      console.log(`✅ BL ${bl.numeroBL} attaché au client ${client.nom}`);
    }

    // 4. SI FICHE → Lier à prescription
    if (ficheId) {
      const fiche = await tx.fiche.findUnique({ where: { id: ficheId } });
      console.log(`✅ BL ${bl.numeroBL} attaché à Fiche #${fiche.numero}`);
      
      // Mettre à jour fiche.contenu avec BL
      await tx.fiche.update({
        where: { id: ficheId },
        data: {
          content: {
            ...fiche.content,
            bonLivraisonId: bl.id,
            bonLivraisonNumero: bl.numeroBL,
          },
        },
      });
    }

    return bl;
  });
}
```

### 3.3 Requête Client avec BL Attachés

```typescript
// Client avec tous BL associés
const client = await prisma.client.findUnique({
  where: { id: clientId },
  include: {
    bonsLivraison: {
      include: {
        fournisseur: true,
        mouvementsStock: true,
      },
      orderBy: { dateEmission: "desc" },
    },
    fiches: {
      include: {
        bonsLivraison: true,
      },
    },
    factures: {
      orderBy: { dateEmission: "desc" },
    },
  },
});

// Résultat:
{
  id: "client-123",
  nom: "Dupont",
  bonsLivraison: [
    {
      id: "bl-456",
      numeroBL: "BL-2026-001",
      type: "VENTE_DIRECT",
      montantTTC: 1500,
      items: [...],
      mouvementsStock: [...]
    }
  ],
  fiches: [
    {
      id: "fiche-789",
      numero: 42,
      bonsLivraison: [{ id: "bl-456", ... }]
    }
  ],
  factures: [...]
}
```

---

## 🛒 CIRCUIT COMPLET BON DE COMMANDE

### 4.1 Types de BC dans OptiSaas

| Type | Statut | Origine | Destination |
|------|--------|---------|-------------|
| **DEVIS** | DEVIS_EN_COURS | Client | En attente paiement |
| **BON_COMM** | VENTE_EN_INSTANCE | DEVIS payé | À livrer |
| **BON_LIVRAISON** | VALIDEE/LIVREE | BC validé | Livré au client |
| **FACTURE** | VALIDE/PAYEE | BL livré | Validée comptable |

### 4.2 État Machine Complet

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🔵 DEVIS_EN_COURS                                                   │
│ - Client crée prescription (Fiche)                                  │
│ - Facture créée type=DEVIS, statut=DEVIS_EN_COURS                  │
│ - Facture.resteAPayer = Facture.montantTTC                         │
│ - Stock: PAS DE MOUVEMENT                                          │
└────────┬────────────────────────────────────────────────────────────┘
         │
         │ Client ajoute paiement
         │ (PaiementsService.create)
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 🟡 TRANSITION: DEVIS → BON_COMM                                     │
│ [CRITICAL] PaiementsService détecte:                               │
│   - facture.type = DEVIS                                           │
│   - montant paiement reçu                                          │
│   - Trigger:                                                        │
│     1. facture.type = BON_COMM (upgrading)                         │
│     2. facture.numero = generateNextNumber("BON_COMM")             │
│     3. facture.statut = PARTIEL (si paiement < total)              │
│     4. Stock GUARD: vérifier disponibilité avant autoriser          │
└────────┬────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 🟢 BON_COMM / VENTE_EN_INSTANCE                                    │
│ - Type = BON_COMM (Numéroté séquentiellement)                       │
│ - Statut = VENTE_EN_INSTANCE (EN_COURS de traitement)             │
│ - Paiement validé (complètement ou partiellement)                  │
│ - Caisse impactée (paiement créé)                                  │
│ - Stock: PAS ENCORE RÉSERVÉ (vérifiable avant seulement)          │
│ - Commission: Calculée si vendeur assigné                          │
└────────┬────────────────────────────────────────────────────────────┘
         │
         │ Créer BonLivraison attaché
         │ (BonLivraisonService.create)
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 📦 BON_LIVRAISON / VALIDEE                                          │
│ - Créé avec type = VENTE_DIRECT                                    │
│ - clientId = facture.clientId (ATTACH CLIENT)                      │
│ - ficheId = facture.ficheId (ATTACH FICHE)                        │
│ - Crée MouvementStock:                                             │
│   * type: SORTIE_VENTE                                            │
│   * quantite: sum(items)                                          │
│   * clientId: client.id (audit trail)                             │
│ - Stock: quantiteActuelle DECREMENTED                             │
│ - Montant: Facturé au client (HT/TTC)                            │
│ - Status: VALIDEE (prêt à livrer) → LIVREE (confirmé)            │
└────────┬────────────────────────────────────────────────────────────┘
         │
         │ SI BL complètement livré
         │ ou transformation automatique
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 📄 FACTURE / VALIDE                                                 │
│ - Créée automatiquement depuis BL ou BC final                       │
│ - Type = FACTURE (comptable)                                       │
│ - Statut = VALIDE (fiscal)                                        │
│ - resteAPayer = montantTTC - paiements_anterieurs                 │
│ - Numéroté fiscalement (unique, séquentiel)                        │
│ - Stock: N/A (déjà décrémenté au BL)                              │
│ - Caisse: N/A (déjà enregistrée)                                  │
│ - Commissions: Finalisées                                         │
└────────┬────────────────────────────────────────────────────────────┘
         │
         │ IF resteAPayer = 0
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ✅ FACTURE / PAYEE                                                  │
│ - Entièrement payée                                                │
│ - Statut = PAYEE (fiscale + comptable)                            │
│ - Archivable                                                       │
│ - Dossier client: Complet                                          │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 Circuit Fournisseur → Client (Détail)

```
┌─────────────────────────────────────────┐
│ CIRCUIT ACHAT STOCK                     │
├─────────────────────────────────────────┤
│ 1. FactureFournisseur créée              │
│    - Fournisseur envoie facture          │
│    - type: ACHAT_STOCK                  │
│    - statut: A_PAYER                    │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 2. Stock importé (BulkAlimentation)      │
│    - Créer Products                      │
│    - Créer MouvementsStock               │
│    - Product.quantiteActuelle += qty    │
│    - **SI comptant**: Dépense auto       │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 3. BonLivraison (intern tracking)       │
│    - Enregistrer réception               │
│    - type: ACHAT_STOCK                  │
│    - entrepotId: destination             │
│    - fournisseurId: source               │
│    - clientId: NULL                     │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 4. EcheancePaiement (Fournisseur)       │
│    - Si non comptant: EN_ATTENTE        │
│    - Si CHEQUE: dateEcheance future     │
│    - Si VIREMENT: dateEcheance future   │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 5. Dépense créée (Depense)              │
│    - modePaiement: mode                 │
│    - factureFournisseurId: link         │
│    - statut: EN_ATTENTE → VALIDEE       │
│    - echeanceId: link                   │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 6. OperationCaisse (Caisse tracking)    │
│    - type: DEPENSE                      │
│    - montant: dépense.montant           │
│    - journeeCaisseId: jour courant      │
│    - totalDepenses: += montant          │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 7. FactureFournisseur.statut UPDATE     │
│    - A_PAYER → PAYEE (si tout payé)    │
│    - A_PAYER → PARTIELLE (si partiel)  │
└─────────────────────────────────────────┘
```

---

## ⚙️ PARAMÉTRAGE DE L'ERP

### 5.1 Configurations Principales

**LoyaltyConfig** (Points Fidélité):
```typescript
model LoyaltyConfig {
  id                  String   @id
  pointsPerDH         Float    @default(0.1)      // 0.1 pts / 1 DH acheté
  referrerBonus       Int      @default(50)       // Points sponsor
  refereeBonus        Int      @default(20)       // Points filleul
  folderCreationBonus Int      @default(30)       // Points création fiche
  rewardThreshold     Int      @default(500)      // Seuil récompense (pts)
  pointsToMADRatio    Float    @default(0.1)      // 1 pt = 0.1 DH
}

// Impact: Chaque facture payée → pointsFidelite calculé
// Formule: Math.floor(facture.montantTTC * pointsPerDH)
```

**FinanceConfig** (Seuils Financiers):
```typescript
model FinanceConfig {
  id               String   @id
  monthlyThreshold Float    @default(50000)  // Seuil TVA mensuel (Maroc)
  updatedAt        DateTime
}

// Impact: Calcul TVA, états de synthèse
```

**MarketingConfig** (Campagnes):
```typescript
model MarketingConfig {
  id                     String   @id
  campaignSMSTemplate    String?
  campaignEmailTemplate  String?
  smsProvider            String?  // TWILIO, LOCAL, etc
  emailProvider          String?  // SMTP, SENDGRID, etc
}
```

**PayrollConfig** (Paie):
```typescript
model PayrollConfig {
  id                      String   @id
  familyAllowanceRate_E   Float    @default(7.26)   // % cotisation
  familyAllowanceRate_P   Float    @default(6.40)   // % retenue employé
  familyDeductionCap      Float    @default(180)    // Plafond mensuel
  baseExemptionAmount     Float    @default(30)     // Exempt impôt
}

// Impact: Calcul automatique paie (PayrollService)
```

**CompanySettings** (Infos Société):
```typescript
model CompanySettings {
  id                 String   @id
  name               String
  siret              String?
  sirene             String?
  codeAPE            String?
  adresse            String?
  telephone          String?
  email              String?
  logoUrl            String?
  favicon            String?
  branding           Json?    // Couleurs, typographie
}
```

### 5.2 Workflow Initialisation ERP

```
┌────────────────────────────────────────┐
│ 1. Créer Groupe                        │
│    - nom: "Mon Réseau Optiques"        │
│    - type: "WORK" ou "FAMILY"          │
│    - Seule entité multi-centre         │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ 2. Créer Centres (par Groupe)          │
│    - Centre 1: "Casablanca"            │
│    - Centre 2: "Rabat"                 │
│    - Relation: groupe.centres[]        │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ 3. Créer Entrepôts (par Centre)        │
│    - Entrepôt stock principal          │
│    - Entrepôt retours                  │
│    - Relation: centre.entrepots[]      │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ 4. Ajouter Fournisseurs (global)       │
│    - Verres ESSILOR, CRIZAL            │
│    - Montures GUCCI, RAY-BAN           │
│    - Conventions (remises)             │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ 5. Créer Caisses (par Centre)          │
│    - "Caisse Principale"               │
│    - "Caisse Secondaire"               │
│    - Relation: centre.caisses[]        │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ 6. Ouvrir JourneeCaisse                │
│    - Créer journée caisse              │
│    - fondInitial: montant               │
│    - statut: OUVERTE                   │
│    - caissier: User.id                 │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ 7. Configurer Paramètres Globaux       │
│    - LoyaltyConfig: pointsPerDH        │
│    - FinanceConfig: seuils TVA         │
│    - PayrollConfig: taux paie          │
│    - MarketingConfig: SMS/EMAIL        │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ 8. Créer Utilisateurs + Rôles          │
│    - Directeur → ADMIN                 │
│    - Opticien → VENDEUR                │
│    - Caissier → CAISSE                 │
│    - UserCentreRole: rôle par centre   │
└─────────────────────────────────────────┘
```

### 5.3 Gestion Configurations par Service

**CompanySettingsService**:
```typescript
async getSettings() {
  let settings = await this.prisma.companySettings.findFirst();
  if (!settings) {
    settings = await this.prisma.companySettings.create({
      data: {
        name: 'Ma Société',
      },
    });
  }
  return settings;
}

async updateSettings(data: any) {
  const settings = await this.getSettings();
  return this.prisma.companySettings.update({
    where: { id: settings.id },
    data,
  });
}
```

**LoyaltyService.Config Management**:
```typescript
async getConfig() {
  let config = await this.prisma.loyaltyConfig.findFirst();
  if (!config) {
    config = await this.prisma.loyaltyConfig.create({
      data: {
        pointsPerDH: 0.1,
        referrerBonus: 50,
        refereeBonus: 20,
        rewardThreshold: 500,
      },
    });
  }
  return config;
}

async updateConfig(data: any) {
  const config = await this.getConfig();
  return this.prisma.loyaltyConfig.update({
    where: { id: config.id },
    data: {
      pointsPerDH: data.pointsPerDH ?? config.pointsPerDH,
      referrerBonus: data.referrerBonus ?? config.referrerBonus,
      // ... other fields
    },
  });
}

// Impact lors d'une facture:
async awardPointsForPurchase(factureId: string) {
  const config = await this.getConfig();
  const points = Math.floor(facture.montantTTC * config.pointsPerDH);
  
  // Ajouter points au client
  client.pointsFidelite += points;
  await prisma.client.update({ ... });
}
```

---

## 🔗 DIAGRAMMES INTERCONNEXIONS

### 6.1 Flux Complet: Dépense → Caisse → Facture

```
┌──────────────────────────────────────────────────────────────────┐
│                    DÉPENSE CRÉÉE (ExpensesService)               │
│  montant: 5000 DH, modePaiement: ESPECES, categorie: ACHAT_STOCK│
└────────┬─────────────────────────────────────────────────────────┘
         │
         │ 1. Créer ou récupérer Écheance
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│              ÉCHEANCE PAIEMENT (EcheancePaiement)                │
│  type: ESPECES, montant: 5000, statut: ENCAISSE                 │
│  dateEncaissement: NOW                                           │
└────────┬─────────────────────────────────────────────────────────┘
         │
         │ 2. Créer OperationCaisse (audit trail)
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│           OPERATION CAISSE (OperationCaisse)                      │
│  type: DEPENSE, montant: 5000, moyenPaiement: ESPECES           │
│  journeeCaisseId: jour-courant-id                               │
└────────┬─────────────────────────────────────────────────────────┘
         │
         │ 3. Mettre à jour JourneeCaisse
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│            JOURNEE CAISSE (JourneeCaisse)                         │
│  totalDepenses: 5000 (+=)                                       │
│  soldeTheorique: -5000 (-=)                                     │
│  soldeReel: à confirmer à la clôture                            │
└────────┬─────────────────────────────────────────────────────────┘
         │
         │ 4. Sync FactureFournisseur (si liée)
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│       FACTURE FOURNISSEUR (FactureFournisseur)                   │
│  montantTTC: 5000                                                │
│  statut: A_PAYER → PARTIELLE → PAYEE                           │
│  totalPaid: 5000 / 5000 ✅ PAYEE                               │
└──────────────────────────────────────────────────────────────────┘
```

### 6.2 Impacte Stock: BL → MouvementStock → Product

```
┌────────────────────────────────────┐
│ BonLivraison.create()              │
│ - numeroBL: BL-2026-001            │
│ - type: VENTE_DIRECT               │
│ - clientId: client-123             │
│ - montantTTC: 1500 DH              │
└────────┬───────────────────────────┘
         │
         │ Items: [
         │   {id: verres-100, qty: 2, prixU: 400}
         │   {id: monture-50, qty: 1, prixU: 700}
         │ ]
         │
         ▼
┌────────────────────────────────────┐
│ MouvementStock.create() × 2        │
│ ─────────────────────────────────  │
│ 1. Verres:                         │
│    - type: SORTIE_VENTE            │
│    - produitId: verres-100         │
│    - quantite: 2                   │
│    - prixVenteUnitaire: 400        │
│                                    │
│ 2. Monture:                        │
│    - type: SORTIE_VENTE            │
│    - produitId: monture-50         │
│    - quantite: 1                   │
│    - prixVenteUnitaire: 700        │
└────────┬───────────────────────────┘
         │
         │ Product.update() × 2
         │ quantiteActuelle -= qty
         │
         ▼
┌────────────────────────────────────┐
│ Product Stock Updated              │
│ ─────────────────────────────────  │
│ Verres-100:                        │
│   quantite: 50 → 48 (-2)           │
│   ⚠️ Si < seuilAlerte(2) → ALERTE  │
│                                    │
│ Monture-50:                        │
│   quantite: 10 → 9 (-1)            │
│   ✅ Stock OK                      │
└────────────────────────────────────┘
```

### 6.3 Intégration Client: BL ↔ Dossier

```
┌──────────────────────────────────┐
│ CLIENT (Client Model)            │
├──────────────────────────────────┤
│ id: client-123                   │
│ nom: Dupont                      │
│ bonsLivraison: [BL-001, BL-002]│
│ fiches: [Fiche-42]              │
│ factures: [FAC-001]             │
│ pointsFidelite: 250 pts         │
│ dossierMedical: { ... }         │
│ groupeFamille: { ... }          │
│ couvertureSociale: { ... }      │
└────────┬───────────────────────┘
         │
         │ BonLivraison attaché:
         │ BL.clientId = client-123
         │
         ▼
┌──────────────────────────────────┐
│ HISTORIQUE CLIENT                │
├──────────────────────────────────┤
│ BL-001 (15/04/2026)             │
│   - Verres sphériques +2.50    │
│   - Monture Ray-Ban            │
│   - Montant: 1500 DH            │
│                                 │
│ BL-002 (18/04/2026)             │
│   - Verres progressifs +1.50   │
│   - Monture Gucci              │
│   - Montant: 2000 DH            │
│                                 │
│ Total dépensé: 3500 DH         │
│ Points cumulés: 350 pts        │
│ Éligible récompense: OUI       │
└──────────────────────────────────┘
```

---

## 📋 RÉSUMÉ DES IMPACTS

| Opération | Caisse | Stock | Client | Facture |
|-----------|--------|-------|--------|---------|
| **Dépense ESPECES** | ✅ -montant | - | - | - |
| **Dépense CHEQUE** | ⏳ EN_ATTENTE | - | - | - |
| **Facture Fournisseur** | - | ✅ +qty | - | ✅ A_PAYER |
| **BL ACHAT** | - | ✅ +qty | - | - |
| **BL VENTE** | - | ✅ -qty | ✅ Attaché | ✅ Créée |
| **Paiement Client** | ✅ +montant | - | ✅ Points | ✅ PARTIEL→PAYEE |
| **Clôture Caisse** | ✅ Validée | - | - | - |

---

**Status**: 🟢 **ANALYSE COMPLÈTE ET APPROFONDIE**

*Généré par: Copilot AI - Analyse Flux Opérationnel*  
*Date: 2026-04-19*
