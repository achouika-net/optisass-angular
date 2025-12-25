const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
    console.log('--- DIAGNOSTIC PAIEMENTS ---');
    const paiements = await prisma.paiement.findMany({
        include: {
            facture: true
        }
    });

    paiements.forEach(p => {
        console.log(`Payment ID: ${p.id} | Amount: ${p.montant} | Facture: ${p.facture?.numero} (${p.facture?.statut}) | Notes: ${p.notes}`);
    });

    console.log('--- DIAGNOSTIC FACTURES ---');
    const factures = await prisma.facture.findMany({
        where: {
            OR: [
                { numero: { contains: 'FAC' } },
                { numero: { contains: 'AVR' } }
            ]
        }
    });

    factures.forEach(f => {
        console.log(`Facture: ${f.numero} | ID: ${f.id} | Status: ${f.statut} | Total: ${f.totalTTC} | Reste: ${f.resteAPayer}`);
    });
}

debug();
