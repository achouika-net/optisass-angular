const fs = require('fs');
let file = 'backend/src/features/imports/imports.service.ts';
let content = fs.readFileSync(file, 'utf8');

const s1 = "notes: 'Acompte Import (Délivrance)'";
const r1 = "notes: { startsWith: 'Acompte Import' }";

if (content.includes("notes: 'Acompte Import (Dlivrance)'")) {
    content = content.replace("notes: 'Acompte Import (Dlivrance)'", r1);
}
if (content.includes("notes: 'Acompte Import (Délivrance)'")) {
    content = content.replace("notes: 'Acompte Import (Délivrance)'", r1);
}

// Since characters might be completely mangled, let's just use a regex replace
content = content.replace(/notes:\s*'Acompte Import.*'/g, "notes: { startsWith: 'Acompte Import' }");

fs.writeFileSync(file, content);
console.log('Fixed startsWith logic.');
