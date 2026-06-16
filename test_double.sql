SELECT "factureId", count(*) as cnt, sum(montant) FROM "Paiement" WHERE notes LIKE 'Acompte Import%' GROUP BY "factureId" HAVING count(*) > 1;
