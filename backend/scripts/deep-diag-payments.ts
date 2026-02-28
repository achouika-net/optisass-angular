
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('--- DEEP DIAGNOSTIC: ECHEANCES ---');

    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

    const recentlyCreated = await prisma.echeancePaiement.findMany({
        where: {
            createdAt: { gte: tenMinutesAgo }
        },
        include: {
            factureFournisseur: true,
            depense: true
        },
        orderBy: { createdAt: 'desc' }
    });

    console.log(`Recently created: ${recentlyCreated.length} records`);

    const samples = recentlyCreated.slice(0, 10).map(e => ({
        id: e.id,
        montant: e.montant,
        statut: e.statut,
        ref: e.reference,
        remarque: e.remarque,
        invNum: e.factureFournisseur?.numeroFacture,
        invRef: e.factureFournisseur?.referenceInterne,
        depDesc: e.depense?.description,
        createdAt: e.createdAt
    }));

    console.log('Last 10 records:', JSON.stringify(samples, null, 2));

    // Check for auto-created invoices too
    const newInvoices = await prisma.factureFournisseur.findMany({
        where: { createdAt: { gte: tenMinutesAgo } }
    });
    console.log(`Recently created invoices: ${newInvoices.length}`);
    console.log('New Invoices sample:', newInvoices.slice(0, 5).map(f => ({
        num: f.numeroFacture,
        ref: f.referenceInterne,
        remarque: (f as any).remarque
    })));
}

main();
