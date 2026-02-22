import { PrismaClient } from '@prisma/client';

async function checkDistribution() {
    const prisma = new PrismaClient();

    console.log('--- Overall Distribution of Factures ---');
    const counts = await prisma.facture.groupBy({
        by: ['centreId', 'type', 'statut'],
        _count: true
    });
    console.log(JSON.stringify(counts, null, 2));

    console.log('\n--- Center Records for 6df7de62-498e-4784-b22f-7bbccc7fea36 ---');
    const specific = await prisma.facture.count({
        where: { centreId: '6df7de62-498e-4784-b22f-7bbccc7fea36' }
    });
    console.log('Simple count for specific center:', specific);

    if (specific > 0) {
        const sample = await prisma.facture.findFirst({
            where: { centreId: '6df7de62-498e-4784-b22f-7bbccc7fea36' }
        });
        console.log('Sample Record:', sample);
    }

    await prisma.$disconnect();
}

checkDistribution();
