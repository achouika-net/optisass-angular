SELECT notes, count(*), sum(montant) FROM "Paiement" GROUP BY notes;
