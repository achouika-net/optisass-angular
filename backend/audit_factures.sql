SELECT COUNT(*) as total_count, 
       SUM("totalHT") as total_amount,
       MIN("dateEmission") as oldest,
       MAX("dateEmission") as newest
FROM public."Facture"
WHERE type IN ('FACTURE', 'BON_COMMANDE') 
AND statut IN ('VALIDE', 'VALIDEE', 'PAYEE', 'SOLDEE', 'ENCAISSE', 'PARTIEL');
