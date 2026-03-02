const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({
    datasources: {
        db: {
            url: 'postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public'
        }
    }
});

async function cleanDeep() {
    try {
        console.log('Fetching all fiches for centre 6df7de62-498e-4784-b22f-7bbccc7fea36...');
        const fiches = await p.fiche.findMany({
            where: { client: { centreId: '6df7de62-498e-4784-b22f-7bbccc7fea36' } },
            select: { id: true, clientId: true, montantTotal: true, dateCreation: true }
        });

        const tracker = new Map();
        const ficheIdsToDelete = [];

        // Sort by date ascending to keep the oldest one
        fiches.sort((a, b) => a.dateCreation.getTime() - b.dateCreation.getTime());

        fiches.forEach(f => {
            const key = `${f.clientId}_${f.montantTotal.toFixed(2)}`;
            if (!tracker.has(key)) {
                tracker.set(key, f.id);
            } else {
                ficheIdsToDelete.push(f.id);
            }
        });

        console.log(`Aggressive Cleanup: Found ${ficheIdsToDelete.length} duplicates (Client+Amount) out of ${fiches.length}.`);

        if (ficheIdsToDelete.length > 0) {
            console.log('Deleting redundant fiches and their Factures...');
            const resF = await p.fiche.deleteMany({
                where: { id: { in: ficheIdsToDelete } }
            });
            console.log(`Successfully deleted ${resF.count} redundant records.`);
        }

        const finalFicheCount = await p.fiche.count();
        const totalAgg = await p.facture.aggregate({
            _sum: { totalTTC: true }
        });

        console.log(`--- FINAL AUDIT ---`);
        console.log(`Total Fiches remaining in DB: ${finalFicheCount}`);
        console.log(`Final Global CA calculated: ${totalAgg._sum.totalTTC}`);

    } catch (e) {
        console.error('ERROR DURING AGGRESSIVE CLEANUP:', e);
    } finally {
        await p.$disconnect();
        process.exit(0);
    }
}

cleanDeep();
