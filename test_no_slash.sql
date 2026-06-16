SELECT numero, "totalTTC" FROM "Facture" WHERE type = 'FACTURE' AND numero NOT LIKE '%/%' ORDER BY "totalTTC" DESC;
