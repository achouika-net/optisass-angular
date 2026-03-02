const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const VALID_TYPES = ['Facture', 'FACTURE', 'BON_COMMANDE', 'BC'];
    const VALID_STATUT = ['VALIDEE', 'PAYEE', 'PARTIELLE'];

    const config = await prisma.loyaltyConfig.findFirst();
    if (!config) { console.log('❌ LoyaltyConfig not found.'); process.exit(1); }

    const pointsPerDH = Number(config.pointsPerDH || 0.1);
    console.log(`✅ Config: ${pointsPerDH} point(s) per MAD`);

    const allFactures = await prisma.facture.findMany({
        where: {
            type: { in: VALID_TYPES },
            statut: { in: VALID_STATUT },
            totalTTC: { gt: 0 },
        },
        select: { id: true, clientId: true, totalTTC: true, type: true, numero: true }
    });
    const factures = allFactures.filter(f => !!f.clientId);
    console.log(`📊 Found ${factures.length} eligible factures (with client).`);

    const existing = await prisma.pointsHistory.findMany({
        where: { factureId: { not: null } },
        select: { factureId: true }
    });
    const alreadyAwarded = new Set(existing.map(e => e.factureId));
    console.log(`ℹ️  Already awarded for ${alreadyAwarded.size} factures.`);

    let awarded = 0;
    let skipped = 0;

    for (const f of factures) {
        if (alreadyAwarded.has(f.id)) { skipped++; continue; }
        const points = Math.floor(Number(f.totalTTC) * pointsPerDH);
        if (points <= 0) { skipped++; continue; }
        try {
            await prisma.$transaction([
                prisma.pointsHistory.create({
                    data: {
                        clientId: f.clientId,
                        factureId: f.id,
                        points,
                        type: 'ACHAT',
                        description: `Achat ${f.type} #${f.numero} — ${Number(f.totalTTC).toFixed(2)} MAD`,
                    }
                }),
                prisma.client.update({
                    where: { id: f.clientId },
                    data: { pointsFidelite: { increment: points } }
                })
            ]);
            awarded++;
        } catch (e) {
            console.error(`  ❌ Error on facture ${f.id}:`, e.message);
        }
    }

    console.log(`\n✅ Done! Awarded points for ${awarded} factures. Skipped ${skipped}.`);
    process.exit(0);
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
