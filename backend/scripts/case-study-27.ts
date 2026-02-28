
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('--- CASE STUDY: 27/2024 ---');

    const invoices = await prisma.factureFournisseur.findMany({
        where: {
            OR: [
                { numeroFacture: '27/2024' },
                { referenceInterne: { contains: '27/2024' } }
            ]
        },
        include: {
            fournisseur: true,
            _count: { select: { echeances: true } }
        }
    });

    console.log(`Found ${invoices.length} invoices matching 27/2024`);
    for (const inv of invoices) {
        console.log(`\nInvoice ID: ${inv.id}`);
        console.log(`Num: ${inv.numeroFacture}, InternalRef: ${inv.referenceInterne}`);
        console.log(`Supplier: ${inv.fournisseur.nom}`);

        const echeances = await prisma.echeancePaiement.findMany({
            where: { factureFournisseurId: inv.id }
        });
        console.log(`Echeances (${echeances.length}):`, echeances.map(e => ({
            id: e.id,
            montant: e.montant,
            statut: e.statut,
            remarque: e.remarque
        })));
    }
}

main().finally(() => prisma.$disconnect());
