const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const factures = await prisma.facture.findMany({
        where: {
            client: {
                nom: 'CHAFIAI',
                prenom: 'NADIA'
            }
        },
        orderBy: {
            dateEmission: 'asc'
        },
        select: {
            id: true,
            numero: true,
            type: true,
            dateEmission: true,
            statut: true,
            totalTTC: true
        }
    });

    console.log('--- ALL FACTURES FOR CHAFIAI NADIA ---');
    factures.forEach(f => {
        console.log(`[${f.numero}] | Type: ${f.type} | Date: ${f.dateEmission.toISOString().split('T')[0]} | Total: ${f.totalTTC}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
