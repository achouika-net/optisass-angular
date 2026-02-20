
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const factures = await prisma.facture.findMany({
        select: { numero: true, type: true, statut: true, paiements: { select: { id: true } } }
    });

    const stats = {
        fac: factures.filter(f => f.numero?.startsWith('FAC')).length,
        bc: factures.filter(f => f.numero?.startsWith('BC') || f.type === 'BON_COMM').length,
        devis: factures.filter(f => f.numero?.startsWith('DEV') || f.numero?.startsWith('BRO') || f.type === 'DEVIS').length,
        avoir: factures.filter(f => f.type === 'AVOIR').length,
        instance_statut: factures.filter(f => f.statut === 'VENTE_EN_INSTANCE').length,
        other_with_payment: factures.filter(f =>
            !f.numero?.startsWith('FAC') &&
            !f.numero?.startsWith('BC') &&
            f.type !== 'BON_COMM' &&
            f.statut !== 'VENTE_EN_INSTANCE' &&
            f.paiements.length > 0
        ).length,
        total: factures.length
    };

    console.log('Facture stats:', JSON.stringify(stats, null, 2));

    await prisma.$disconnect();
}

main();
