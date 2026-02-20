
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
    const firstFacture = await prisma.facture.findFirst({ select: { centreId: true } });
    const centreId = firstFacture?.centreId;

    if (!centreId) {
        console.log('No data found to verify.');
        return;
    }

    console.log('Verifying for Center ID:', centreId);

    // Fetch all for manual audit
    const factures = await prisma.facture.findMany({
        where: { centreId },
        include: { paiements: true }
    });

    const activeFactures = factures.filter(f => f.statut !== 'ARCHIVE' && f.statut !== 'ANNULEE');

    const faceDocs = activeFactures.filter(f => (f.numero || '').startsWith('FAC') || f.type === 'FACTURE');
    const avoirDocs = activeFactures.filter(f => f.type === 'AVOIR');

    const totalValid = faceDocs.reduce((sum, f) => sum + (f.totalTTC || 0), 0);
    const totalAvoir = avoirDocs.reduce((sum, f) => sum + (f.totalTTC || 0), 0);
    const totalCA = totalValid - totalAvoir;

    console.log('Verification:');
    console.log('- Total Valid Invoices (Excluding Avoirs):', faceDocs.length);
    console.log('- Total Avoirs (Active):', avoirDocs.length);
    console.log('- Gross Turnover (FAC- sum):', totalValid);
    console.log('- Refunded sum (AVOIR sum):', totalAvoir);
    console.log('- Net Turnover (CA):', totalCA);

    // Check categorization for BC vs Devis
    const bcDocs = activeFactures.filter(f => {
        if (f.type === 'AVOIR') return false;
        const isFace = (f.numero || '').startsWith('FAC') || f.type === 'FACTURE';
        if (isFace && f.statut !== 'VENTE_EN_INSTANCE') return false;

        const isBC = f.type === 'BON_COMMANDE' || f.type === 'BON_COMM' || (f.numero || '').startsWith('BC') || f.statut === 'VENTE_EN_INSTANCE';
        const hasPayments = f.paiements && f.paiements.length > 0;
        return isBC || hasPayments;
    });

    console.log('- Total Orders (BCs):', bcDocs.length);

    await prisma.$disconnect();
}

verify();
