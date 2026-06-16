const fs = require('fs');
let content = fs.readFileSync('imports.service.ts.bak', 'utf8');

// Replace 1: Init Set
const search1 = "const paymentsToCreate: any[] = [];\r\n        const factureUpdates = new Map();";
const repl1 = "const paymentsToCreate: any[] = [];\n        const factureUpdates = new Map();\n        const facturesWithNewPayments = new Set<string>();";
content = content.replace(search1, repl1);
if(!content.includes("facturesWithNewPayments = new Set")) {
    const search1_alt = "const paymentsToCreate: any[] = [];\n        const factureUpdates = new Map();";
    content = content.replace(search1_alt, repl1);
}

// Replace 2: Add facture.id to Set
const search2 = "          paymentsToCreate.push({\r\n            factureId: facture.id,\r\n            montant,\r\n            date: datePaiement,";
const repl2 = "          facturesWithNewPayments.add(facture.id);\n          paymentsToCreate.push({\n            factureId: facture.id,\n            montant,\n            date: datePaiement,";
content = content.replace(search2, repl2);
if(!content.includes("facturesWithNewPayments.add")) {
    const search2_alt = "          paymentsToCreate.push({\n            factureId: facture.id,\n            montant,\n            date: datePaiement,";
    content = content.replace(search2_alt, repl2);
}

// Replace 3: Bulk Insert deletion logic
const search3 = "        console.log(\r\n          `[ImportLog] Phase 3: Bulk inserting ${paymentsToCreate.length} payments...`,\r\n        );";
const repl3 = "        console.log(\n          `[ImportLog] Phase 3: Bulk inserting ${paymentsToCreate.length} payments...`,\n        );\n        if (facturesWithNewPayments.size > 0) {\n          console.log(`[ImportLog] Removing previous Acompte Import for ${facturesWithNewPayments.size} factures...`);\n          await this.prisma.paiement.deleteMany({\n            where: {\n              factureId: { in: Array.from(facturesWithNewPayments) },\n              notes: 'Acompte Import (Délivrance)'\n            }\n          });\n        }";
content = content.replace(search3, repl3);
if(!content.includes("deleteMany")) {
    const search3_alt = "        console.log(\n          `[ImportLog] Phase 3: Bulk inserting ${paymentsToCreate.length} payments...`,\n        );";
    content = content.replace(search3_alt, repl3);
}

fs.writeFileSync('imports.service.ts.bak', content);
console.log("Done modifying.");
