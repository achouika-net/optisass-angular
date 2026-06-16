SELECT fact.numero, fact."totalTTC", fact.type
FROM "Fiche" f
LEFT JOIN "Facture" fact ON fact."ficheId" = f.id
WHERE f.numero = '17166';
