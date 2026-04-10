-- Simule ce que le backend Prisma ferait avec page=1, limit=10, centreId donné
SELECT COUNT(*) as total
FROM "BonLivraison"
WHERE "centreId" = '6df7de62-498e-4784-b22f-7bbccc7fea36';

-- Et voir les 10 premiers
SELECT id, "numeroBL", "dateEmission", "statut", "montantTTC"
FROM "BonLivraison"
WHERE "centreId" = '6df7de62-498e-4784-b22f-7bbccc7fea36'
ORDER BY "dateEmission" DESC
LIMIT 10;
