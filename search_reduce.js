const fs = require('fs');
const files = ['backend/src/features/factures/factures.service.ts', 'backend/src/features/imports/imports.service.ts'];
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('lignes.reduce')) {
    console.log(`Found in ${file}`);
  }
}
