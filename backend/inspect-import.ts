import { PrismaClient } from '@prisma/client';

async function inspectImportedData() {
    const prisma = new PrismaClient();
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';

    console.log('--- Full Distribution of Sales Types ---');
    const byType = await prisma.facture.groupBy({
        where: { centreId },
        by: ['type', 'statut'],
        _count: true
    });
    console.log(JSON.stringify(byType, null, 2));

    // Check proprietes field for any "typeVente" or "facture" marker
    console.log('\n--- Sample DEVIS records (proprietes field) ---');
    const devisSamples = await prisma.facture.findMany({
        where: { centreId, type: 'DEVIS' },
        take: 5,
        select: { numero: true, type: true, statut: true, proprietes: true }
    });
    console.log(JSON.stringify(devisSamples, null, 2));

    console.log('\n--- Sample BON_COMMANDE records (proprietes field) ---');
    const bcSamples = await prisma.facture.findMany({
        where: { centreId, type: 'BON_COMMANDE' },
        take: 5,
        select: { numero: true, type: true, statut: true, proprietes: true }
    });
    console.log(JSON.stringify(bcSamples, null, 2));

    // Check for any proprietes.typeVente markers
    console.log('\n--- Records with typeVente=FACTURE in proprietes ---');
    const withFactureType = await prisma.facture.findMany({
        where: {
            centreId,
            proprietes: {
                path: ['typeVente'],
                equals: 'FACTURE'
            }
        },
        take: 5,
        select: { numero: true, type: true, statut: true, proprietes: true }
    });
    console.log('Count with typeVente=FACTURE:', withFactureType.length);
    console.log(JSON.stringify(withFactureType, null, 2));

    await prisma.$disconnect();
}

inspectImportedData();
