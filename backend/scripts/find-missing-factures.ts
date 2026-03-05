export { };
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const bcs = await prisma.facture.findMany({
        where: { type: 'BON_COMM' },
        include: { fiche: true }
    });

    console.log(`Checking ${bcs.length} BCs...`);

    const toFix: { id: any; numero: any; reason: string }[] = [];
    for (const f of bcs) {
        if (!f.fiche || !f.fiche.content) continue;

        try {
            // Look for any hint that it should be a facture
            const content = JSON.parse(f.fiche.content);

            // Check for common 'facture' flags in the imported JSON
            const isFacture =
                content.facture === 'OUI' ||
                content.facture === true ||
                content.avecFacture === 'OUI' ||
                content.avecFacture === 'oui' ||
                content.isDefinitive === true;

            if (isFacture) {
                toFix.push({
                    id: f.id,
                    numero: f.numero,
                    reason: isFacture ? 'Explicit flag' : 'Potential number'
                });
            }
        } catch (e) {
            // In case it's not JSON
            if (f.fiche.content.toLowerCase().includes('facture": "oui"') ||
                f.fiche.content.toLowerCase().includes('facture":"oui"')) {
                toFix.push({ id: f.id, numero: f.numero, reason: 'Grep match' });
            }
        }
    }

    console.log(`Found ${toFix.length} records that should probably be Factures.`);
    console.log(JSON.stringify(toFix, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
