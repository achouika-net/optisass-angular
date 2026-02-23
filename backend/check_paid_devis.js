const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const factures = await prisma.facture.findMany({
        where: {
            paiements: { some: {} },
            type: { notIn: ['BON_COMM', 'BON_COMMANDE', 'FACTURE', 'BL', 'AVOIR'] }
        },
        select: { id: true, numero: true, type: true, statut: true, paiements: { select: { montant: true } } }
    });
    console.log('Factures with payments but odd type:', factures);
}
run().finally(() => prisma.$disconnect());
