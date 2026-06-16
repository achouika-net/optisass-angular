SELECT numero, "totalTTC" FROM "Facture" WHERE type = 'FACTURE' AND "ficheId" IS NULL ORDER BY "totalTTC" DESC LIMIT 20;
