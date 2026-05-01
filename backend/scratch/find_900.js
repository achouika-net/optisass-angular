const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public"
        }
    }
});

async function find900() {
    try {
        const depenses = await prisma.depense.findMany({
            where: { montant: 900 }
        });
        console.log('Depenses 900:', JSON.stringify(depenses, null, 2));

        const echeances = await prisma.echeancePaiement.findMany({
            where: { montant: 900 }
        });
        console.log('Echeances 900:', JSON.stringify(echeances, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

find900();
