const fs = require('fs');
const content = fs.readFileSync('c:/Users/ASUS/.gemini/antigravity/playground/golden-cluster/export_factures_ttc.csv', 'utf16le');
const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
let totalSum = 0;
let rowCount = 0;
for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split(';');
  const ttc = parseFloat(parts[1]);
  if (!isNaN(ttc)) {
    totalSum += ttc;
    rowCount++;
  }
}
console.log('Row Count:', rowCount);
console.log('Total Sum:', totalSum);
