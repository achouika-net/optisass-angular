const fs = require('fs');
let file = 'backend/src/features/imports/imports.service.ts';
let lines = fs.readFileSync(file, 'utf8').split('\n');

let inPaiementsClients = false;
let modified = false;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('async importPaiementsClients(')) {
        inPaiementsClients = true;
    }
    if (inPaiementsClients) {
        if (lines[i].includes('const paymentsToCreate: any[] = [];') && lines[i+1].includes('const factureUpdates = new Map();')) {
            if (!lines[i+2].includes('const facturesWithNewPayments = new Set')) {
                lines.splice(i+2, 0, '        const facturesWithNewPayments = new Set<string>();');
                modified = true;
                i++; // adjust for the inserted line
            }
        }
        
        if (lines[i].includes('paymentsToCreate.push({')) {
            if (lines[i+1].includes('factureId: facture.id')) {
                if (!lines[i-1].includes('facturesWithNewPayments.add(facture.id);')) {
                    lines.splice(i, 0, '        facturesWithNewPayments.add(facture.id);');
                    modified = true;
                    i++;
                }
            }
        }

        if (lines[i].includes('`[ImportLog] Phase 3: Bulk inserting ${paymentsToCreate.length} payments...`,')) {
            // Usually this is over 2 lines, followed by:
            // );
            if (lines[i+1].includes(');')) {
                if (!lines[i+2].includes('if (facturesWithNewPayments.size > 0)')) {
                    lines.splice(i+2, 0, 
                        '        if (facturesWithNewPayments.size > 0) {\n' +
                        '          console.log(`[ImportLog] Removing previous Acompte Import for ${facturesWithNewPayments.size} factures...`);\n' +
                        '          await this.prisma.paiement.deleteMany({\n' +
                        '            where: {\n' +
                        '              factureId: { in: Array.from(facturesWithNewPayments) },\n' +
                        '              notes: \'Acompte Import (Délivrance)\'\n' +
                        '            }\n' +
                        '          });\n' +
                        '        }'
                    );
                    modified = true;
                    inPaiementsClients = false; // We are done with this method
                }
            }
        }
    }
}

if (modified) {
    fs.writeFileSync(file, lines.join('\n'));
    console.log("Successfully patched using line-by-line strategy.");
} else {
    console.log("No modifications were made.");
}
