import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- LOYER Expenses ---');
    const depenses = await prisma.depense.findMany({
        where: {
            categorie: {
                contains: 'LOYER',
                mode: 'insensitive'
            }
        },
        orderBy: {
            date: 'asc'
        }
    });

    depenses.forEach(d => {
        console.log(`ID: ${d.id}, Date: ${d.date.toISOString()}, Local: ${d.date.toLocaleString()}, Montant: ${d.montant}, Categorie: ${d.categorie}`);
    });

    console.log('\n--- Summary for Jan 2026 ---');
    const janStart = new Date('2026-01-01T00:00:00.000Z');
    const janEnd = new Date('2026-01-31T23:59:59.999Z');
    const janStats = await prisma.depense.aggregate({
        where: {
            date: { gte: janStart, lte: janEnd },
            categorie: { contains: 'LOYER', mode: 'insensitive' }
        },
        _sum: { montant: true }
    });
    console.log(`Jan Total: ${janStats._sum.montant}`);

    console.log('\n--- Summary for Feb 2026 ---');
    const febStart = new Date('2026-02-01T00:00:00.000Z');
    const febEnd = new Date('2026-02-28T23:59:59.999Z');
    const febStats = await prisma.depense.aggregate({
        where: {
            date: { gte: febStart, lte: febEnd },
            categorie: { contains: 'LOYER', mode: 'insensitive' }
        },
        _sum: { montant: true }
    });
    console.log(`Feb Total: ${febStats._sum.montant}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
