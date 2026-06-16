const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/features/treasury/treasury.service.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. inChequeStats replacement
const chequeBlockRegex = /const\s+inChequeStats\s*=\s*await\s+this\.prisma\.paiement\.aggregate\(\{[\s\S]*?mode:\s*\{\s*in:\s*\[\s*'CHEQUE'\s*,\s*'CH.*?QUE'\s*,\s*'LCN'\s*\]\s*\}[\s\S]*?\}\);/;

const newChequeAndLcnBlocks = `const inChequeStats = await this.prisma.paiement.aggregate({
      where: {
        facture: { centreId: normalizedCentreId },
        ...(dateFilter ? { date: dateFilter } : {}),
        statut: { in: paidStatuses },
        mode: { in: ['CHEQUE', 'CHÈQUE', 'CHÊQUE', 'CHÉQUE', 'CH^QUE'] },
      },
      _sum: { montant: true },
    });

    const inLCNStats = await this.prisma.paiement.aggregate({
      where: {
        facture: { centreId: normalizedCentreId },
        ...(dateFilter ? { date: dateFilter } : {}),
        statut: { in: paidStatuses },
        mode: { in: ['LCN', 'EFFET', 'EFFET LCN', 'TRAITE'] },
      },
      _sum: { montant: true },
    });`;

let modified = false;

if (chequeBlockRegex.test(content)) {
  console.log('Found inChequeStats block using regex');
  content = content.replace(chequeBlockRegex, newChequeAndLcnBlocks);
  modified = true;
} else {
  console.log('Regex did NOT match inChequeStats block');
}

// 2. Return fields replacement
const oldReturnFields = `      incomingCash: Number(inCashStats._sum?.montant || 0),
      incomingCard: Number(inCardStats._sum?.montant || 0),
      incomingCheque: Number(inChequeStats._sum?.montant || 0),
      incomingVirement: Number(inVirementStats._sum?.montant || 0),`;

const newReturnFields = `      incomingCash: Number(inCashStats._sum?.montant || 0),
      incomingCard: Number(inCardStats._sum?.montant || 0),
      incomingCheque: Number(inChequeStats._sum?.montant || 0),
      incomingLCN: Number(inLCNStats._sum?.montant || 0),
      incomingVirement: Number(inVirementStats._sum?.montant || 0),`;

if (content.includes(oldReturnFields)) {
  content = content.replace(oldReturnFields, newReturnFields);
  console.log('Replaced return fields successfully');
  modified = true;
} else {
  // Let's try matching with LF only
  const normalizedOld = oldReturnFields.replace(/\r\n/g, '\n');
  const normalizedContent = content.replace(/\r\n/g, '\n');
  if (normalizedContent.includes(normalizedOld)) {
    content = normalizedContent.replace(normalizedOld, newReturnFields.replace(/\r\n/g, '\n'));
    console.log('Replaced return fields successfully (normalized LF)');
    modified = true;
  } else {
    console.log('Failed to find return fields in getMonthlySummary');
  }
}

if (modified) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('treasury.service.ts written successfully');
} else {
  console.log('No modifications made to treasury.service.ts!');
}
