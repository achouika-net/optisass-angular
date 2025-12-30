import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Diagnosis Start ---');

    // 1. Find the specific payment/operation for 1350
    const amount = 1350;
    console.log(`Searching for operations/payments with amount ${amount}...`);

    const payments = await prisma.paiement.findMany({
        where: {
            OR: [
                { montant: amount },
                { montant: -amount }
            ]
        },
        include: {
            facture: true,
            operationCaisse: true
        }
    });

    console.log(`Found ${payments.length} payments:`);
    payments.forEach(p => {
        console.log(`- ID: ${p.id}, Amount: ${p.montant}, Date: ${p.createdAt}, Mode: ${p.mode}, Status: ${p.statut}`);
        if (p.operationCaisse) {
            console.log(`  Linked Operation: ${p.operationCaisse.id} in Caisse Session: ${p.operationCaisse.journeeCaisseId}`);
        } else {
            console.log(`  NO LINKED OPERATION`);
        }
    });

    // 2. Check Caisse Totals Recalculation
    // Fetch all open sessions
    const openSessions = await prisma.journeeCaisse.findMany({
        where: { statut: 'OUVERTE' },
        include: {
            operations: true,
            caisse: true
        }
    });

    console.log(`\n--- Checking Open Sessions (${openSessions.length}) ---`);

    for (const session of openSessions) {
        console.log(`\nSession ID: ${session.id} (Caisse: ${session.caisse.nom} - ${session.caisse.type})`);
        console.log(`Current DB Totals:`);
        console.log(`- Solde Especes (Calc): ${session.fondInitial + session.totalVentesEspeces + session.totalInterne - session.totalDepenses}`);
        console.log(`- Total Ventes Especes: ${session.totalVentesEspeces}`);
        console.log(`- Total Carte: ${session.totalVentesCarte}`);
        console.log(`- Total Depenses: ${session.totalDepenses}`);

        // Recalculate from operations
        let calcEspeces = 0;
        let calcCarte = 0;
        let calcCheque = 0;
        let calcDepenses = 0;
        let calcInterne = 0;

        for (const op of session.operations) {
            if (op.type === 'ENCAISSEMENT') {
                if (op.moyenPaiement === 'ESPECES') calcEspeces += op.montant;
                if (op.moyenPaiement === 'CARTE') calcCarte += op.montant;
                if (op.moyenPaiement === 'CHEQUE') calcCheque += op.montant;
            } else if (op.type === 'DECAISSEMENT') {
                // Standard expense logic
                if (op.moyenPaiement === 'ESPECES') calcDepenses += op.montant;
            }
        }

        console.log(`Recalculated Totals:`);
        console.log(`- Ventes Especes: ${calcEspeces}`);
        console.log(`- Ventes Carte: ${calcCarte}`);
        console.log(`- Depenses: ${calcDepenses}`);

        if (Math.abs(calcEspeces - session.totalVentesEspeces) > 0.01 || Math.abs(calcDepenses - session.totalDepenses) > 0.01) {
            console.warn('⚠️ MISMATCH DETECTED!');
        } else {
            console.log('✅ Totals match operations.');
        }
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
