const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({
    datasources: {
        db: {
            url: 'postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public'
        }
    }
});

async function clean() {
    try {
        console.log('Fetching all fiches...');
        const fiches = await p.fiche.findMany({
            select: { id: true, clientId: true, montantTotal: true, dateCreation: true }
        });

        const tracker = new Map();
        const ficheIdsToDelete = [];

        fiches.forEach(f => {
            // Use toFixed(2) to normalize small float differences and ISO string for date
            const key = `${f.clientId}_${f.montantTotal.toFixed(2)}_${f.dateCreation.toISOString()}`;
            if (!tracker.has(key)) {
                tracker.set(key, f.id);
            } else {
                ficheIdsToDelete.push(f.id);
            }
        });

        console.log(`Found ${ficheIdsToDelete.length} duplicate fiches out of ${fiches.length}.`);

        if (ficheIdsToDelete.length > 0) {
            console.log('Deleting duplicate fiches and their cascading relations (Factures)...');
            // Prisma deleteMany is faster for large sets
            // Batching might be needed if ficheIdsToDelete is huge, but 500-5000 is okay for one call.
            const resF = await p.fiche.deleteMany({
                where: { id: { in: ficheIdsToDelete } }
            });
            console.log(`Successfully deleted ${resF.count} fiches.`);
        }

        console.log('Searching for orphan invoice 2/2013...');
        const orphanFacs = await p.facture.findMany({
            where: { numero: '2/2013', ficheId: null }
        });

        if (orphanFacs.length > 0) {
            console.log(`Found ${orphanFacs.length} orphan invoices.`);
            const resI = await p.facture.deleteMany({
                where: { id: { in: orphanFacs.map(x => x.id) } }
            });
            console.log(`Successfully deleted ${resI.count} orphan invoices.`);
        }

        const finalFicheCount = await p.fiche.count();
        const finalFactureCount = await p.facture.count();
        console.log(`--- FINAL AUDIT ---`);
        console.log(`Fiches remaining: ${finalFicheCount}`);
        console.log(`Factures/BC remaining: ${finalFactureCount}`);

        // Verify CA
        const totalAgg = await p.facture.aggregate({
            _sum: { totalTTC: true }
        });
        console.log(`Calculated Global CA: ${totalAgg._sum.totalTTC}`);

    } catch (e) {
        console.error('ERROR DURING CLEANUP:', e);
    } finally {
        await p.$disconnect();
        process.exit(0);
    }
}

clean();
