const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');

const p = new PrismaClient({
    datasources: {
        db: {
            url: 'postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public'
        }
    }
});

const CENTRE_ID = '6df7de62-498e-4784-b22f-7bbccc7fea36';

async function main() {
    try {
        console.log('Loading Excel files...');
        const wbDC = xlsx.readFile('C:\\Users\\ASUS\\Documents\\optimag\\DOSSIERCLIENT.xlsx');
        let fichesData = xlsx.utils.sheet_to_json(wbDC.Sheets[wbDC.SheetNames[0]]);
        console.log(`Loaded ${fichesData.length} fiches from DOSSIERCLIENT.xlsx`);

        const wbF = xlsx.readFile('C:\\Users\\ASUS\\Documents\\optimag\\Facture.xlsx');
        let facturesData = xlsx.utils.sheet_to_json(wbF.Sheets[wbF.SheetNames[0]]);
        console.log(`Loaded ${facturesData.length} factures from Facture.xlsx`);

        console.log('Wiping current Fiches and Factures for centre...');
        await p.facture.deleteMany({ where: { centreId: CENTRE_ID } });
        await p.fiche.deleteMany({ where: { client: { centreId: CENTRE_ID } } });

        console.log('Fetching clients...');
        const clients = await p.client.findMany({ where: { centreId: CENTRE_ID } });
        const clientMap = new Map();
        clients.forEach(c => clientMap.set(c.codeClient, c.id));

        const facturesByClient = new Map();
        facturesData.forEach(f => {
            const cKey = f.nClient?.toString();
            if (!facturesByClient.has(cKey)) facturesByClient.set(cKey, []);
            // Correcting field name for total if necessary
            const amount = f.total_ttc || f.Total || 0;
            facturesByClient.get(cKey).push({ ...f, normalizedAmount: amount });
        });

        console.log('Starting Greedy Restoration with Correct Column ("Total TTC")...');
        let facCount = 0;
        let bcCount = 0;
        let totalSum = 0;
        const batchSize = 100;

        for (let i = 0; i < fichesData.length; i += batchSize) {
            const batch = fichesData.slice(i, i + batchSize);
            for (const row of batch) {
                const clientIdString = row.Client?.toString();
                const clientId = clientMap.get(clientIdString);
                if (!clientId) continue;

                const date = row.Date ? new Date((row.Date - 25569) * 86400 * 1000) : new Date();
                // Use 'Total TTC' as primary, fallback to 'Montant'
                const amount = row['Total TTC'] !== undefined ? row['Total TTC'] : (row.Montant || 0);
                totalSum += amount;

                const fiche = await p.fiche.create({
                    data: {
                        clientId: clientId,
                        montantTotal: amount,
                        dateCreation: date,
                        statut: 'VALIDE',
                        type: row.type || 'L',
                        content: row,
                    }
                });

                let type = 'BON_COMMANDE';
                let numero = row.Dossier || `BC-${fiche.id.split('-')[0]}`;

                const clientFacs = facturesByClient.get(clientIdString);
                if (clientFacs && clientFacs.length > 0) {
                    let bestIdx = 0;
                    let minDiff = Math.abs((clientFacs[0].normalizedAmount) - amount);
                    for (let k = 1; k < clientFacs.length; k++) {
                        let diff = Math.abs((clientFacs[k].normalizedAmount) - amount);
                        if (diff < minDiff) {
                            minDiff = diff;
                            bestIdx = k;
                        }
                    }

                    const match = clientFacs.splice(bestIdx, 1)[0];
                    type = 'FACTURE';
                    numero = match.nFacture || numero;
                    facCount++;
                } else {
                    bcCount++;
                }

                await p.facture.create({
                    data: {
                        ficheId: fiche.id,
                        clientId: clientId,
                        centreId: CENTRE_ID,
                        totalTTC: amount,
                        type: type,
                        numero: numero.toString(),
                        dateEmission: date,
                        statut: 'VALIDE',
                        resteAPayer: 0,
                        lignes: [],
                        proprietes: { source: 'Excel Restore Corrected' }
                    }
                });
            }
            process.stdout.write(`\rProgress: ${Math.min(i + batchSize, fichesData.length)} / ${fichesData.length} (FAC: ${facCount}, BC: ${bcCount})`);
        }

        console.log('\n--- RESTORATION COMPLETE ---');
        console.log(`Total Fiches in DB: ${await p.fiche.count({ where: { client: { centreId: CENTRE_ID } } })}`);
        console.log(`Total Factures: ${facCount}, Total BC: ${bcCount}`);
        console.log(`Calculated Total Sum: ${totalSum}`);

    } catch (e) {
        console.error('\nERROR:', e);
    } finally {
        await p.$disconnect();
        process.exit(0);
    }
}

main();
