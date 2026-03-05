import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("--- TRYING TO BULK INSERT FAKE FACTURES ---");

    const fiches = await prisma.fiche.findMany({ take: 5 });
    if (fiches.length === 0) {
        console.log("No fiches found.");
        return;
    }

    const facturesToCreate = fiches.map((fiche, index) => {
        return {
            id: `test-facture-id-${index}`,
            numero: `Fact-${fiche.numero}`,
            type: 'FACTURE',
            statut: 'VALIDE',
            clientId: fiche.clientId,
            ficheId: fiche.id,
            dateEmission: new Date(),
            totalHT: 100,
            totalTVA: 20,
            totalTTC: 120,
            resteAPayer: 120,
            lignes: [],
            proprietes: {}
        };
    });

    try {
        const result = await prisma.facture.createMany({
            data: facturesToCreate,
            skipDuplicates: true
        });
        console.log("Bulk insert SUCCESS:", result);
    } catch (e: any) {
        console.error("Bulk insert FAILED:", e);
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
