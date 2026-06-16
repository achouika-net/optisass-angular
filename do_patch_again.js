const fs = require('fs');
let file = 'imports.service.ts.bak';
let content = fs.readFileSync(file, 'utf8');

// The exact string to replace in importPaiementsClients:
const searchTarget = "        const paymentsToCreate: any[] = [];\r\n        const factureUpdates = new Map();\r\n\r\n        for (let index = 0; index < data.length; index++) {";
const replTarget = "        const paymentsToCreate: any[] = [];\n        const factureUpdates = new Map();\n        const facturesWithNewPayments = new Set<string>();\n\n        for (let index = 0; index < data.length; index++) {";

content = content.replace(searchTarget, replTarget);
if (!content.includes("facturesWithNewPayments = new Set")) {
    const s2 = "        const paymentsToCreate: any[] = [];\n        const factureUpdates = new Map();\n\n        for (let index = 0; index < data.length; index++) {";
    content = content.replace(s2, replTarget);
}

const searchTarget2 = "        paymentsToCreate.push({\r\n            factureId: facture.id,\r\n            montant,\r\n            date: datePaiement,";
const replTarget2 = "        facturesWithNewPayments.add(facture.id);\n        paymentsToCreate.push({\n            factureId: facture.id,\n            montant,\n            date: datePaiement,";

// Wait, there are multiple paymentsToCreate.push!
// The one in importPaiementsClients has:
//        const banque = banqueVal ? String(banqueVal).trim() : null;
//  
//        paymentsToCreate.push({

const searchTarget2_specific = "const banque = banqueVal ? String(banqueVal).trim() : null;\r\n\r\n        paymentsToCreate.push({\r\n            factureId: facture.id,";
const replTarget2_specific = "const banque = banqueVal ? String(banqueVal).trim() : null;\n\n        facturesWithNewPayments.add(facture.id);\n        paymentsToCreate.push({\n            factureId: facture.id,";

content = content.replace(searchTarget2_specific, replTarget2_specific);
if (!content.includes("facturesWithNewPayments.add(")) {
    const s22 = "const banque = banqueVal ? String(banqueVal).trim() : null;\n\n        paymentsToCreate.push({\n            factureId: facture.id,";
    content = content.replace(s22, replTarget2_specific);
}

const searchTarget3 = "        console.log(\r\n          `[ImportLog] Phase 3: Bulk inserting ${paymentsToCreate.length} payments...`,\r\n        );";
const replTarget3 = "        console.log(\n          `[ImportLog] Phase 3: Bulk inserting ${paymentsToCreate.length} payments...`,\n        );\n        if (facturesWithNewPayments.size > 0) {\n          console.log(`[ImportLog] Removing previous Acompte Import for ${facturesWithNewPayments.size} factures...`);\n          await this.prisma.paiement.deleteMany({\n            where: {\n              factureId: { in: Array.from(facturesWithNewPayments) },\n              notes: 'Acompte Import (Délivrance)'\n            }\n          });\n        }";

content = content.replace(searchTarget3, replTarget3);
if (!content.includes("deleteMany")) {
    const s33 = "        console.log(\n          `[ImportLog] Phase 3: Bulk inserting ${paymentsToCreate.length} payments...`,\n        );";
    content = content.replace(s33, replTarget3);
}

fs.writeFileSync('backend/src/features/imports/imports.service.ts', content);
console.log('Successfully written to imports.service.ts');
