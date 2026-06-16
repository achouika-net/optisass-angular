const xlsx = require('xlsx');
const wb = xlsx.readFile('C:/Users/ASUS/Downloads/DOSSIERCLIENT.xlsx');
const ws = wb.Sheets['DOSSIERCLIENT'];
const data = xlsx.utils.sheet_to_json(ws);
console.log('--- FIRST 20 ROWS PREVIEW ---');
data.slice(0, 20).forEach((row, i) => {
  console.log(`Row ${i}: Client=${row.Client}, Date=${row.Date}, TotalTTC=${row['Total TTC']}, Acompte=${row.Acompte}, Valide=${row.Valide}, Facture=${row.Facture}, Compteur=${row.Compteur}, TypeDossier=${row.TypeDossier}`);
});
