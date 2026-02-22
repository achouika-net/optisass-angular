import { PrismaClient } from '@prisma/client';

async function auditIntegrity() {
    const prisma = new PrismaClient();

    console.log('--- Centres in DB ---');
    const dbCentres = await prisma.centre.findMany();
    console.log(dbCentres);

    console.log('\n--- Orphaned centreIds in Facture ---');
    const factures = await prisma.facture.findMany({
        select: { centreId: true }
    });

    const centreIdsInFacture = new Set(factures.map(f => f.centreId));
    const knownCentreIds = new Set(dbCentres.map(c => c.id));

    console.log('Unique centreIds in Facture:', Array.from(centreIdsInFacture));
    console.log('Known IDs from Centre table:', Array.from(knownCentreIds));

    for (const lid of centreIdsInFacture) {
        if (!lid) {
            console.log(`- NULL centreId found in ${factures.filter(f => f.centreId === lid).length} factures`);
        } else if (!knownCentreIds.has(lid)) {
            const count = factures.filter(f => f.centreId === lid).length;
            console.log(`- ORPHANED centreId: ${lid} (found in ${count} factures)`);
        }
    }

    await prisma.$disconnect();
}

auditIntegrity();
