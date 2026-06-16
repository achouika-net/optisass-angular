# Nettoyage des Données du Centre Rabat

Ce document contient deux méthodes pour nettoyer les données spécifiques au **Centre Rabat** (ID: `6df7de62-498e-4784-b22f-7bbccc7fea36`).

> [!IMPORTANT]
> Avant de procéder à toute suppression, effectuez une sauvegarde (dump) de la base de données. Ces actions sont irréversibles.

---

## Méthode 1 : Script de Nettoyage Multi-sélection (Recommandé)

Le script prend en charge la multi-sélection (par exemple, vous pouvez saisir `1,4,5` pour supprimer les clients, factures et BL d'un coup). Il gère automatiquement l'ordre des dépendances de la base de données (foreign keys) pour éviter les erreurs de contrainte d'intégrité.

### Comment lancer le script :

1. Double-cliquez sur le fichier **`clean_rabat.bat`** à la racine de votre projet.
2. Saisissez les numéros séparés par des virgules (ex : `1,4` pour supprimer les clients et factures).
3. Le script détectera si des dépendances requièrent la suppression d'autres tables et vous demandera confirmation ou vous proposera des options adaptées (par exemple détacher les clients des bons de livraison sans supprimer les BL eux-mêmes).

---

## Méthode 2 : Requêtes SQL Manuelles

Si vous préférez exécuter des requêtes directement dans votre client SQL (pgAdmin, DBeaver, etc.), voici les requêtes pour chaque table filtrée sur le **Centre Rabat** (`6df7de62-498e-4784-b22f-7bbccc7fea36`).

### 1. Clients et Fiches Associées
```sql
-- Supprimer les fiches associées aux clients du Centre Rabat
DELETE FROM "Fiche" 
WHERE "clientId" IN (SELECT "id" FROM "Client" WHERE "centreId" = '6df7de62-498e-4784-b22f-7bbccc7fea36');

-- Supprimer les clients
DELETE FROM "Client" 
WHERE "centreId" = '6df7de62-498e-4784-b22f-7bbccc7fea36';
```

### 2. Entrepôts et Mouvements de Stock
```sql
DELETE FROM "Entrepot" 
WHERE "centreId" = '6df7de62-498e-4784-b22f-7bbccc7fea36';
```

### 3. Affectations des Employés
```sql
DELETE FROM "EmployeeCentre" 
WHERE "centreId" = '6df7de62-498e-4784-b22f-7bbccc7fea36';
```

### 4. Factures et Paiements Associés
```sql
-- Supprimer les paiements associés aux factures du Centre Rabat
DELETE FROM "Paiement" 
WHERE "factureId" IN (SELECT "id" FROM "Facture" WHERE "centreId" = '6df7de62-498e-4784-b22f-7bbccc7fea36');

-- Supprimer les factures
DELETE FROM "Facture" 
WHERE "centreId" = '6df7de62-498e-4784-b22f-7bbccc7fea36';
```

### 5. Bons de Livraison
```sql
DELETE FROM "BonLivraison" 
WHERE "centreId" = '6df7de62-498e-4784-b22f-7bbccc7fea36';
```

### 6. Caisses, Journées et Opérations de Caisse
```sql
-- Supprimer les opérations de caisse associées aux journées de caisse du centre
DELETE FROM "OperationCaisse" 
WHERE "journeeCaisseId" IN (SELECT "id" FROM "JourneeCaisse" WHERE "centreId" = '6df7de62-498e-4784-b22f-7bbccc7fea36');

-- Supprimer les journées de caisse
DELETE FROM "JourneeCaisse" 
WHERE "centreId" = '6df7de62-498e-4784-b22f-7bbccc7fea36';

-- Supprimer les caisses
DELETE FROM "Caisse" 
WHERE "centreId" = '6df7de62-498e-4784-b22f-7bbccc7fea36';
```

### 7. Dépenses
```sql
DELETE FROM "Depense" 
WHERE "centreId" = '6df7de62-498e-4784-b22f-7bbccc7fea36';
```

### 8. Factures Fournisseurs
```sql
DELETE FROM "FactureFournisseur" 
WHERE "centreId" = '6df7de62-498e-4784-b22f-7bbccc7fea36';
```

### 9. Virtual Try-ons
```sql
DELETE FROM "VirtualTryon" 
WHERE "centreId" = '6df7de62-498e-4784-b22f-7bbccc7fea36';
```

### 10. Comptes Bancaires
```sql
DELETE FROM "CompteBancaire" 
WHERE "centreId" = '6df7de62-498e-4784-b22f-7bbccc7fea36';
```

### 11. Règles de Commission
```sql
DELETE FROM "CommissionRule" 
WHERE "centreId" = '6df7de62-498e-4784-b22f-7bbccc7fea36';
```
