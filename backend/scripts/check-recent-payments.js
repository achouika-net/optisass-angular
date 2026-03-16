const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Searching for recent real payments ---');
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const recentPayments = await prisma.paiement.findMany({
        where: { createdAt: { gte: oneHourAgo } },
        include: { operationCaisse: { include: { journeeCaisse: { include: { caisse: true } } } } },
        orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${recentPayments.length} payments in the last hour.`);
    for (const p of recentPayments) {
        console.log(`Payment: ID=${p.id}, Mode=${p.mode}, Montant=${p.montant}`);
        if (p.operationCaisse) {
            console.log(`  -> Operation: ${p.operationCaisse.id}, Caisse: ${p.operationCaisse.journeeCaisse.caisse.nom} (${p.operationCaisse.journeeCaisse.caisse.type})`);
        } else {
            console.log(`  -> NO OPERATION CAISSE LINKED!`);
        }
    }
}

main().finally(() => prisma.$disconnect());
