-- Selective Cleanup of Transactional Data
-- preserving Users, Centers, Warehouses, Products (catalog only), Suppliers, and Employees configurations.

BEGIN;

-- 1. Finance & Cashiering
DELETE FROM "DemandeAlimentation";
DELETE FROM "Paiement";
DELETE FROM "OperationCaisse";
DELETE FROM "JourneeCaisse";

-- 2. Human Resources
DELETE FROM "Commission";
DELETE FROM "Payroll";
DELETE FROM "Attendance";

-- 3. Stock & Expenses
DELETE FROM "MouvementStock";
DELETE FROM "Depense";
DELETE FROM "EcheancePaiement";
DELETE FROM "FactureFournisseur";

-- 4. Sales & Clients
DELETE FROM "RewardRedemption";
DELETE FROM "PointsHistory";
DELETE FROM "Facture";
DELETE FROM "Fiche";
DELETE FROM "Client";

-- 5. Reset Product Quantities
UPDATE "Product" SET "quantiteActuelle" = 0;

COMMIT;
