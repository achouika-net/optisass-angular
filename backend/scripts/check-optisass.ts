import { PrismaClient } from '@prisma/client';

const url = "postgresql://postgres:admin@localhost:5432/optisass?schema=public";
const prisma = new PrismaClient({
    datasources: {
        db: { url }
    }
});

async function main() {
    console.log('--- Checking database: optisass ---');
    try {
        const f = await prisma.facture.count();
        const d = await prisma.depense.count();
        const p = await prisma.paiement.count();
        console.log('COUNTS in optisass:', { f, d, p });

        if (f > 0) {
            const sum = await prisma.facture.aggregate({
                _sum: { totalTTC: true }
            });
            console.log('Total CA (TTC) in optisass:', sum._sum.totalTTC);
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
