const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const startDate = new Date(2025, 11, 1);
    const endDate = new Date(2025, 11, 31, 23, 59, 59);
    const centreId = '456f5be0-9f01-4ea1-8d55-f17a82e85ef8';

    const [expenses, invoices] = await Promise.all([
        prisma.depense.groupBy({
            by: ['categorie'],
            where: { date: { gte: startDate, lte: endDate }, centreId },
            _sum: { montant: true }
        }),
        prisma.factureFournisseur.groupBy({
            by: ['type'],
            where: { dateEmission: { gte: startDate, lte: endDate }, centreId },
            _sum: { montantTTC: true }
        })
    ]);

    console.log('Depense Stats:', JSON.stringify(expenses, null, 2));
    console.log('Invoice Stats:', JSON.stringify(invoices, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
