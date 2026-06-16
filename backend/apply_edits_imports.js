const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/features/imports/imports.service.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. normalizePaymentType replacement
const oldNormalize = `  private normalizePaymentType(type: any): string {
    if (!type) return 'ESPECES';
    const s = String(type).trim().toUpperCase();
    if (s.includes('ESPECE') || s.includes('LIQUIDE') || s.includes('CASH') || s === 'LQR') return 'ESPECES';
    if (s.includes('CHEQUE') || s.includes('CHQUE') || s.includes('CH^QUE') || s.includes('CH%QUE') || s.includes('CHQUE')) return 'CHEQUE';
    if (s.includes('EFFET') || s === 'LCN') return 'LCN';
    if (s.includes('VIREMENT') || s.includes('PRELEVEMENT') || s.includes('PRVEMENT') || s.includes('PRLVEMENT') || s.includes('PR%L^VEMENT') || s.includes('PR%LEVEMENT') || s.includes('PREL^VEMENT') || s.includes('PRLVEMENT')) return 'VIREMENT';
    if (s.includes('CARTE')) return 'CARTE';
    if (s.includes('AVOIR')) return 'AVOIR';
    if (s.includes('GESTE')) return 'PRISE_EN_CHARGE';
    if (s.includes('NON REGL') || s.includes('NON REGL') || s.includes('NON REGLE') || s.includes('NON_REGLE') || s.includes('NON REGL%') || s.includes('NON REGL^')) return 'NON_REGLE';
    return s;
  }`;

// Note that depending on encoding/platform, there might be slight variations, let's verify if the search works.
// To be extremely robust, we can use a regex or check if this exact block exists, otherwise do a smaller search or regex search.

const newNormalize = `  private normalizePaymentType(type: any): string {
    if (!type) return 'LIQUIDE';
    const s = String(type).trim().toUpperCase();
    if (s.includes('ESPECE') || s.includes('LIQUIDE') || s.includes('CASH') || s === 'LQR') return 'LIQUIDE';
    if (s.includes('CHEQUE') || s.includes('CHQUE') || s.includes('CHQUE') || s.includes('CH^QUE') || s.includes('CH%QUE') || s.includes('CHQUE') || s.includes('CHÈQUE') || s.includes('CHÉQUE')) return 'CHÈQUE';
    if (s.includes('EFFET') || s === 'LCN') return 'LCN';
    if (s.includes('VIREMENT') || s.includes('PRELEVEMENT') || s.includes('PRVEMENT') || s.includes('PRLVEMENT') || s.includes('PR%L^VEMENT') || s.includes('PR%LEVEMENT') || s.includes('PREL^VEMENT') || s.includes('PRLVEMENT')) return 'VIREMENT';
    if (s.includes('CARTE')) return 'CARTE BANCAIRE';
    if (s.includes('AVOIR')) return 'AVOIR';
    if (s.includes('GESTE')) return 'GESTE COMMERCIAL';
    if (s.includes('NON REGL') || s.includes('NON REGL') || s.includes('NON REGLE') || s.includes('NON_REGLE') || s.includes('NON REGL%') || s.includes('NON REGL^')) return 'NON_REGLE';
    return s;
  }`;

// 2. importPaiementsClients montant and modeSource replacement
const oldPaiementBlock = `        const montant = Math.abs(parseFloat(row[mapping.montant]) || 0);
        if (montant === 0) {
          results.skipped++;
          continue;
        }

        const datePaiement =
          this.parseDate(row[mapping.datePaiement]) || new Date();
        const modeSource = row[mapping.modePaiement]
          ? String(row[mapping.modePaiement]).trim().toUpperCase()
          : 'ESPECES';`;

const newPaiementBlock = `        const montant = Math.abs(this.parseAmount(row[mapping.montant]) || 0);
        if (montant === 0) {
          results.skipped++;
          continue;
        }

        const datePaiement =
          this.parseDate(row[mapping.datePaiement]) || new Date();
        const modeSource = row[mapping.modePaiement]
          ? this.normalizePaymentType(row[mapping.modePaiement])
          : 'LIQUIDE';`;

// 3. importFacturesVentes parseFloat rowTTC and totalTTC
const oldRowTTC = `              const rowTTC = parseFloat(String(row[mapping.totalTTC] || 0)) || 0;`;
const newRowTTC = `              const rowTTC = this.parseAmount(row[mapping.totalTTC]) || 0;`;

const oldTotalTTC = `        const totalTTC = parseFloat(String(row[mapping.totalTTC] || 0)) || 0;`;
const newTotalTTC = `        const totalTTC = this.parseAmount(row[mapping.totalTTC]) || 0;`;

// 4. importProducts parseFloat value
const oldProductValue = `              value = parseFloat(value) || 0;`;
const newProductValue = `              value = this.parseAmount(value) || 0;`;

let modified = false;

// We use string replacement but since encoding of "CHQUE" etc can be tricky, let's also support regex replacements if simple index doesn't find it.
if (content.includes('private normalizePaymentType(type: any)')) {
  console.log('Found normalizePaymentType function signature');
}

// Let's replace normalizePaymentType using regex to avoid encoding issues
const normalizeRegex = /private\s+normalizePaymentType\([\s\S]*?return\s+s;\s*\}/;
if (normalizeRegex.test(content)) {
  console.log('Found normalizePaymentType via regex');
  content = content.replace(normalizeRegex, newNormalize);
  modified = true;
} else {
  console.log('Regex did NOT match normalizePaymentType');
}

if (content.includes(oldPaiementBlock)) {
  content = content.replace(oldPaiementBlock, newPaiementBlock);
  console.log('Replaced client payment block successfully');
  modified = true;
} else {
  // Let's try matching with slightly different whitespaces/carriage returns
  const normalizedOld = oldPaiementBlock.replace(/\r\n/g, '\n');
  const normalizedContent = content.replace(/\r\n/g, '\n');
  if (normalizedContent.includes(normalizedOld)) {
    content = normalizedContent.replace(normalizedOld, newPaiementBlock.replace(/\r\n/g, '\n'));
    console.log('Replaced client payment block successfully (normalized LF)');
    modified = true;
  } else {
    console.log('Failed to find client payment block');
  }
}

if (content.includes(oldRowTTC)) {
  content = content.replace(oldRowTTC, newRowTTC);
  console.log('Replaced rowTTC successfully');
  modified = true;
} else {
  console.log('Failed to find rowTTC');
}

if (content.includes(oldTotalTTC)) {
  content = content.replace(oldTotalTTC, newTotalTTC);
  console.log('Replaced totalTTC successfully');
  modified = true;
} else {
  console.log('Failed to find totalTTC');
}

if (content.includes(oldProductValue)) {
  content = content.replace(oldProductValue, newProductValue);
  console.log('Replaced product value parseFloat successfully');
  modified = true;
} else {
  console.log('Failed to find product value parseFloat');
}

if (modified) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('imports.service.ts written successfully');
} else {
  console.log('No modifications made to imports.service.ts!');
}
