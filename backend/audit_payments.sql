SELECT COUNT(*) as total_count, 
       SUM(montant) as total_amount,
       MIN("datePaiement") as oldest,
       MAX("datePaiement") as newest
FROM public."Paiement"
WHERE statut != 'ANNULE';
