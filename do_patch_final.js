const fs = require('fs');
let file = 'backend/src/features/imports/imports.service.ts';
let content = fs.readFileSync(file, 'utf8');

console.log("Original file size: " + content.length);

const s1 = 'const paymentsToCreate: any[] = [];\r\n        const factureUpdates = new Map();';
const r1 = 'const paymentsToCreate: any[] = [];\r\n        const factureUpdates = new Map();\r\n        const facturesWithNewPayments = new Set<string>();';

if (content.includes(s1)) {
    content = content.replace(s1, r1);
    console.log("Replaced 1 successfully (CRLF)");
} else {
    const s1_lf = 'const paymentsToCreate: any[] = [];\n        const factureUpdates = new Map();';
    if (content.includes(s1_lf)) {
        content = content.replace(s1_lf, r1);
        console.log("Replaced 1 successfully (LF)");
    } else {
        console.log("Failed to find replace target 1");
    }
}

const s2 = 'paymentsToCreate.push({\r\n            factureId: facture.id,\r\n            montant,\r\n            date: datePaiement,';
const r2 = 'facturesWithNewPayments.add(facture.id);\n          paymentsToCreate.push({\n            factureId: facture.id,\n            montant,\n            date: datePaiement,';
if (content.includes(s2)) {
    content = content.replace(s2, r2);
    console.log("Replaced 2 successfully (CRLF)");
} else {
    const s2_lf = 'paymentsToCreate.push({\n            factureId: facture.id,\n            montant,\n            date: datePaiement,';
    if (content.includes(s2_lf)) {
        content = content.replace(s2_lf, r2);
        console.log("Replaced 2 successfully (LF)");
    } else {
        console.log("Failed to find replace target 2");
    }
}

const s3 = 'console.log(\r\n          `[ImportLog] Phase 3: Bulk inserting ${paymentsToCreate.length} payments...`,\r\n        );';
const r3 = 'console.log(\n          `[ImportLog] Phase 3: Bulk inserting ${paymentsToCreate.length} payments...`,\n        );\n        if (facturesWithNewPayments.size > 0) {\n          console.log(`[ImportLog] Removing previous Acompte Import for ${facturesWithNewPayments.size} factures...`);\n          await this.prisma.paiement.deleteMany({\n            where: {\n              factureId: { in: Array.from(facturesWithNewPayments) },\n              notes: \'Acompte Import (Délivrance)\'\n            }\n          });\n        }';
if (content.includes(s3)) {
    content = content.replace(s3, r3);
    console.log("Replaced 3 successfully (CRLF)");
} else {
    const s3_lf = 'console.log(\n          `[ImportLog] Phase 3: Bulk inserting ${paymentsToCreate.length} payments...`,\n        );';
    if (content.includes(s3_lf)) {
        content = content.replace(s3_lf, r3);
        console.log("Replaced 3 successfully (LF)");
    } else {
        console.log("Failed to find replace target 3");
    }
}

fs.writeFileSync(file, content);
console.log("New file size: " + content.length);
