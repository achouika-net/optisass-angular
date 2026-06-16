const fs = require('fs');
let file = 'backend/src/features/imports/imports.service.ts';
let content = fs.readFileSync(file, 'utf8');

// The array push needs to be a string
const badString = "mode: 'ESPECES', // Assuming cash for acompte import\r\n            statut: 'ENCAISSE',\r\n            notes: { startsWith: 'Acompte Import' },";
const goodString = "mode: 'ESPECES', // Assuming cash for acompte import\n            statut: 'ENCAISSE',\n            notes: 'Acompte Import (Délivrance)',";

content = content.replace(/mode: 'ESPECES',\s*\/\/\s*Assuming cash for acompte import\s*statut: 'ENCAISSE',\s*notes: { startsWith: 'Acompte Import' },/g, goodString);

fs.writeFileSync(file, content);
console.log('Fixed push logic.');
