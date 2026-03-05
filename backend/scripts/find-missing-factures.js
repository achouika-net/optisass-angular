const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const bcs = await prisma.facture.findMany({
        where: { type: 'BON_COMM' },
        include: { fiche: true }
    });

    console.log(`Checking ${bcs.length} BCs...`);

    const toFix = [];
    for (const f of bcs) {
        if (!f.fiche || !f.fiche.content) continue;

        let content = f.fiche.content;
        if (typeof content === 'string') {
            try {
                content = JSON.parse(content);
            } catch (e) {
                // Not JSON
            }
        }

        if (typeof content === 'object' && content !== null) {
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
                    reason: 'Explicit flag'
                });
            }
        } else if (typeof content === 'string') {
            if (content.toLowerCase().includes('"facture": "oui"') ||
                content.toLowerCase().includes('"facture":"oui"')) {
                toFix.push({ id: f.id, numero: f.numero, reason: 'Grep match' });
            }
        }
    }

    console.log(`Found ${toFix.length} records that should probably be Factures.`);
    console.log(JSON.stringify(toFix, null, 2));

    if (toFix.length > 0) {
        console.log('Fixing them...');
        for (const item of toFix) {
            let newNum = item.numero;
            if (newNum.startsWith('BC-')) {
                newNum = newNum.replace('BC-', 'FAC-');
            }
            await prisma.facture.update({
                where: { id: item.id },
                data: {
                    type: 'FACTURE',
                    statut: 'VALIDE',
                    numero: newNum
                }
            });
        }
        console.log('Done fixing.');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
