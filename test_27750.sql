WITH factures AS (
  SELECT id, numero, "totalTTC" FROM "Facture" WHERE type = 'FACTURE'
)
SELECT a.numero, a."totalTTC", b.numero, b."totalTTC", c.numero, c."totalTTC", d.numero, d."totalTTC", e.numero, e."totalTTC"
FROM factures a
JOIN factures b ON a.id < b.id
JOIN factures c ON b.id < c.id
JOIN factures d ON c.id < d.id
JOIN factures e ON d.id < e.id
WHERE a."totalTTC" + b."totalTTC" + c."totalTTC" + d."totalTTC" + e."totalTTC" = 27750
LIMIT 1;
