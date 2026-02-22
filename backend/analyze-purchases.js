const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    console.log('--- Analyzing 2023 Supplier Invoices ---');

    const start2023 = new Date('2023-01-01T00:00:00Z');
    const end2023 = new Date('2023-12-31T23:59:59Z');

    const purchaseStats = await prisma.factureFournisseur.groupBy({
        by: ['type', 'isBL'],
        _count: { _all: true },
        _sum: { montantTTC: true },
        where: { dateEmission: { gte: start2023, lte: end2023 } }
    });

    console.log('Supplier Invoices Distribution:');
    purchaseStats.forEach(s => {
        console.log(`- Type: ${s.type} | IsBL: ${s.isBL} | Count: ${s._count._all} | Total: ${s._sum.montantTTC}`);
    });

    const samples = await prisma.factureFournisseur.findMany({
        where: { dateEmission: { gte: start2023, lte: end2023 } },
        take: 5,
        orderBy: { dateEmission: 'desc' }
    });
    console.log('Sample Supplier Invoices:');
    samples.forEach(s => console.log(`- ${s.numeroFacture}: ${s.type} | ${s.montantTTC} | ${s.dateEmission.toISOString()}`));

    process.exit(0);
}
main();
