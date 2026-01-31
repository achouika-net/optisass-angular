require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeOrphanPayments() {
    console.log('=== Analyse des paiements orphelins ===\n');

    // Les 2 paiements identifiés
    const paymentIds = [
        '7849cabc-083c-4186-9429-a4cec25483d3', // CARTE 1000 DH
        '7c316cd6-fa66-49db-9973-9622404e989f'  // CHEQUE 1340 DH
    ];

    for (const id of paymentIds) {
        const payment = await prisma.paiement.findUnique({
            where: { id },
            include: {
                facture: {
                    include: {
                        fiche: {
                            include: {
                                client: true
                            }
                        },
                        client: true
                    }
                }
            }
        });

        if (!payment) {
            console.log(`❌ Paiement ${id} non trouvé\n`);
            continue;
        }

        console.log(`--- Paiement ${id.substring(0, 8)}... ---`);
        console.log(`Montant: ${payment.montant} DH`);
        console.log(`Mode: ${payment.mode}`);
        console.log(`Document: ${payment.facture?.numero}`);
        console.log(`Type: ${payment.facture?.type}`);

        if (payment.facture?.client) {
            const client = payment.facture.client;
            console.log(`Client (via facture): ${client.prenom} ${client.nom} (ID: ${client.id})`);
        }

        if (payment.facture?.fiche) {
            console.log(`Fiche médicale: ${payment.facture.fiche.id}`);
            if (payment.facture.fiche.client) {
                const ficheClient = payment.facture.fiche.client;
                console.log(`Client (via fiche): ${ficheClient.prenom} ${ficheClient.nom}`);
            }
        } else {
            console.log(`⚠️ PROBLÈME: Facture ${payment.facture?.numero} n'a PAS de fiche médicale liée !`);
        }

        console.log('');
    }

    // Vérifier tous les documents BC-2026-002 et FAC-2026-001
    console.log('\n=== Vérification des documents concernés ===\n');

    const docs = await prisma.facture.findMany({
        where: {
            numero: { in: ['BC-2026-002', 'FAC-2026-001'] }
        },
        include: {
            fiche: {
                include: {
                    client: true
                }
            },
            client: true,
            paiements: true
        }
    });

    for (const doc of docs) {
        console.log(`--- ${doc.numero} ---`);
        console.log(`Type: ${doc.type}`);
        console.log(`Client direct: ${doc.client?.prenom} ${doc.client?.nom}`);
        console.log(`Fiche: ${doc.ficheId || 'AUCUNE'}`);
        if (doc.fiche) {
            console.log(`Client via fiche: ${doc.fiche.client?.prenom} ${doc.fiche.client?.nom}`);
        }
        console.log(`Nombre de paiements: ${doc.paiements.length}`);
        console.log('');
    }
}

analyzeOrphanPayments()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
