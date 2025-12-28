
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
    try {
        const id = 'fd7f7ac4-dcb4-4690-9c5f-23bdd6880969'; // FAC-2025-001
        const f = await prisma.facture.findUnique({
            where: { id: id },
            include: { paiements: true }
        });

        if (!f) { console.log('Invoice not found'); return; }

        console.log(`Numero: ${f.numero}`);
        console.log(`Statut: ${f.statut}`);
        console.log(`Total: ${f.totalTTC}`);
        console.log(`Reste (DB): ${f.resteAPayer}`);
        const paid = f.paiements.reduce((s, p) => s + p.montant, 0);
        console.log(`Paid (Sum): ${paid}`);
        console.log(`Reste (Calc): ${f.totalTTC - paid}`);

    } catch (e) { console.error(e); }
    finally { await prisma.$disconnect(); }
}
check();
