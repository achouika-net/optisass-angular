const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const toDelete = [];

    // Timestamp duplicate
    const timestampDups = await prisma.paiement.findMany({
        where: {
            factureId: '0409c298-6e54-4735-8664-5047ae663806',
            montant: 475,
            date: new Date('2026-02-20T00:47:40.619Z')
        }
    });
    if (timestampDups.length > 1) toDelete.push(timestampDups[1].id);

    // Overpaid 10105
    const f10105 = await prisma.facture.findUnique({
        where: { numero: '10105' },
        include: { paiements: true }
    });
    if (f10105 && f10105.paiements.length > 1) {
        const p1 = f10105.paiements[0];
        const p2 = f10105.paiements[1];
        if (p1.montant === 50 && p2.montant === 50) toDelete.push(p2.id);
    }

    // Overpaid 219/2023
    const f219 = await prisma.facture.findUnique({
        where: { numero: '219/2023' },
        include: { paiements: true }
    });
    if (f219) {
        const seen = new Set();
        for (const p of f219.paiements) {
            const key = `${p.montant}_${p.mode}`;
            if (seen.has(key)) toDelete.push(p.id);
            else seen.add(key);
        }
    }

    console.log('IDs to delete:', toDelete);
    if (toDelete.length > 0) {
        const res = await prisma.paiement.deleteMany({
            where: { id: { in: toDelete } }
        });
        console.log(`Deleted ${res.count} payments.`);
    }

    await prisma.$disconnect();
}

run();
