
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: 'postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public'
        }
    }
});

async function main() {
    const expenses = await prisma.depense.findMany({
        orderBy: { createdAt: 'desc' },
        include: { fournisseur: true }
    });

    console.log(`Total Depenses: ${expenses.length}`);
    expenses.forEach(e => {
        console.log(`Cat: ${e.categorie}, Desc: ${e.description}, InvLink: ${e.factureFournisseurId}, EchLink: ${e.echeanceId}, Supplier: ${e.fournisseur?.nom}`);
    });

    await prisma.$disconnect();
}

main();
