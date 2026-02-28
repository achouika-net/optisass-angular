import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public"
        }
    }
});

async function main() {
    const depenses = await prisma.depense.findMany({
        take: 10,
        select: {
            id: true,
            description: true,
            categorie: true,
            montant: true,
            fournisseurId: true,
            factureFournisseurId: true
        }
    });

    console.log('Sample of remaining Depenses:');
    console.log(JSON.stringify(depenses, null, 2));

    await prisma.$disconnect();
}

main();
