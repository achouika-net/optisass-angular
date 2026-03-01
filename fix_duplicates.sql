-- Vérifier les duplicates de bonLivraisonId
SELECT "bonLivraisonId", COUNT(*) as c 
FROM "Depense" 
WHERE "bonLivraisonId" IS NOT NULL 
GROUP BY "bonLivraisonId" 
HAVING COUNT(*) > 1;

-- Supprimer les duplicates (garder le premier enregistrement, supprimer les autres)
DELETE FROM "Depense"
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY "bonLivraisonId" ORDER BY "createdAt") as rn
    FROM "Depense"
    WHERE "bonLivraisonId" IS NOT NULL
  ) t
  WHERE rn > 1
);

-- Vérifier qu'il n'y a plus de duplicates
SELECT COUNT(*) as "duplicates_restants"
FROM "Depense" 
WHERE "bonLivraisonId" IS NOT NULL 
GROUP BY "bonLivraisonId" 
HAVING COUNT(*) > 1;
