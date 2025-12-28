
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkInvoiceLink() {
    try {
        const pay = await prisma.paiement.findFirst({
            where: { montant: 500 },
            orderBy: { date: 'desc' },
            include: { facture: { include: { client: true } } }
        });

        if (pay && pay.facture) {
            console.log(`Payment (${pay.id}) linked to Invoice: ${pay.facture.numero}`);
            console.log(`Invoice ID: ${pay.facture.id}`);
            console.log(`Invoice linked to Client: ${pay.facture.client?.nom} ${pay.facture.client?.prenom} (ID: ${pay.facture.clientId})`);
        } else {
            console.log('Payment not found');
        }
    } catch (e) { console.error(e); }
    finally { await prisma.$disconnect(); }
}
checkInvoiceLink();
