SELECT 'Clients' as table, count(*) as count FROM "Client"
UNION ALL
SELECT 'Fiches', count(*) FROM "Fiche";
