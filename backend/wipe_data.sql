-- Script to completely wipe all imported data tables
TRUNCATE TABLE "Paiement" CASCADE;
TRUNCATE TABLE "EcheancePaiement" CASCADE;
TRUNCATE TABLE "Depense" CASCADE;
TRUNCATE TABLE "Facture" CASCADE;
TRUNCATE TABLE "FactureFournisseur" CASCADE;
TRUNCATE TABLE "MouvementStock" CASCADE;
TRUNCATE TABLE "Fiche" CASCADE;
TRUNCATE TABLE "Client" CASCADE;
TRUNCATE TABLE "Fournisseur" CASCADE;
