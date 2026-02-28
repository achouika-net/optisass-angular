import { PrismaClient } from '@prisma/client';

async function diagnoseMerging() {
    const prisma = new PrismaClient();
    console.log('🔍 Analyse des fusions de factures...');

    try {
        // Analyser les factures créées/modifiées aujourd'hui
        const factures = await prisma.factureFournisseur.findMany({
            where: {
                updatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
            },
            include: { fournisseur: true }
        });

        console.log(`📊 Nombre de factures analysées : ${factures.length}`);

        // On cherche des indices de fusions multiples sur des dates différentes
        // Mais comme on n'a que le résultat final, on va plutôt regarder si des montants semblent suspicieux
        // ou si on peut trouver dans les logs (si on avait accès)

        // Alternative : Créer un script qui simule le regroupement avec le champ Date inclus
        // Pour l'instant, voyons juste le top 10 des fournisseurs par nombre de factures
        const summary = await prisma.factureFournisseur.groupBy({
            by: ['fournisseurId', 'numeroFacture'],
            _count: true,
            having: {
                numeroFacture: { _count: { gt: 1 } }
            }
        });

        console.log(`⚠️  Doublons de numéros trouvés en base : ${summary.length}`);

    } catch (error) {
        console.error('❌ Erreur:', error);
    } finally {
        await prisma.$disconnect();
    }
}

diagnoseMerging();
