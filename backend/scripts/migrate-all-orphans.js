const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Historical Orphan Payments Migration ---');

    // 1. Fetch all orphan payments that should have been integrated
    const orphans = await prisma.paiement.findMany({
        where: { 
            operationCaisseId: null,
            mode: { in: ['ESPECES', 'ESPECE', 'CARTE', 'CHEQUE', 'CHÈQUE', 'VIREMENT', 'LCN'] }
        },
        include: { facture: { include: { client: true } } },
        orderBy: { createdAt: 'asc' }
    });
    
    console.log(`Found ${orphans.length} totally orphaned payments needed to be migrated.`);
    if(orphans.length === 0) return console.log('Done.');

    // 2. Load all JourneeCaisse sessions ever (to map payments to them)
    // We only care about PRINCIPALE or MIXTE for standard payments, DEPENSES for refunds.
    const allSessions = await prisma.journeeCaisse.findMany({
        include: { caisse: true },
        orderBy: { dateOuverture: 'asc' }
    });

    let successCount = 0;
    let fallbackCount = 0;

    for (const p of orphans) {
        const pDate = new Date(p.createdAt);
        const centreId = p.facture?.centreId || p.facture?.client?.centreId;
        
        if (!centreId) {
            console.log(`Skipping payment ${p.id} - No Centre ID`);
            continue;
        }

        const isRefund = p.montant < 0;
        const targetTypes = isRefund ? ['DEPENSES', 'MIXTE'] : ['PRINCIPALE', 'MIXTE'];

        // Find the most appropriate session for this date and centre
        // Ideally, a session that was OPEN exactly when the payment occurred.
        const validSessions = allSessions.filter(s => 
            s.centreId === centreId &&
            targetTypes.includes(s.caisse.type) &&
            s.dateOuverture <= pDate && 
            (!s.dateCloture || s.dateCloture >= pDate)
        );
        let targetSession = validSessions.find(s => s.caisse.type === 'MIXTE') || validSessions[0];

        // If no exact match, find the numerically closest session in time for that centre/type
        if (!targetSession) {
            fallbackCount++;
            const candidateSessions = allSessions.filter(s => s.centreId === centreId && targetTypes.includes(s.caisse.type));
            if (candidateSessions.length === 0) {
                // Ignore if this centre has literally no sessions
                continue;
            }
            
            // Sort by absolute time difference from payment
            candidateSessions.sort((a, b) => {
                const diffA = Math.abs(a.dateOuverture.getTime() - pDate.getTime());
                const diffB = Math.abs(b.dateOuverture.getTime() - pDate.getTime());
                return diffA - diffB;
            });
            targetSession = candidateSessions[0];
        }

        try {
            await prisma.$transaction(async (tx) => {
                const absMontant = Math.abs(p.montant);

                // 1. Create OperationCaisse
                const op = await tx.operationCaisse.create({
                    data: {
                        type: isRefund ? 'DECAISSEMENT' : 'ENCAISSEMENT',
                        typeOperation: 'COMPTABLE',
                        montant: absMontant,
                        moyenPaiement: p.mode,
                        reference: p.reference || `FAC ${p.facture?.numero || 'Inconnue'}`,
                        motif: isRefund ? 'Régularisation Avoir (Auto-Recover)' : `Paiement: FAC ${p.facture?.numero || 'Inconnue'} (Auto-Recover)`,
                        utilisateur: 'Système',
                        journeeCaisseId: targetSession.id,
                        factureId: p.factureId,
                        createdAt: pDate, // IMPORTANT: preserving historical date
                        updatedAt: pDate
                    }
                });

                // 2. Link Payment
                await tx.paiement.update({
                    where: { id: p.id },
                    data: { operationCaisseId: op.id }
                });

                // 3. Update JourneeCaisse Totals
                if (isRefund) {
                     await tx.journeeCaisse.update({
                        where: { id: targetSession.id },
                        data: {
                            totalComptable: { decrement: absMontant },
                            totalVentesEspeces: (p.mode === 'ESPECES' || p.mode === 'ESPECE') ? { decrement: absMontant } : undefined,
                            totalVentesCarte: (p.mode === 'CARTE') ? { decrement: absMontant } : undefined,
                            totalVentesCheque: (p.mode === 'CHEQUE' || p.mode === 'CHÈQUE') ? { decrement: absMontant } : undefined,
                        }
                    });
                } else {
                    await tx.journeeCaisse.update({
                        where: { id: targetSession.id },
                        data: {
                            totalComptable: { increment: absMontant },
                            totalVentesEspeces: (p.mode === 'ESPECES' || p.mode === 'ESPECE') ? { increment: absMontant } : undefined,
                            totalVentesCarte: (p.mode === 'CARTE') ? { increment: absMontant } : undefined,
                            totalVentesCheque: (p.mode === 'CHEQUE' || p.mode === 'CHÈQUE') ? { increment: absMontant } : undefined,
                        }
                    });
                }
            });
            successCount++;
            
            // Log progress for every 100
            if (successCount % 100 === 0) console.log(`Migrated ${successCount} payments...`);
        } catch (e) {
            console.error(`Failed to migrate payment ${p.id}`, e.message);
        }
    }

    console.log(`\nMigration Complete:`);
    console.log(`Successfully migrated: ${successCount}`);
    console.log(`Required closest-time fallback: ${fallbackCount}`);
}

main().finally(() => prisma.$disconnect());
