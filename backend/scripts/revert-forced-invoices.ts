export { };
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Forced Invoice Reversion Script...');

    // 1. Find all "FACTURE" that don't match the official pattern (no '/')
    const forcedInvoices = await prisma.facture.findMany({
        where: {
            type: 'FACTURE',
            NOT: { numero: { contains: '/' } }
        }
    });

    console.log(`🔍 Found ${forcedInvoices.count || forcedInvoices.length} potential forced invoices to revert.`);

    let revertedCount = 0;
    for (const f of forcedInvoices) {
        let newNumero = f.numero;

        // Replace FAC- prefix with BC- if exists, else just prepend BC-
        if (newNumero.startsWith('FAC-')) {
            newNumero = newNumero.replace('FAC-', 'BC-');
        } else if (!newNumero.startsWith('BC-')) {
            newNumero = `BC-${newNumero}`;
        }

        try {
            await prisma.facture.update({
                where: { id: f.id },
                data: {
                    type: 'BON_COMM',
                    statut: 'VENTE_EN_INSTANCE',
                    numero: newNumero
                }
            });
            revertedCount++;
        } catch (e) {
            // console.error(`Failed to revert ${f.id}: ${e.message}`);
        }
    }

    console.log(`✅ Successfully reverted ${revertedCount} forced invoices to BON_COMM (BC-).`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
