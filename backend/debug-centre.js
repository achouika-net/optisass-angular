
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function checkCentre() {
    try {
        const f = await prisma.facture.findUnique({
            where: { id: 'fd7f7ac4-dcb4-4690-9c5f-23bdd6880969' },
            include: { client: true }
        });

        if (!f) { console.log('Invoice not found'); return; }

        console.log(`Facture CentreID: '${f.centreId}'`);
        console.log(`Client CentreID: '${f.client?.centreId}'`);
    } catch (e) { console.error(e); }
    finally { await prisma.$disconnect(); }
}
checkCentre();
