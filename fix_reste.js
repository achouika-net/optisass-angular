const fs = require('fs');
const filePath = 'backend/src/features/sales-control/sales-control.service.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Replace totalReste calculation
content = content.replace(
  /const totalReste = totalFacturesReste \+ totalBMReste - totalAvoirsReste;/g,
  'const totalReste = Math.max(0, totalAmount - totalEncaissePeriod); // User requested mathematically aligned Reste'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Updated totalReste calculation in sales-control.service.ts");
