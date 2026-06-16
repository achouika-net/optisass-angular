SELECT "factureId", count(DISTINCT notes) as note_types, count(*) as total_payments 
FROM "Paiement" 
GROUP BY "factureId" 
HAVING count(DISTINCT notes) > 1;
