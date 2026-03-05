import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("--- TRYING TO INSERT A FAKE FACTURE ---");

    const fiche = await prisma.fiche.findFirst();
    if (!fiche) {
        console.log("No fiche found.");
        return;
    }

    try {
        await prisma.facture.create({
            data: {
                id: 'test-facture-id-1234',
                numero: 'Fact-' + fiche.numero, // test uniqueness
                type: 'FACTURE',
                statut: 'VALIDE',
                clientId: fiche.clientId,
                ficheId: fiche.id, // linked to the fiche
                dateEmission: new Date(),
                totalHT: 100,
                totalTVA: 20,
                totalTTC: 120,
                resteAPayer: 120,
                lignes: [],
                proprietes: {}
            }
        });
        console.log("Single insert SUCCESS. The issue might be in duplicates within the array.");
    } catch (e: any) {
        console.log("Single insert FAILED:", e.message);
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
