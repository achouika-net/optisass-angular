const { PrismaClient } = require('@prisma/client');

// Use localhost:5435 (mapped port from docker)
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public"
        }
    }
});

async function moveData() {
    try {
        const startMay = new Date('2026-05-01T00:00:00Z');
        const endMay = new Date('2026-05-31T23:59:59Z');
        const april30 = new Date('2026-04-30T12:00:00Z');

        console.log('Searching for records in May...');

        // 1. Find 11 small BL echeances (montant < 1000)
        const smallBLEcheances = await prisma.echeancePaiement.findMany({
            where: {
                dateEcheance: { gte: startMay, lte: endMay },
                bonLivraisonId: { not: null },
                montant: { lt: 1000 }
            }
        });

        console.log(`Found ${smallBLEcheances.length} small BL echeances.`);

        // 2. Find 900 DH expense
        const expense900 = await prisma.depense.findFirst({
            where: {
                date: { gte: startMay, lte: endMay },
                montant: 900
            }
        });

        if (expense900) {
            console.log('Found the 900 DH expense.');
        } else {
            console.log('900 DH expense not found in May.');
        }

        // PERFORM UPDATES
        console.log('Performing updates...');

        // Update BL Echeances
        for (const ep of smallBLEcheances) {
            await prisma.echeancePaiement.update({
                where: { id: ep.id },
                data: { dateEcheance: april30 }
            });
            console.log(`Moved BL echeance ${ep.id} (${ep.montant} DH) to April 30.`);
        }

        // Update 900 DH expense
        if (expense900) {
            await prisma.depense.update({
                where: { id: expense900.id },
                data: { 
                    date: april30,
                }
            });
            
            if (expense900.echeanceId) {
                 await prisma.echeancePaiement.update({
                    where: { id: expense900.echeanceId },
                    data: { dateEcheance: april30 }
                });
            }
            console.log('Moved the 900 DH expense to April 30.');
        }

        console.log('SUCCESS: All target records moved to April.');

    } catch (e) {
        console.error('Error during move:', e);
    } finally {
        await prisma.$disconnect();
    }
}

moveData();
