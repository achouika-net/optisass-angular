const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
    console.log('--- Verifying Profit Fix for February 2023 ---');
    const startDate = new Date('2023-02-01T00:00:00Z');
    const endDate = new Date('2023-02-28T23:59:59Z');

    // 1. Revenue
    const revenueDocs = await prisma.facture.findMany({
        where: {
            dateEmission: { gte: startDate, lte: endDate },
            type: { in: ['FACTURE', 'BON_COMMANDE', 'AVOIR'] },
            statut: { notIn: ['BROUILLON', 'ANNULE'] }
        },
        select: { id: true, totalHT: true, type: true, lignes: true, ficheId: true }
    });

    let totalRevenue = 0;
    revenueDocs.forEach(d => {
        const val = Number(d.totalHT || 0);
        if (d.type === 'AVOIR') totalRevenue -= val;
        else totalRevenue += val;
    });
    console.log(`Total Revenue: ${totalRevenue}`);

    // 2. COGS
    // 2.1 MouvementStock
    const cogsResult = await prisma.$queryRawUnsafe(`
        SELECT SUM(ms."quantite" * COALESCE(ms."prixAchatUnitaire", 0)) as total_cost
        FROM "MouvementStock" ms
        JOIN "Facture" f ON ms."factureId" = f.id
        WHERE f."dateEmission" >= $1 AND f."dateEmission" <= $2
        AND ms.type = 'SORTIE'
    `, startDate, endDate);
    let rawCogs = Math.abs(Number(cogsResult[0]?.total_cost || 0));
    console.log(`COGS (Stock Movements): ${rawCogs}`);

    // 2.2 Linked BLs
    const ficheIds = revenueDocs.map(d => d.ficheId).filter(id => !!id && typeof id === 'string');
    let linkedCogs = 0;
    if (ficheIds.length > 0) {
        const linkedBls = await prisma.factureFournisseur.aggregate({
            where: {
                ficheId: { in: ficheIds },
                isBL: true
            },
            _sum: { montantHT: true }
        });
        linkedCogs = Number(linkedBls._sum.montantHT || 0);
    }
    console.log(`COGS (Linked BLs): ${linkedCogs}`);
    rawCogs += linkedCogs;

    // 2.3 Fallback (Simplified)
    console.log('Analyzing fallback COGS...');
    let fallbackCogs = 0;
    for (const doc of revenueDocs) {
        if (doc.type === 'AVOIR') continue;
        let lines = [];
        try {
            lines = typeof doc.lignes === 'string' ? JSON.parse(doc.lignes) : (doc.lignes || []);
        } catch (e) { }

        for (const line of lines) {
            // Check if there was a stock movement for this line
            const movement = await prisma.mouvementStock.findFirst({
                where: {
                    factureId: doc.id,
                    // Note: In reality we'd match by product, but simplified for verification
                }
            });

            if (!movement) {
                const designation = line.designation || line.description;
                if (designation) {
                    const product = await prisma.product.findFirst({
                        where: { designation: { contains: designation, mode: 'insensitive' } }
                    });
                    if (product && product.prixAchatHT) {
                        fallbackCogs += (Number(line.quantity || line.quantite || 1) * Number(product.prixAchatHT));
                    }
                }
            }
        }
    }
    console.log(`COGS (Fallback): ${fallbackCogs}`);
    rawCogs += fallbackCogs;
    console.log(`Total estimated COGS: ${rawCogs}`);

    // 3. Expenses
    const directExpenses = await prisma.depense.aggregate({
        where: { date: { gte: startDate, lte: endDate } },
        _sum: { montant: true }
    });

    const operationalSupplierInvoices = await prisma.factureFournisseur.aggregate({
        where: {
            dateEmission: { gte: startDate, lte: endDate },
            isBL: false,
            type: { in: ['ELECTRICITE', 'INTERNET', 'ASSURANCE', 'FRAIS BANCAIRES', 'AUTRES CHARGES'] }
        },
        _sum: { montantHT: true }
    });

    const totalExpenses = (Number(directExpenses._sum.montant || 0)) + (Number(operationalSupplierInvoices._sum.montantHT || 0));
    console.log(`Direct Expenses (Depense table): ${Number(directExpenses._sum.montant || 0)}`);
    console.log(`Operational Supplier Invoices: ${Number(operationalSupplierInvoices._sum.montantHT || 0)}`);
    console.log(`Total Expenses: ${totalExpenses}`);

    console.log('--- Summary ---');
    console.log(`Revenue: ${totalRevenue}`);
    console.log(`COGS: ${rawCogs}`);
    console.log(`Expenses: ${totalExpenses}`);
    console.log(`Gross Profit: ${totalRevenue - rawCogs}`);
    console.log(`Net Profit: ${totalRevenue - rawCogs - totalExpenses}`);
}

verify().catch(console.error).finally(() => prisma.$disconnect());
