SELECT f.numero, f."montantTotal", f."montantPaye", fact.numero as facture_numero, fact."totalTTC" as facture_ttc, fact.type as facture_type
FROM "Fiche" f
LEFT JOIN "Facture" fact ON fact."ficheId" = f.id
WHERE f.numero IN ('17166', '14222', '13120', '14873', '14590');
