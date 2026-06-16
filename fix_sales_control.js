const fs = require('fs');
const filePath = 'backend/src/features/sales-control/sales-control.service.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove facturesWithFiche query
content = content.replace(
  /\/\/ First, get the ficheIds of all real Factures.*?\n\s*const facturesWithFiche = await this\.prisma\.facture\.findMany\(\{\s*where: \{\s*centreId,\s*type: 'FACTURE',\s*ficheId: \{ not: null \},\s*\.\.\.dateFilter,\s*\},\s*select: \{ ficheId: true \},\s*\}\);\s*const factureFicheIds = facturesWithFiche\s*\.map\(\(f\) => f\.ficheId\)\s*\.filter\(\(id\): id is string => !!id\);/s,
  ''
);

// 2. Remove ficheId: { notIn: factureFicheIds } from bcAgg
content = content.replace(
  /ficheId: \{ notIn: factureFicheIds \},\s*OR: \[/g,
  'OR: ['
);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Updated sales-control.service.ts");
