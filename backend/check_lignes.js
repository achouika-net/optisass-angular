const { PrismaClient } = require('@prisma/client');

async function checkLignes() {
    const prisma = new PrismaClient();
    const factures = await prisma.facture.findMany({
        take: 5,
        where: { NOT: { lignes: null } }
    });

    factures.forEach(f => {
        console.log(`Invoice ${f.numeroFacture}:`);
        console.log(JSON.stringify(f.lignes, null, 2));
    });

    await prisma.$disconnect();
}

checkLignes();
