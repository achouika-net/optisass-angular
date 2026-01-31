require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function repair() {
    console.log('--- Phase 1: Identifying Mismatches ---');

    // 1. Find all payments with linked operations
    const payments = await prisma.paiement.findMany({
        where: { operationCaisseId: { not: null } },
        include: { operationCaisse: { include: { journeeCaisse: true } } }
    });

    let fixedCount = 0;

    for (const p of payments) {
        const op = p.operationCaisse;
        if (!op) continue;

        const needsModeFix = p.mode !== op.moyenPaiement;
        const needsAmountFix = Math.abs(p.montant) !== op.montant;

        if (needsModeFix || needsAmountFix) {
            console.log(`Mismatch found for Payment ${p.id} (Ref: ${p.reference}):`);
            console.log(`  Paiement: ${p.mode} ${p.montant} DH`);
            console.log(`  Opération: ${op.moyenPaiement} ${op.montant} DH`);

            if (op.journeeCaisse.statut === 'OUVERTE' || true) { // We fix even if closed for data integrity, but be careful with totals
                await prisma.$transaction(async (tx) => {
                    // A. Reverse old totals from JourneeCaisse
                    await tx.journeeCaisse.update({
                        where: { id: op.journeeCaisseId },
                        data: {
                            totalVentesEspeces: op.moyenPaiement === 'ESPECES' ? { decrement: op.montant } : undefined,
                            totalVentesCarte: op.moyenPaiement === 'CARTE' ? { decrement: op.montant } : undefined,
                            totalVentesCheque: op.moyenPaiement === 'CHEQUE' ? { decrement: op.montant } : undefined,
                        }
                    });

                    // B. Update Operation to match Payment
                    await tx.operationCaisse.update({
                        where: { id: op.id },
                        data: {
                            moyenPaiement: p.mode,
                            montant: Math.abs(p.montant)
                        }
                    });

                    // C. Apply new totals to JourneeCaisse
                    const absMontant = Math.abs(p.montant);
                    await tx.journeeCaisse.update({
                        where: { id: op.journeeCaisseId },
                        data: {
                            totalVentesEspeces: p.mode === 'ESPECES' ? { increment: absMontant } : undefined,
                            totalVentesCarte: p.mode === 'CARTE' ? { increment: absMontant } : undefined,
                            totalVentesCheque: p.mode === 'CHEQUE' ? { increment: absMontant } : undefined,
                        }
                    });
                });
                console.log(`  ✅ Fixed.`);
                fixedCount++;
            }
        }
    }

    console.log(`--- Repair Finished. Fixed ${fixedCount} records. ---`);
}

repair()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
