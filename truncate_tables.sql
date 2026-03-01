-- Vider EcheancePaiement d'abord (dépend de FactureFournisseur et Depense)
TRUNCATE TABLE "EcheancePaiement" RESTART IDENTITY CASCADE;

-- Vider Depense (peut avoir des FK vers EcheancePaiement déjà vidé)
TRUNCATE TABLE "Depense" RESTART IDENTITY CASCADE;

-- Vider FactureFournisseur
TRUNCATE TABLE "FactureFournisseur" RESTART IDENTITY CASCADE;

-- Vérification
SELECT 'EcheancePaiement' as table_name, COUNT(*) as lignes FROM "EcheancePaiement"
UNION ALL
SELECT 'Depense', COUNT(*) FROM "Depense"
UNION ALL
SELECT 'FactureFournisseur', COUNT(*) FROM "FactureFournisseur";
