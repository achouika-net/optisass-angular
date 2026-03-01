-- Nombre de BL par centreId
SELECT "centreId", COUNT(*) as nb FROM "BonLivraison" GROUP BY "centreId" ORDER BY nb DESC LIMIT 10;

-- Voir les centreIds existants
SELECT id, nom FROM "Centre";
