SELECT f.id, f."totalTTC", 
  (SELECT SUM(montant) FROM "Paiement" WHERE "factureId" = f.id AND notes LIKE 'Acompte Import%') as acompte,
  (SELECT SUM(montant) FROM "Paiement" WHERE "factureId" = f.id AND (notes IS NULL OR notes NOT LIKE 'Acompte Import%')) as paiement
FROM "Facture" f
WHERE (SELECT SUM(montant) FROM "Paiement" WHERE "factureId" = f.id) > 0
LIMIT 20;
