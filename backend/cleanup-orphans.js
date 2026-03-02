const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({
    datasources: {
        db: {
            url: 'postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public'
        }
    }
});

async function delOrphans() {
    try {
        const orphanCount = await p.facture.count({ where: { ficheId: null } });
        console.log(`Found ${orphanCount} orphan invoices.`);

        if (orphanCount > 0) {
            console.log('Deleting orphan invoices...');
            const res = await p.facture.deleteMany({
                where: { ficheId: null }
            });
            console.log(`Successfully deleted ${res.count} orphan invoices.`);
        }

        const finalCA = await p.facture.aggregate({
            _sum: { totalTTC: true }
        });
        console.log(`--- FINAL AUDIT ---`);
        console.log(`Final Global CA calculated: ${finalCA._sum.totalTTC}`);

        const finalFicheCount = await p.fiche.count();
        console.log(`Final Fiche count: ${finalFicheCount}`);

    } catch (e) {
        console.error('ERROR DURING ORPHAN DELETION:', e);
    } finally {
        await p.$disconnect();
        process.exit(0);
    }
}

delOrphans();
