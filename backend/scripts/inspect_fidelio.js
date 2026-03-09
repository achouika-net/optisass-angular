const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const redemptions = await prisma.rewardRedemption.findMany({
        orderBy: { redeemedAt: 'desc' },
        take: 5
    });
    console.log("Recent Redemptions:");
    console.dir(redemptions, { depth: null });

    if (redemptions.length > 0) {
        const clientId = redemptions[0].clientId;
        const unpaidInvoices = await prisma.facture.findMany({
            where: {
                clientId: clientId,
                statut: { notIn: ['PAYEE', 'ANNULEE'] },
                resteAPayer: { gt: 0 }
            },
            select: { id: true, numero: true, type: true, statut: true, resteAPayer: true, totalTTC: true }
        });
        console.log("Unpaid invoices for client:", unpaidInvoices);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
