const fs = require('fs');
const filePath = 'backend/src/features/sales-control/sales-control.service.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Revert the previous bad replace
content = content.replace(
  /const totalReste = Math\.max\(0, totalAmount - totalEncaissePeriod\); \/\/ User requested mathematically aligned Reste/g,
  'const totalReste_placeholder = 0;'
);

// Find where totalEncaissePeriod is declared and append totalReste after it
content = content.replace(
  /(const totalEncaissePeriod = payments\.reduce\(\(sum, p\) => sum \+ p\.total, 0\);)/g,
  "$1\n    const totalReste = Math.max(0, totalAmount - totalEncaissePeriod);"
);

// Now in the stats array, replace totalReste_placeholder or just let it use totalReste
content = content.replace(
  /totalReste_placeholder/g,
  ''
);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Fixed totalReste declaration scope.");
