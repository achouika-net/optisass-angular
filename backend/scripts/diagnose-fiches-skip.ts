
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnoseFichesSkip() {
    console.log('🔍 Starting DIAGNOSIS of Unlinked Factures...');

    try {
        // 1. Get sample of unlinked factures (factures created by Ventes import but not linked to a Fiche)
        // logic: created recently, no ficheId
        const unlinkedFactures = await prisma.facture.findMany({
            where: {
                ficheId: null,
                createdAt: { gt: new Date(Date.now() - 1000 * 60 * 60) } // Created in last hour
            },
            take: 20
        });

        console.log(`Found ${unlinkedFactures.length} recently created UNLINKED factures.`);

        if (unlinkedFactures.length === 0) {
            console.log('✅ No obvious unlinked factures found from recent import.');
            return;
        }

        for (const facture of unlinkedFactures) {
            console.log(`\n--------------------------------------------------`);
            console.log(`Analyzing Facture: ${facture.numero} (ID: ${facture.id})`);
            console.log(`Client ID: ${facture.clientId}`);

            // Try to extract a potential Fiche number from the Facture numero? 
            // Often "98/2015" means Fiche 98.
            const parts = facture.numero.split('/');
            if (parts.length > 1) {
                const potentialFicheNum = parseInt(parts[0]);
                console.log(` -> Detected potential Fiche Number from format: ${potentialFicheNum}`);

                if (!isNaN(potentialFicheNum)) {
                    // Check if this Fiche exists
                    const fiche = await prisma.fiche.findFirst({
                        where: { numero: potentialFicheNum },
                        include: { facture: true, client: true }
                    });

                    if (fiche) {
                        console.log(` -> ✅ Fiche ${potentialFicheNum} EXISTS! (ID: ${fiche.id})`);
                        console.log(`    -> Client: ${fiche.client.nom} (ID: ${fiche.clientId})`);

                        if (fiche.clientId !== facture.clientId) {
                            console.log(`    -> ⚠️ CLIENT MISMATCH! Facture Client: ${facture.clientId} vs Fiche Client: ${fiche.clientId}`);
                        }

                        if (fiche.facture) {
                            console.log(`    -> ⚠️ Fiche already has a Linked Facture: ${fiche.facture.numero} (ID: ${fiche.facture.id})`);
                            console.log(`       This explains why a NEW facture was created. The import logic didn't update the existing one.`);
                        } else {
                            console.log(`    -> ❓ Fiche has NO linked facture. The link should have happened.`);
                        }
                    } else {
                        console.log(` -> ❌ Fiche ${potentialFicheNum} does NOT exist in the database.`);
                    }
                }
            } else {
                console.log(` -> Could not parse a standard "Num/Year" format from string.`);
            }
        }

    } catch (error) {
        console.error('Stack trace:', error);
    } finally {
        await prisma.$disconnect();
    }
}

diagnoseFichesSkip();
