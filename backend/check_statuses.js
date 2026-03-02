const { PrismaClient } = require('@prisma/client');

async function checkStatuses() {
    const prisma = new PrismaClient();
    const statuses = await prisma.echeancePaiement.groupBy({
        by: ['statut'],
        _count: { _all: true }
    });
    console.log('--- EcheancePaiement Statuses ---');
    console.log(JSON.stringify(statuses, null, 2));

    const paymentStatuses = await prisma.paiement.groupBy({
        by: ['statut'],
        _count: { _all: true }
    });
    console.log('--- Paiement Statuses ---');
    console.log(JSON.stringify(paymentStatuses, null, 2));

    await prisma.$disconnect();
}

checkStatuses();
