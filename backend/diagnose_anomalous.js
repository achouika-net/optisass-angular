const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const factures = await prisma.facture.findMany({
        where: {
            numero: { in: ['14374', '85/2024', '14376', '14375', '14377', '83/2024'] }
        },
        include: {
            paiements: true
        }
    });

    for (const f of factures) {
        const totalPaye = f.paiements.reduce((sum, p) => sum + p.montant, 0);
        console.log(`- Facture ${f.numero} | Type: ${f.type} | Statut: ${f.statut} | Total TTC: ${f.totalTTC} | Total Paye: ${totalPaye}`);
    }
}

run().finally(() => prisma.$disconnect());
