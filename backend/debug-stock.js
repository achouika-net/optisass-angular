
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function checkStock() {
    try {
        const id = 'fd7f7ac4-dcb4-4690-9c5f-23bdd6880969'; // FAC-2025-001
        const f = await prisma.facture.findUnique({
            where: { id: id },
            include: {
                mouvementsStock: true
            }
        });

        if (!f) { console.log('Invoice not found'); return; }

        console.log(`Numero: ${f.numero}`);
        console.log(`Lignes Count: ${f.lignes.length}`);
        f.lignes.forEach((l, i) => {
            console.log(` Line ${i}: ${l.description}`);
            console.log(`   - ProductID: ${l.productId || 'NONE'}`);
            console.log(`   - Qty: ${l.qte}`);
        });

        console.log('--- MOVEMENTS STOCK ---');
        if (f.mouvementsStock.length === 0) {
            console.log('NO STOCK MOVEMENTS FOUND.');
        } else {
            f.mouvementsStock.forEach(m => {
                console.log(` [${m.type}] Product ${m.productId}: Qty ${m.quantite} (Old: ${m.ancienneQuantite} -> New: ${m.nouvelleQuantite})`);
            });
        }

    } catch (e) { console.error(e); }
    finally { await prisma.$disconnect(); }
}
checkStock();
