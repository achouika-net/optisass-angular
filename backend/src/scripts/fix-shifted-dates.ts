import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function normalizeToUTCNoon(date: Date): Date {
    return new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        12, 0, 0, 0
    ));
}

async function main() {
    console.log('--- Starting Financial Date Repair ---');

    // 1. Repair EcheancePaiement
    const echeances = await prisma.echeancePaiement.findMany({
        where: { statut: { not: 'ANNULE' } }
    });
    console.log(`Found ${echeances.length} installments to check.`);

    for (const e of echeances) {
        if (e.dateEcheance.getUTCHours() !== 12) {
            const nextDate = normalizeToUTCNoon(e.dateEcheance);
            await prisma.echeancePaiement.update({
                where: { id: e.id },
                data: { dateEcheance: nextDate }
            });
        }
    }

    // 2. Repair Depense
    const depenses = await prisma.depense.findMany();
    console.log(`Found ${depenses.length} expenses to check.`);
    for (const d of depenses) {
        let updateData: any = {};
        if (d.date.getUTCHours() !== 12) {
            updateData.date = normalizeToUTCNoon(d.date);
        }
        if (d.dateEcheance && d.dateEcheance.getUTCHours() !== 12) {
            updateData.dateEcheance = normalizeToUTCNoon(d.dateEcheance);
        }

        if (Object.keys(updateData).length > 0) {
            await prisma.depense.update({
                where: { id: d.id },
                data: updateData
            });
        }
    }

    // 3. Repair FactureFournisseur
    const factures = await prisma.factureFournisseur.findMany();
    console.log(`Found ${factures.length} supplier invoices to check.`);
    for (const f of factures) {
        let updateData: any = {};
        if (f.dateEmission.getUTCHours() !== 12) {
            updateData.dateEmission = normalizeToUTCNoon(f.dateEmission);
        }
        if (f.dateEcheance && f.dateEcheance.getUTCHours() !== 12) {
            updateData.dateEcheance = normalizeToUTCNoon(f.dateEcheance);
        }

        if (Object.keys(updateData).length > 0) {
            await prisma.factureFournisseur.update({
                where: { id: f.id },
                data: updateData
            });
        }
    }

    console.log('--- Date Repair Complete ---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
