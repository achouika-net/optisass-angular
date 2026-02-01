const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
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

    const output = [
        '--- LOYER Expenses ---',
        ...depenses.map(d => `ID: ${d.id}, Date: ${d.date.toISOString()}, Montant: ${d.montant}, Categorie: ${d.categorie}`)
    ].join('\n');

    fs.writeFileSync('/app/debug_loyer_out.txt', output);
    console.log('Results written to /app/debug_loyer_out.txt');
}

main()
    .catch(e => {
        console.error(e);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
