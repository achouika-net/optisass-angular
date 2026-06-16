const xlsx = require('xlsx');
const wb = xlsx.readFile('C:/Users/ASUS/Downloads/DOSSIERCLIENTtest.xlsx');
console.log('Sheets:', wb.SheetNames);
const sheetName = wb.SheetNames[0];
const ws = wb.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(ws);

console.log('Total Rows:', data.length);
if (data.length > 0) {
  console.log('Row 0 Keys:', Object.keys(data[0]));
  console.log('Row 0 Data:', data[0]);
}

const valideValues = new Set();
const factureValues = new Set();
let sumTTC = 0;
let devisCount = 0;
let devisSumTTC = 0;
let bcCount = 0;
let bcSumTTC = 0;
let factCount = 0;
let factSumTTC = 0;

data.forEach((row, index) => {
  valideValues.add(row['Valide'] !== undefined ? String(row['Valide']) : 'undefined');
  factureValues.add(row['Facture'] !== undefined ? String(row['Facture']) : 'undefined');

  const rawValide = String(row['Valide'] ?? '').toLowerCase().trim();
  const rawFacture = String(row['Facture'] ?? '').toLowerCase().trim();

  const isValide = ['vrai', 'true', 'oui', 'yes', '1', 'valide', 'validé', 'valider'].includes(rawValide) || row['Valide'] === true;
  const isFacture = ['vrai', 'true', 'oui', 'yes', '1', 'facture', 'facturée', 'facturee'].includes(rawFacture) || row['Facture'] === true;

  const ttc = parseFloat(row['Total TTC'] || row['Montant TTC'] || row['TTC'] || 0) || 0;
  sumTTC += ttc;

  if (!isValide) {
    devisCount++;
    devisSumTTC += ttc;
  } else {
    if (isFacture) {
      factCount++;
      factSumTTC += ttc;
    } else {
      bcCount++;
      bcSumTTC += ttc;
    }
  }
});

console.log('Unique Valide values in Excel:', Array.from(valideValues));
console.log('Unique Facture values in Excel:', Array.from(factureValues));
console.log('Total TTC Sum:', sumTTC);
console.log(`Classified Devis: count=${devisCount}, sumTTC=${devisSumTTC}`);
console.log(`Classified BC: count=${bcCount}, sumTTC=${bcSumTTC}`);
console.log(`Classified Facture: count=${factCount}, sumTTC=${factSumTTC}`);
