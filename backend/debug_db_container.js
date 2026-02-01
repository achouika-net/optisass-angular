const { PrismaClient } = require('@prisma/client');
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
        console.log(`ID: ${d.id}, Date: ${d.date.toISOString()}, Montant: ${d.montant}, Categorie: ${d.categorie}`);
    });
}

main()
    .catch(e => {
        console.error(e);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
