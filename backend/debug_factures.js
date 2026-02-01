const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
    const factures = await prisma.facture.findMany({
        where: {
            dateEmission: { gte: new Date('2026-01-01T00:00:00Z') }
        },
        select: {
            dateEmission: true,
            totalHT: true,
            type: true,
            statut: true
        },
        orderBy: {
            dateEmission: 'asc'
        }
    });

    const output = [
        '--- Factures from Jan 1st onwards (UTC) ---',
        ...factures.map(f => `${f.dateEmission.toISOString()} | ${f.totalHT} | ${f.type} | ${f.statut}`)
    ].join('\n');

    fs.writeFileSync('/app/debug_factures_out.txt', output);
    console.log('Results written to /app/debug_factures_out.txt');
}

main()
    .catch(e => {
        console.error(e);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
