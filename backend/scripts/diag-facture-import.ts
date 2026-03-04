import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("--- DB DIAGNOSIS ---");

    // Check counts
    const ficheCount = await prisma.fiche.count();
    const factureCount = await prisma.facture.count();

    console.log(`Total Fiches: ${ficheCount}`);
    console.log(`Total Factures: ${factureCount}`);

    if (ficheCount > 0 && factureCount === 0) {
        console.log("Fiches present but Factures are missing. Let's look at Fiche statuses and type.");

        const types = await prisma.fiche.groupBy({
            by: ['type'],
            _count: { type: true }
        });
        console.log("Types of Fiches:", types);

        const sampleFiches = await prisma.fiche.findMany({ take: 5 });
        console.log("Sample Fiches:");
        sampleFiches.forEach(f => {
            console.log(` - ID: ${f.id}, num: ${f.numero}, type: ${f.type}, statut: ${f.statut}, client: ${f.clientId}`);
        });
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
