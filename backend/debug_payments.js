const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
    const client = await prisma.client.findFirst({
        where: {
            OR: [
                { nom: { contains: 'chouika', mode: 'insensitive' } },
                { raisonSociale: { contains: 'chouika', mode: 'insensitive' } }
            ]
        },
        include: {
            factures: {
                include: {
                    paiements: true
                }
            }
        }
    });

    if (!client) {
        console.log('Client not found');
        return;
    }

    console.log(`Client: ${client.nom} ${client.prenom}`);
    client.factures.forEach(f => {
        console.log(`Facture: ${f.numero} | Status: ${f.statut} | Total: ${f.totalTTC} | Reste: ${f.resteAPayer}`);
        f.paiements.forEach(p => {
            console.log(`  - Paiement: ${p.montant} DH | Mode: ${p.mode} | Notes: ${p.notes}`);
        });
    });
}

debug();
