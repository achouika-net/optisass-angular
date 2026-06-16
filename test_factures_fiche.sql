SELECT fact.numero as facture_numero, fact."totalTTC", f.numero as fiche_numero
FROM "Facture" fact
LEFT JOIN "Fiche" f ON fact."ficheId" = f.id
WHERE fact.numero IN ('Fact-174/2025', 'Fact-181/2025', 'Fact-77/2026', 'Fact-220/2025');
