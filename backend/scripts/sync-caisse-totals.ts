import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function syncTotals() {
    console.log('Starting synchronization of JourneeCaisse totals...');

    const journees = await prisma.journeeCaisse.findMany({
        include: {
            operations: true
        }
    });

    console.log(`Found ${journees.length} sessions to process.`);

    for (const journee of journees) {
        console.log(`Processing session ${journee.id} (Caisse: ${journee.caisseId})...`);

        let totalVentesEspeces = 0;
        let totalVentesCarte = 0;
        let totalInterne = 0;
        let totalDepenses = 0;
        let totalTransfertsDepenses = 0;

        for (const op of journee.operations) {
            const amount = op.montant || 0;

            if (op.type === 'ENCAISSEMENT') {
                if (op.typeOperation === 'COMPTABLE') {
                    if (op.moyenPaiement === 'ESPECES') totalVentesEspeces += amount;
                    if (op.moyenPaiement === 'CARTE') totalVentesCarte += amount;
                } else if (op.typeOperation === 'INTERNE') {
                    totalInterne += amount;
                }
            } else if (op.type === 'DECAISSEMENT') {
                totalDepenses += amount;
                if (op.motif === 'ALIMENTATION_CAISSE_DEPENSES') {
                    totalTransfertsDepenses += amount;
                }
            }
        }

        const totalComptable = totalVentesEspeces + totalVentesCarte;

        await (prisma.journeeCaisse as any).update({
            where: { id: journee.id },
            data: {
                totalComptable,
                totalVentesEspeces,
                totalVentesCarte,
                totalInterne,
                totalDepenses,
                totalTransfertsDepenses
            }
        });
    }

    console.log('Synchronization complete.');
}

syncTotals()
    .catch((e) => {
        console.error('Migration failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
