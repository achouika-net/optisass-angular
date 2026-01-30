
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const supplierId = 'bd707821-fbf6-466b-93f5-ea5c7429e625'; // DK DISTRIBUTION
    const warehouseId = 'e8f1c00d-c385-483f-b7f9-425198fb9a27'; // Entrepôt Secondaire
    const testRef = 'TEST-REF-' + Date.now();

    console.log('--- STARTING MANUAL ALIMENTATION TEST ---');

    try {
        await prisma.$transaction(async (tx) => {
            console.log('1. Creating Invoice...');
            const invoice = await tx.factureFournisseur.create({
                data: {
                    numeroFacture: 'TEST-INV-' + Date.now(),
                    dateEmission: new Date(),
                    type: 'FACTURE',
                    statut: 'A_PAYER',
                    montantHT: 100,
                    montantTVA: 20,
                    montantTTC: 120,
                    fournisseurId: supplierId,
                    centreId: '9ed857f4-dc03-449f-8fb8-42f7258bc113'
                }
            });
            console.log('Invoice created:', invoice.id);

            console.log('2. Creating/Updating Product...');
            const product = await tx.product.create({
                data: {
                    designation: 'PRODUCT TEST',
                    codeInterne: testRef,
                    codeBarres: testRef,
                    typeArticle: 'MONTURE',
                    statut: 'DISPONIBLE',
                    entrepotId: warehouseId,
                    utilisateurCreation: 'system',
                    prixAchatHT: 100,
                    prixVenteHT: 200,
                    prixVenteTTC: 240,
                    quantiteActuelle: 10
                }
            });
            console.log('Product created:', product.id);

            console.log('3. Creating Movement...');
            const movement = await tx.mouvementStock.create({
                data: {
                    type: 'ENTREE_ACHAT',
                    quantite: 10,
                    produitId: product.id,
                    entrepotDestinationId: warehouseId,
                    factureFournisseurId: invoice.id,
                    prixAchatUnitaire: 100,
                    motif: 'TEST MANUAL',
                    utilisateur: 'system'
                }
            });
            console.log('Movement created:', movement.id);
        });
        console.log('✅ TRANSACTION SUCCESS');
    } catch (e) {
        console.error('❌ TRANSACTION FAILED:', e);
    }
}

run().catch(console.error).finally(() => prisma.$disconnect());
