const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';
    const res = await prisma.facture.aggregate({
        _sum: { resteAPayer: true },
        where: { centreId, statut: { not: 'ANNULEE' } }
    });
    console.log('Final DB Net Reste (Stored Sum):', res._sum.resteAPayer, 'DH');
    await prisma.$disconnect();
}

run();
