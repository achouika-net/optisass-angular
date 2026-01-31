require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getOrphanPayments() {
    console.log('=== Recherche des paiements orphelins ===\n');

    const orphans = await prisma.paiement.findMany({
        where: {
            mode: { in: ['ESPECES', 'CARTE', 'CHEQUE'] },
            operationCaisseId: null
        },
        include: {
            facture: {
                select: {
                    numero: true,
                    type: true,
                    dateEmission: true,
                    totalTTC: true,
                    resteAPayer: true,
                    statut: true,
                    client: {
                        select: {
                            nom: true,
                            prenom: true,
                            raisonSociale: true
                        }
                    }
                }
            }
        }
    });

    console.log(`Trouvé ${orphans.length} paiement(s) orphelin(s):\n`);

    orphans.forEach((p, idx) => {
        console.log(`--- Paiement #${idx + 1} ---`);
        console.log(`ID: ${p.id}`);
        console.log(`Montant: ${p.montant} DH`);
        console.log(`Mode: ${p.mode}`);
        console.log(`Date: ${p.date}`);
        console.log(`Référence: ${p.reference || 'N/A'}`);
        console.log(`Statut: ${p.statut}`);

        if (p.facture) {
            const clientName = p.facture.client?.raisonSociale ||
                `${p.facture.client?.prenom || ''} ${p.facture.client?.nom || ''}`.trim();
            console.log(`\nDocument lié:`);
            console.log(`  - Numéro: ${p.facture.numero}`);
            console.log(`  - Type: ${p.facture.type}`);
            console.log(`  - Client: ${clientName}`);
            console.log(`  - Total: ${p.facture.totalTTC} DH`);
            console.log(`  - Reste à payer: ${p.facture.resteAPayer} DH`);
            console.log(`  - Statut: ${p.facture.statut}`);
        }
        console.log('');
    });

    return orphans;
}

getOrphanPayments()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
