
const { PrismaClient } = require('@prisma/client');
const PDFDocument = require('pdfkit');

async function testSage() {
    console.log('--- Testing Sage Export ---');
    const prisma = new PrismaClient();
    try {
        const start = new Date('2026-01-01');
        const end = new Date('2026-01-31');

        const invoices = await prisma.facture.findMany({
            where: {
                dateEmission: { gte: start, lte: end },
                statut: { in: ['VALIDE', 'VALIDEE', 'PAYEE', 'SOLDEE', 'ENCAISSE'] },
            },
            include: { client: true },
        });
        console.log(`Found ${invoices.length} invoices`);

        const payments = await prisma.paiement.findMany({
            where: {
                date: { gte: start, lte: end },
                statut: 'ENCAISSE',
            },
            include: { facture: { include: { client: true } } },
        });
        console.log(`Found ${payments.length} payments`);

        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        doc.fontSize(20).text('TEST PDF');
        doc.end();
        console.log('PDF Generation Logic Check: OK');

    } catch (e) {
        console.error('CRASH DURING TEST:', e);
    } finally {
        await prisma.$disconnect();
    }
}

testSage();
