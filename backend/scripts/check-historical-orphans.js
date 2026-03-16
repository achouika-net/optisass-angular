const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const startOfMonth = new Date(2026, 2, 1); // March 1st, 2026

    const orphans = await prisma.paiement.findMany({
        where: { 
            createdAt: { gte: startOfMonth },
            operationCaisseId: null,
            mode: { in: ['ESPECES', 'ESPECE', 'CARTE', 'CHEQUE', 'CHÈQUE', 'VIREMENT', 'LCN'] }
        },
        include: { facture: true }
    });
    
    console.log(`Found ${orphans.length} historical orphaned payments this month.`);
    if (orphans.length > 0) {
        console.log("Sample:", orphans[0].id, orphans[0].createdAt, orphans[0].montant);
    }
}
main().finally(() => prisma.$disconnect());
