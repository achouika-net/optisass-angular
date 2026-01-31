require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function repairOrphanPayments() {
    console.log('=== Réparation des paiements orphelins ===\n');

    // Les 2 paiements à réparer
    const paymentIds = [
        '7849cabc-083c-4186-9429-a4cec25483d3', // CARTE 1000 DH - BC-2026-002
        '7c316cd6-fa66-49db-9973-9622404e989f'  // CHEQUE 1340 DH - FAC-2026-001
    ];

    for (const paymentId of paymentIds) {
        console.log(`\n--- Traitement du paiement ${paymentId.substring(0, 8)}... ---`);

        const payment = await prisma.paiement.findUnique({
            where: { id: paymentId },
            include: {
                facture: {
                    include: {
                        fiche: {
                            include: {
                                client: true
                            }
                        }
                    }
                }
            }
        });

        if (!payment) {
            console.log(`❌ Paiement non trouvé`);
            continue;
        }

        if (payment.operationCaisseId) {
            console.log(`✅ Ce paiement a déjà une opération de caisse (${payment.operationCaisseId})`);
            continue;
        }

        console.log(`Montant: ${payment.montant} DH`);
        console.log(`Mode: ${payment.mode}`);
        console.log(`Document: ${payment.facture?.numero}`);
        console.log(`Date: ${payment.date}`);

        // Trouver ou créer une journée de caisse pour cette date
        const paymentDate = new Date(payment.date);
        paymentDate.setHours(0, 0, 0, 0);

        // Chercher une journée de caisse ouverte ou la plus récente
        let journee = await prisma.journeeCaisse.findFirst({
            where: {
                statut: 'OUVERTE'
            },
            orderBy: {
                dateOuverture: 'desc'
            }
        });

        if (!journee) {
            console.log(`⚠️ Aucune journée de caisse ouverte trouvée. Recherche de la dernière journée...`);
            journee = await prisma.journeeCaisse.findFirst({
                orderBy: {
                    dateOuverture: 'desc'
                }
            });
        }

        if (!journee) {
            console.log(`❌ Aucune journée de caisse trouvée dans le système !`);
            continue;
        }

        console.log(`Journée de caisse: ${journee.id} (${journee.statut})`);

        // Trouver un utilisateur pour l'opération (vendeur du paiement ou premier admin)
        let userId = payment.vendeurId;
        let userName = 'Système';

        if (userId) {
            const user = await prisma.user.findUnique({
                where: { id: userId }
            });
            if (user) {
                userName = user.username || user.email || 'Système';
            }
        } else {
            const admin = await prisma.user.findFirst({
                where: { role: 'ADMIN' }
            });
            if (admin) {
                userId = admin.id;
                userName = admin.username || admin.email || 'Admin';
            }
        }

        console.log(`Utilisateur: ${userName} (${userId || 'N/A'})`);

        // Créer l'opération de caisse
        try {
            const operation = await prisma.operationCaisse.create({
                data: {
                    journeeCaisseId: journee.id,
                    type: 'VENTE',
                    moyenPaiement: payment.mode,
                    montant: Math.abs(payment.montant),
                    reference: payment.facture?.numero || '',
                    motif: `Paiement ${payment.mode} - ${payment.facture?.numero}`,
                    utilisateur: userName,
                    userId: userId
                }
            });

            console.log(`✅ Opération de caisse créée: ${operation.id}`);

            // Lier le paiement à l'opération
            await prisma.paiement.update({
                where: { id: paymentId },
                data: {
                    operationCaisseId: operation.id
                }
            });

            console.log(`✅ Paiement lié à l'opération de caisse`);

            // Mettre à jour les totaux de la journée
            const montant = Math.abs(payment.montant);
            const updateData = {
                totalComptable: { increment: montant }
            };

            if (payment.mode === 'ESPECES') {
                updateData.totalVentesEspeces = { increment: montant };
            } else if (payment.mode === 'CARTE') {
                updateData.totalVentesCarte = { increment: montant };
            } else if (payment.mode === 'CHEQUE') {
                updateData.totalVentesCheque = { increment: montant };
            }

            await prisma.journeeCaisse.update({
                where: { id: journee.id },
                data: updateData
            });

            console.log(`✅ Totaux de la journée mis à jour`);

        } catch (error) {
            console.error(`❌ Erreur lors de la création de l'opération:`, error.message);
        }
    }

    console.log('\n=== Réparation terminée ===');
}

repairOrphanPayments()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
