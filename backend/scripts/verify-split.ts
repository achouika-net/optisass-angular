
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const factures = await prisma.facture.findMany({
        select: { numero: true, type: true, statut: true, paiements: { select: { id: true } } }
    });

    // Simulated getBrouillonWithPayments filter
    const bcItems = factures.filter(f => {
        if (f.statut === 'ARCHIVE' || f.statut === 'ANNULEE') return false;
        if (f.type === 'AVOIR') return false;

        if (f.statut === 'VENTE_EN_INSTANCE') return true;

        const isBC = f.type === 'BON_COMMANDE' || f.type === 'BON_COMM' || (f.numero || '').startsWith('BC');
        if (isBC) return true;

        const hasPayments = f.paiements && f.paiements.length > 0;
        const isNotFinal = !(f.numero || '').startsWith('FAC') && f.type !== 'FACTURE';
        if (hasPayments && isNotFinal) return true;

        return false;
    });

    // Simulated getValidInvoices filter
    const facItems = factures.filter(f => {
        const isFace = (f.numero || '').startsWith('FAC') || f.type === 'FACTURE';
        if (!isFace) return false;
        if (f.statut === 'VENTE_EN_INSTANCE') return false;
        if (f.type === 'AVOIR') return false;
        return true;
    });

    // Simulated getAvoirs filter
    const avoirItems = factures.filter(f => f.type === 'AVOIR');

    // Simulated getBrouillonWithoutPayments (Devis) filter
    const devisItems = factures.filter(f => {
        if (f.statut === 'ARCHIVE' || f.statut === 'ANNULEE' || f.statut === 'VENTE_EN_INSTANCE') return false;
        if (f.paiements.length > 0) return false;

        const isBC = f.type === 'BON_COMMANDE' || f.type === 'BON_COMM' || (f.numero || '').startsWith('BC');
        if (isBC) return false;

        const num = (f.numero || '').toUpperCase();
        return f.type === 'DEVIS' || num.startsWith('BRO') || num.startsWith('DEV') || num.startsWith('DEVIS');
    });

    console.log('Verification Counts:');
    console.log('- Bons de Commande (Tab 1):', bcItems.length);
    console.log('- Devis (Tab 2):', devisItems.length);
    console.log('- Factures (Tab 3):', facItems.length);
    console.log('- Avoirs (Tab 4):', avoirItems.length);

    await prisma.$disconnect();
}

main();
