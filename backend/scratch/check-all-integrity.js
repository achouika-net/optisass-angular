const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRelation(model, relationName, foreignKey) {
    console.log(`--- Checking ${model} -> ${relationName} (${foreignKey}) ---`);
    const records = await prisma[model].findMany();
    let orphans = 0;
    for (const record of records) {
        if (record[foreignKey]) {
            const related = await prisma[relationName].findUnique({
                where: { id: record[foreignKey] }
            });
            if (!related) {
                console.error(`ERROR: ${model} ID ${record.id} has orphaned ${foreignKey} ${record[foreignKey]}`);
                orphans++;
            }
        }
    }
    if (orphans === 0) console.log(`OK: No orphans found for ${model} -> ${relationName}`);
}

async function main() {
    try {
        await checkRelation('centre', 'groupe', 'groupeId');
        await checkRelation('bonLivraison', 'fournisseur', 'fournisseurId');
        await checkRelation('facture', 'client', 'clientId');
        console.log('--- All checks complete ---');
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

main();
