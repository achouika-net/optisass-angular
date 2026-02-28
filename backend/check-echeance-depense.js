
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: 'postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public'
        }
    }
});

async function main() {
    const echeancesWithDepense = await prisma.echeancePaiement.findMany({
        where: {
            depense: { isNot: null }
        },
        include: { depense: true }
    });

    console.log(`EcheancePaiement with Depense: ${echeancesWithDepense.length}`);
    echeancesWithDepense.forEach(e => console.log(`  - Echeance ID: ${e.id}, Depense ID: ${e.depense.id}, Amount: ${e.montant}, Depense Amount: ${e.depense.montant}`));

    await prisma.$disconnect();
}

main();
