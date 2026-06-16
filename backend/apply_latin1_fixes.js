const fs = require('fs');
const path = require('path');

const importsPath = path.join(__dirname, 'src/features/imports/imports.service.ts');
const treasuryPath = path.join(__dirname, 'src/features/treasury/treasury.service.ts');

const CHEQUE = 'CH\u00C8QUE'; // CHÈQUE (byte 0xC8)
const ESPECES = 'LIQUIDE';

// === FIX IMPORTS SERVICE ===
let importsContent = fs.readFileSync(importsPath, 'latin1');

// 1. replace normalizePaymentType return value and matching
const normalizeRegex = /private\s+normalizePaymentType\([\s\S]*?return\s+s;\s*\}/;
const newNormalize = `  private normalizePaymentType(type: any): string {
    if (!type) return 'LIQUIDE';
    const s = String(type).trim().toUpperCase();
    if (s.includes('ESPECE') || s.includes('LIQUIDE') || s.includes('CASH') || s === 'LQR') return 'LIQUIDE';
    if (s.includes('CHEQUE') || s.includes('CHQUE') || s.includes('CH\u00CAQUE') || s.includes('CH\u00C9QUE') || s.includes('CH\u00C8QUE') || s.includes('CH^QUE')) return 'CH\u00C8QUE';
    if (s.includes('EFFET') || s === 'LCN') return 'LCN';
    if (s.includes('VIREMENT') || s.includes('PRELEVEMENT') || s.includes('PRVEMENT') || s.includes('PRLVEMENT') || s.includes('PR%L^VEMENT') || s.includes('PR%LEVEMENT') || s.includes('PREL^VEMENT') || s.includes('PRLVEMENT')) return 'VIREMENT';
    if (s.includes('CARTE')) return 'CARTE BANCAIRE';
    if (s.includes('AVOIR')) return 'AVOIR';
    if (s.includes('GESTE')) return 'GESTE COMMERCIAL';
    if (s.includes('NON REGL') || s.includes('NON REGL') || s.includes('NON REGLE') || s.includes('NON_REGLE') || s.includes('NON REGL%') || s.includes('NON REGL^')) return 'NON_REGLE';
    return s;
  }`;

if (normalizeRegex.test(importsContent)) {
  importsContent = importsContent.replace(normalizeRegex, newNormalize);
  console.log('Normalized payment type fixed in imports.service.ts');
} else {
  console.log('Could not find normalizePaymentType in imports.service.ts');
}

// 2. replace modeSource in importPaiementsClients
const oldPaiementBlock = `        const modeSource = row[mapping.modePaiement]
          ? this.normalizePaymentType(row[mapping.modePaiement])
          : 'LIQUIDE';`;
// Ensure we write exactly what we want
const newPaiementBlock = `        const modeSource = row[mapping.modePaiement]
          ? this.normalizePaymentType(row[mapping.modePaiement])
          : 'LIQUIDE';`;

fs.writeFileSync(importsPath, importsContent, 'latin1');
console.log('imports.service.ts written in latin1');


// === FIX TREASURY SERVICE ===
let treasuryContent = fs.readFileSync(treasuryPath, 'latin1');

// 1. replace inChequeStats mode matching
// We will replace the block containing inChequeStats
const chequeBlockRegex = /const\s+inChequeStats\s*=\s*await\s+this\.prisma\.paiement\.aggregate\(\{[\s\S]*?mode:\s*\{\s*in:\s*\[[\s\S]*?\]\s*\}[\s\S]*?\}\);/;

const newChequeBlock = `const inChequeStats = await this.prisma.paiement.aggregate({
      where: {
        facture: { centreId: normalizedCentreId },
        ...(dateFilter ? { date: dateFilter } : {}),
        statut: { in: paidStatuses },
        mode: { in: ['CHEQUE', 'CH\u00C8QUE', 'CH\u00CAQUE', 'CH\u00C9QUE', 'CH^QUE'] },
      },
      _sum: { montant: true },
    });`;

if (chequeBlockRegex.test(treasuryContent)) {
  treasuryContent = treasuryContent.replace(chequeBlockRegex, newChequeBlock);
  console.log('inChequeStats fixed in treasury.service.ts');
} else {
  console.log('Could not find inChequeStats in treasury.service.ts');
}

fs.writeFileSync(treasuryPath, treasuryContent, 'latin1');
console.log('treasury.service.ts written in latin1');
