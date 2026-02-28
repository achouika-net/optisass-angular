
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public"
        }
    }
});

async function main() {
    const count = await prisma.factureFournisseur.count();
    console.log(`Total FactureFournisseur: ${count}`);

    const suffixed = await prisma.factureFournisseur.count({
        where: {
            numeroFacture: {
                contains: '_'
            }
        }
    });
    console.log(`Suffixed records (likely duplicates): ${suffixed}`);

    const sansFacture = await prisma.factureFournisseur.count({
        where: {
            numeroFacture: {
                startsWith: 'SANS_NUM_'
            }
        }
    });
    console.log(`Sans Facture records: ${sansFacture}`);

    const sample = await prisma.factureFournisseur.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
            numeroFacture: true,
            fournisseur: { select: { nom: true } },
            montantTTC: true,
            statut: true,
            createdAt: true
        }
    });

    console.log('Last 20 imported records:');
    console.table(sample);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
