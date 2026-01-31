require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log('--- Diagnostic Paiements vs Opérations ---');
    const payments = await prisma.paiement.findMany({
        where: { facture: { numero: 'BC-2026-002' } },
        include: { operationCaisse: true }
    });

    payments.forEach(p => {
        console.log(`Paiement ID: ${p.id}`);
        console.log(`  Montant: ${p.montant}`);
        console.log(`  Mode (Paiement): ${p.mode}`);
        if (p.operationCaisse) {
            console.log(`  Moyen (Opération): ${p.operationCaisse.moyenPaiement}`);
            if (p.mode !== p.operationCaisse.moyenPaiement) {
                console.log(`  ⚠️ MISMATCH DETECTED!`);
            }
        } else {
            console.log('  ⚠️ NO LINKED OPERATION');
        }
    });
}

check()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
