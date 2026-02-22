const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const amount = 16450.04;
    const payments = await prisma.paiement.findMany({
        where: {
            montant: {
                gte: amount - 10,
                lte: amount + 10
            }
        }
    });

    console.log(`Payments around ${amount}:`, payments.length);
    payments.forEach(p => console.log(p));

    await prisma.$disconnect();
}

run();
