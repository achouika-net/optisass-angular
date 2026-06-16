const fs = require('fs');
const file = 'backend/src/features/imports/imports.service.ts';
let content = fs.readFileSync(file, 'utf8');

// Fix 1: Fallback date_ordonnance to dateCreation if empty
content = content.replace(
    /dateOrdonnance: parseDate\(pm\.date_ordonnance\),/g,
    'dateOrdonnance: parseDate(pm.date_ordonnance) || parseDate(pm.dateCreation),'
);

// Fix 2: Add dateLivraisonEstimee directly to the ficheObject
content = content.replace(
    /dateCreation: parseDate\(pm\.dateCreation\) \|\| new Date\(\),/g,
    'dateCreation: parseDate(pm.dateCreation) || new Date(),\n              dateLivraisonEstimee: parseDate(pm.dateLivraisonEstimee),'
);

fs.writeFileSync(file, content);
console.log('Patch applied successfully.');
