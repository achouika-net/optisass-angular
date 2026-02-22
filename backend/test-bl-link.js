const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    console.log('--- Testing BL Link via Fiche (Feb 2023) ---');

    const startFeb2023 = new Date('2023-02-01T00:00:00Z');
    const endFeb2023 = new Date('2023-02-28T23:59:59Z');

    const salesInvoices = await prisma.facture.findMany({
        where: {
            dateEmission: { gte: startFeb2023, lte: endFeb2023 },
            ficheId: { not: null }
        },
        select: { id: true, numero: true, ficheId: true }
    });

    console.log(`Sales invoices with FicheId found: ${salesInvoices.length}`);
    const ficheIds = salesInvoices.map(s => s.ficheId);

    const linkedBLs = await prisma.factureFournisseur.findMany({
        where: {
            ficheId: { in: ficheIds },
            isBL: true
        }
    });

    console.log(`Linked Supplier BLs found: ${linkedBLs.length}`);
    const totalBlHT = linkedBLs.reduce((sum, bl) => sum + (bl.montantHT || 0), 0);
    console.log(`Total COGS from BLs: ${totalBlHT}`);

    if (linkedBLs.length > 0) {
        console.log('Sample matches:');
        linkedBLs.slice(0, 3).forEach(bl => {
            const sale = salesInvoices.find(s => s.ficheId === bl.ficheId);
            console.log(`- Sale ${sale.numero} (Fiche ${bl.ficheId}) <-> BL ${bl.numeroFacture} (Cost HT: ${bl.montantHT})`);
        });
    }

    process.exit(0);
}
main();
