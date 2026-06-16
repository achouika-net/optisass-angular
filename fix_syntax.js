const fs = require('fs');
const filePath = 'backend/src/features/sales-control/sales-control.service.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Fix the syntax error
content = content.replace(/const  = 0;/g, '');

fs.writeFileSync(filePath, content, 'utf8');
console.log("Fixed syntax error.");
