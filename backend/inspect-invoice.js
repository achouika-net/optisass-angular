const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const f = await prisma.facture.findFirst({
        where: { dateEmission: { gte: new Date('2023-02-01'), lte: new Date('2023-02-28') } }
    });
    if (f) {
        console.log('Invoice Numero:', f.numero);
        console.log('Lines (JSON):', JSON.stringify(f.lignes, null, 2));
    } else {
        console.log('No invoice found for Feb 2023');
    }
    process.exit(0);
}
main();
