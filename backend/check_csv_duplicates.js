const fs = require('fs');
const content = fs.readFileSync('c:/Users/ASUS/.gemini/antigravity/playground/golden-cluster/export_factures_ttc.csv', 'utf8');
const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

const numberMap = new Map();
let totalAllRows = 0;
let rowCount = 0;

for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split(';');
  const num = parts[0].trim();
  const ttc = parseFloat(parts[1]);
  if (!isNaN(ttc)) {
    totalAllRows += ttc;
    rowCount++;
    if (!numberMap.has(num)) {
      numberMap.set(num, []);
    }
    numberMap.get(num).push(ttc);
  }
}

console.log('Total Rows:', rowCount);
console.log('Total Sum of All Rows:', totalAllRows);
console.log('Unique Invoice Numbers:', numberMap.size);

let uniqueSum = 0;
let duplicatesCount = 0;
for (const [num, list] of numberMap.entries()) {
  uniqueSum += list[0]; // Take only the first row for each invoice
  if (list.length > 1) {
    duplicatesCount++;
    console.log(`Duplicate: ${num}, Rows: ${list.length}, Values: ${list.join(', ')}`);
  }
}

console.log('Sum of Unique Invoices (taking first):', uniqueSum);
console.log('Number of Duplicate Invoice Numbers:', duplicatesCount);
