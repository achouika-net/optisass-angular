const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public"
        }
    }
});

async function main() {
    const depenseCount = await prisma.depense.count();
    const invoiceCount = await prisma.factureFournisseur.count();
    console.log(`TOTAL DEPENSES: ${depenseCount}`);
    console.log(`TOTAL FACTURES FOURNISSEURS: ${invoiceCount}`);

    console.log('--- RECENT DEPENSES ---');
    try {
        const depenses = await prisma.depense.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
                factureFournisseur: true,
                fournisseur: true
            }
        });
        console.log(JSON.stringify(depenses, null, 2));

        console.log('--- RECENT FACTURES ---');
        const factures = await prisma.factureFournisseur.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: { fournisseur: true }
        });
        console.log(JSON.stringify(factures, null, 2));

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
