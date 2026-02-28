const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public"
        }
    }
});

async function main() {
    console.log('--- PHANTOM EXPENSES LIST ---');
    try {
        const depenses = await prisma.depense.findMany({
            include: {
                fournisseur: true,
                factureFournisseur: true
            },
            orderBy: { createdAt: 'desc' }
        });

        depenses.forEach((d, i) => {
            console.log(`[${i + 1}] ID: ${d.id}`);
            console.log(`    Date: ${d.date}`);
            console.log(`    Created: ${d.createdAt}`);
            console.log(`    Category: ${d.categorie}`);
            console.log(`    Description: ${d.description}`);
            console.log(`    Amount: ${d.montant}`);
            console.log(`    Supplier: ${d.fournisseur?.nom || 'None'}`);
            console.log(`    Facture ID: ${d.factureFournisseurId}`);
            console.log('---------------------------');
        });
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
