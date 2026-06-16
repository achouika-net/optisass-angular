const xlsx = require('xlsx');
const wb = xlsx.readFile('C:/Users/ASUS/Downloads/DOSSIERCLIENT.xlsx');
const ws = wb.Sheets['DOSSIERCLIENT'];
const data = xlsx.utils.sheet_to_json(ws);

const mapping = {
  fiche_id: 'Compteur',
  numero: 'Fiche',
  codeClient: 'Client',
  nom: 'Client',
  acompte: 'Acompte',
  montantTotal: 'Total TTC',
  totalTTC: 'Total TTC',
  valide: 'Valide',
  facture: 'Facture',
  dateCreation: 'Date'
};

const groupedFiches = new Map();
data.forEach((row, idx) => {
  const fid = row[mapping.fiche_id] || row[mapping.numero] || null;
  const clientCode = row[mapping.codeClient] || '';
  
  let key = '';
  if (fid && fid !== '0' && fid !== 0) {
    const clientCodeForKey = String(clientCode).trim().toLowerCase();
    key = `FID_${fid}_CLI_${clientCodeForKey}`;
  } else {
    key = `UNIQUE_${idx}`;
  }

  if (!groupedFiches.has(key)) groupedFiches.set(key, []);
  groupedFiches.get(key).push(row);
});

console.log('Total Grouped Fiches:', groupedFiches.size);

let devisCount = 0;
let devisSumTTC = 0;
let bcCount = 0;
let bcSumTTC = 0;
let factCount = 0;
let factSumTTC = 0;

let devisWithPaymentCount = 0;
let devisWithoutPaymentCount = 0;

let index = 0;
for (const [key, rows] of groupedFiches.entries()) {
  const pm = rows[0];
  
  let isValide = true;
  if (pm[mapping.valide] !== undefined) {
    const rawValide = String(pm[mapping.valide] ?? '').toLowerCase().trim();
    isValide = ['vrai', 'true', 'oui', 'yes', '1', 'valide', 'validé', 'valider'].includes(rawValide) || pm[mapping.valide] === true;
  }

  let isFacture = false;
  if (pm[mapping.facture] !== undefined) {
    const rawFacture = String(pm[mapping.facture] ?? '').toLowerCase().trim();
    isFacture = ['vrai', 'true', 'oui', 'yes', '1', 'facture', 'facturée', 'facturee'].includes(rawFacture) || pm[mapping.facture] === true;
  }

  const totalAmount = parseFloat(pm[mapping.totalTTC] || 0) || 0;
  const totalPaye = rows.reduce((sum, r) => sum + (parseFloat(r[mapping.acompte] || 0) || 0), 0);

  let docType = 'DEVIS';
  if (isValide) {
    if (isFacture) {
      docType = 'FACTURE';
    } else {
      docType = 'BON_COMMANDE';
    }
  }

  if (docType === 'DEVIS') {
    devisCount++;
    devisSumTTC += totalAmount;
    if (totalPaye > 0) {
      devisWithPaymentCount++;
    } else {
      devisWithoutPaymentCount++;
    }
  } else if (docType === 'BON_COMMANDE') {
    bcCount++;
    bcSumTTC += totalAmount;
  } else if (docType === 'FACTURE') {
    factCount++;
    factSumTTC += totalAmount;
  }
}

console.log(`Classified Devis: count=${devisCount} (with payments: ${devisWithPaymentCount}, without: ${devisWithoutPaymentCount}), sumTTC=${devisSumTTC}`);
console.log(`Classified BC: count=${bcCount}, sumTTC=${bcSumTTC}`);
console.log(`Classified Facture: count=${factCount}, sumTTC=${factSumTTC}`);
console.log(`Total Classified: count=${devisCount + bcCount + factCount}, sumTTC=${devisSumTTC + bcSumTTC + factSumTTC}`);
