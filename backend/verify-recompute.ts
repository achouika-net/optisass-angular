import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getStats(id: string) {
    const journee = await prisma.journeeCaisse.findUnique({
        where: { id },
        include: { operations: true, caisse: true }
    });
    if (!journee) return null;

    const stats = {
        totalVentesEspeces: 0,
        totalVentesCarte: 0,
        totalVentesCheque: 0,
        totalInterne: 0,
        totalDepenses: 0
    };

    journee.operations.forEach(op => {
        if (op.type === 'ENCAISSEMENT') {
            if (op.typeOperation === 'COMPTABLE') {
                if (op.moyenPaiement === 'ESPECES') stats.totalVentesEspeces += op.montant;
                else if (op.moyenPaiement === 'CARTE') stats.totalVentesCarte += op.montant;
                else if (op.moyenPaiement === 'CHEQUE') stats.totalVentesCheque += op.montant;
            } else {
                stats.totalInterne += op.montant;
            }
        } else {
            if (op.typeOperation === 'COMPTABLE') {
                if (op.moyenPaiement === 'ESPECES') stats.totalVentesEspeces -= op.montant;
                else if (op.moyenPaiement === 'CARTE') stats.totalVentesCarte -= op.montant;
                else if (op.moyenPaiement === 'CHEQUE') stats.totalVentesCheque -= op.montant;
                stats.totalDepenses += op.montant;
            } else {
                stats.totalDepenses += op.montant;
            }
        }
    });

    return {
        nom: journee.caisse.nom,
        type: journee.caisse.type,
        fond: journee.fondInitial,
        ...stats,
        soldeCalc: journee.fondInitial + stats.totalInterne + stats.totalVentesEspeces - stats.totalDepenses
    };
}

async function main() {
    const principalId = '135a6256-28de-465e-9fd4-63e5e9720569';
    const depensesId = 'a220805c-3998-4ebb-970d-1c58351b745b';

    console.log('--- PRINCIPALE ---');
    console.log(await getStats(principalId));
    console.log('\n--- DEPENSES ---');
    console.log(await getStats(depensesId));
}

main().catch(console.error).finally(() => prisma.$disconnect());
