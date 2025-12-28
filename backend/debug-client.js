
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkClientInvoices() {
    try {
        // Use known Invoice ID to get Client ID
        const invoice = await prisma.facture.findUnique({
            where: { id: 'a921ad9a-c9ed-4bf2-a2e3-850976528e77' }, // Known ID from previous debug
            include: { client: true }
        });

        if (!invoice) { console.log('Known Invoice not found.. weird.'); return; }

        const client = invoice.client;
        console.log(`Client Found via Invoice: ${client.nom} ${client.prenom} (${client.id})`);

        const invoices = await prisma.facture.findMany({
            where: { clientId: client.id },
            include: { paiements: true },
            orderBy: { createdAt: 'desc' }
        });

        console.log(`Start Listing ${invoices.length} invoices:`);
        invoices.forEach(i => {
            const totalPaye = i.paiements.reduce((s, p) => s + p.montant, 0);
            // Calc logic check
            const paidAmount = i.totalTTC - i.resteAPayer;
            const discrepancy = Math.abs(paidAmount - totalPaye);

            console.log(`[${i.statut}] ${i.type} "${i.numero}"`);
            console.log(`    Total: ${i.totalTTC} | Reste: ${i.resteAPayer} | Payé (Calc): ${totalPaye}`);
            if (discrepancy > 0.01) console.log(`    ⚠️ DISCREPANCY: Reste says paid ${paidAmount}, but payments sum is ${totalPaye}`);

            if (i.paiements.length > 0) {
                // i.paiements.forEach(p => console.log(`    - P: ${p.montant}`));
            }
        });

    } catch (e) { console.error(e); }
    finally { await prisma.$disconnect(); }
}

checkClientInvoices();
