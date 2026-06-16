const fs = require('fs');
const file = 'backend/src/features/imports/imports.service.ts';
let content = fs.readFileSync(file, 'utf8');

const targetInit = 'const paymentsToCreate: any[] = [];\n        const factureUpdates = new Map();';
const newInit = 'const paymentsToCreate: any[] = [];\n        const factureUpdates = new Map();\n        const facturesWithNewPayments = new Set<string>();';
content = content.replace(targetInit, newInit);

const targetPush = 'paymentsToCreate.push({\n            factureId: facture.id,\n            montant,\n            date: datePaiement,';
const newPush = 'facturesWithNewPayments.add(facture.id);\n          paymentsToCreate.push({\n            factureId: facture.id,\n            montant,\n            date: datePaiement,';
content = content.replace(targetPush, newPush);

const targetBulk = 'console.log(\n          `[ImportLog] Phase 3: Bulk inserting ${paymentsToCreate.length} payments...`,\n        );';
const newBulk = 'console.log(\n          `[ImportLog] Phase 3: Bulk inserting ${paymentsToCreate.length} payments...`,\n        );\n        if (facturesWithNewPayments.size > 0) {\n          console.log(`[ImportLog] Removing previous Acompte Import for ${facturesWithNewPayments.size} factures...`);\n          await this.prisma.paiement.deleteMany({\n            where: {\n              factureId: { in: Array.from(facturesWithNewPayments) },\n              notes: \'Acompte Import (Délivrance)\'\n            }\n          });\n        }';
content = content.replace(targetBulk, newBulk);

fs.writeFileSync(file, content);
console.log('Patch for deduplication applied successfully.');
