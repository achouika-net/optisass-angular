const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public"
        }
    }
});

async function check6000() {
    try {
        const startMay = new Date('2026-05-01T00:00:00Z');
        const endMay = new Date('2026-05-31T23:59:59Z');

        const echeances = await prisma.echeancePaiement.findMany({
            where: {
                dateEcheance: { gte: startMay, lte: endMay },
                montant: 6000
            }
        });
        console.log('Echeances 6000 in May:', JSON.stringify(echeances, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

check6000();
