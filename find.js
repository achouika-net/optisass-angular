const fs = require('fs');
const lines = fs.readFileSync('backend/src/features/imports/imports.service.ts', 'utf8').split('\n');
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('const ficheObject')) {
     console.log(lines.slice(i, i+15).join('\n'));
     break;
  }
}
