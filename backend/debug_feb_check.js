const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
    const febStart = new Date('2026-02-01T00:00:00.000Z');

    console.log('--- All Expenses from Feb 1st onwards (UTC) ---');
    const depenses = await prisma.depense.findMany({
        where: {
            date: { gte: febStart }
        },
        orderBy: {
            date: 'asc'
        }
    });

    const output = [
        '--- Feb 1st onwards ---',
        ...depenses.map(d => `ID: ${d.id}, Date: ${d.date.toISOString()}, Montant: ${d.montant}, Categorie: ${d.categorie}`)
    ].join('\n');

    fs.writeFileSync('/app/debug_feb_out.txt', output);
    console.log('Results written to /app/debug_feb_out.txt');
}

main()
    .catch(e => {
        console.error(e);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
