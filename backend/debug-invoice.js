
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkInvoice() {
    try {
        const doc = await prisma.facture.findFirst({
            where: {
                numero: { contains: '1766745497205' }
            },
            include: {
                paiements: true,
                client: true
            }
        });

        if (doc) {
            console.log('Document found:');
            console.log('ID:', doc.id);
            console.log('Numero:', doc.numero);
            console.log('Type:', doc.type);
            console.log('Statut:', doc.statut);
            console.log('Total TTC:', doc.totalTTC);
            console.log('Reste à Payer:', doc.resteAPayer);
            console.log('Paiements:', doc.paiements.length);
            doc.paiements.forEach(p => {
                console.log(` - ${p.date.toISOString()} : ${p.montant} DH (${p.mode})`);
            });
        } else {
            console.log('Document NOT found.');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkInvoice();
