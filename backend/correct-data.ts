import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Correction Start ---');

    const paymentId = 'e2935561-f740-4645-b7b7-91e3f7df23ae';

    // 1. Fix Payment Status
    console.log(`Fixing Payment ${paymentId}...`);
    const payment = await prisma.paiement.findUnique({
        where: { id: paymentId },
        include: { operationCaisse: true, facture: true }
    });

    if (!payment) {
        console.error('Payment not found!');
        return;
    }

    if (payment.statut !== 'DECAISSEMENT') {
        await prisma.paiement.update({
            where: { id: paymentId },
            data: { statut: 'DECAISSEMENT' }
        });
        console.log('✅ Payment status updated to DECAISSEMENT');
    }

    // 2. Ensure Operation Exists in Caisse Depense
    if (payment.operationCaisse) {
        // ... (existing move logic if needed, but likely not if it was missing)
        console.log(`Operation exists: ${payment.operationCaisse.id}`);
    } else {
        console.log('⚠️ No operation found! Creating one in DEPENSES...');

        // Find open DEPENSES session
        const depenseSession = await prisma.journeeCaisse.findFirst({
            where: {
                centreId: payment.facture?.centreId || '456f5be0-9f01-4ea1-8d55-f17a82e85ef8', // Fallback to provided centre ID from log
                statut: 'OUVERTE',
                caisse: { type: 'DEPENSES' }
            }
        });

        if (depenseSession) {
            // Create Operation
            const newOp = await prisma.operationCaisse.create({
                data: {
                    type: 'DECAISSEMENT',
                    typeOperation: 'COMPTABLE',
                    montant: Math.abs(payment.montant), // 1350
                    moyenPaiement: payment.mode, // ESPECES
                    reference: payment.reference || payment.facture?.numero,
                    motif: 'Régularisation Avoir',
                    utilisateur: 'Système (Correction)',
                    journeeCaisseId: depenseSession.id,
                    factureId: payment.factureId
                }
            });
            console.log(`✅ Created Operation ${newOp.id} in Session ${depenseSession.id}`);

            // Link to Payment
            await prisma.paiement.update({
                where: { id: paymentId },
                data: { operationCaisseId: newOp.id }
            });

            // Increment Session Totals
            await prisma.journeeCaisse.update({
                where: { id: depenseSession.id },
                data: {
                    totalDepenses: { increment: Math.abs(payment.montant) }
                }
            });
            console.log('✅ Updated Session Totals');
        } else {
            console.error('❌ No open DEPENSES session found!');
        }
    }

    // 3. Final Recalculation Check
    // Fetch all open sessions
    const openSessions = await prisma.journeeCaisse.findMany({
        where: { statut: 'OUVERTE' },
        include: {
            operations: true,
            caisse: true
        }
    });

    console.log(`\n--- Recalculating All Open Sessions (${openSessions.length}) ---`);

    for (const session of openSessions) {
        // Recalculate from operations
        let calcEspeces = 0;
        let calcCarte = 0;
        let calcCheque = 0;
        let calcDepenses = 0;
        let calcComptable = 0;

        for (const op of session.operations) {
            if (op.type === 'ENCAISSEMENT') {
                calcComptable += op.montant;
                if (op.moyenPaiement === 'ESPECES') calcEspeces += op.montant;
                if (op.moyenPaiement === 'CARTE') calcCarte += op.montant;
                if (op.moyenPaiement === 'CHEQUE') calcCheque += op.montant;
            } else if (op.type === 'DECAISSEMENT') {
                // If it's the main register, decaissements might reduce comptable? 
                // Usually sales returns are negative ENCAISSEMENT or DECAISSEMENT?
                // Based on previous code: type: createPaiementDto.montant >= 0 ? 'ENCAISSEMENT' : 'DECAISSEMENT'
                // And montant stored as Absolute value in DB? 
                // Code said: montant: Math.abs(createPaiementDto.montant)

                // So DECAISSEMENT operations have POSITIVE amount in DB but represent outflow.

                if (session.caisse.type === 'DEPENSES') {
                    calcDepenses += op.montant;
                } else {
                    // Main register refund logic
                    // If it was a refund, it reduced totalVentesEspeces in the code?
                    // "totalVentesEspeces: { increment: createPaiementDto.montant }" where amount is negative.
                    // So for Main Register, we should sum signed values?
                    // But OperationCaisse stores ABSOLUTE values.

                    // Wait, check storage format.
                    // "montant: Math.abs(createPaiementDto.montant)" -> stored positive.

                    // If register is PRINCIPALE, DECAISSEMENT reduces validity?
                    // Let's assume standard logic: 
                    // Solde = Init + Encaiss - Decaiss

                    if (op.moyenPaiement === 'ESPECES') calcDepenses += op.montant; // Treated as outflow
                }
            }
        }

        // NOTE: The previous logic uses totalVentesEspeces as (Sales - Returns). 
        // If we move the return to Expense Register, then Main Register Sales should be HIGHER (restored).
        // My fix above did { decrement: payment.montant } where payment is negative -> Adds to total. Correct.

        // We will just print the recalc values for verification, not auto-update blindly again.
        console.log(`Session ${session.id} (${session.caisse.nom}): Recalculated Depenses=${calcDepenses}, Especes=${calcEspeces}`);
    }

}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
