import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- CA Distribution by Type and Status ---');
        const factures = await prisma.facture.findMany({
            select: {
                type: true,
                statut: true,
                totalTTC: true
            }
        });

        const stats = new Map<string, { count: number, total: number }>();

        factures.forEach(f => {
            const key = `${f.type} - ${f.statut}`;
            const existing = stats.get(key) || { count: 0, total: 0 };
            stats.set(key, {
                count: existing.count + 1,
                total: existing.total + (f.totalTTC || 0)
            });
        });

        console.log('Type - Statut | Count | Total CA (TTC)');
        console.log('---------------------------------------');
        Array.from(stats.entries())
            .sort((a, b) => b[1].total - a[1].total)
            .forEach(([key, data]) => {
                console.log(`${key.padEnd(25)} | ${data.count.toString().padEnd(5)} | ${data.total.toFixed(2)}`);
            });

        const totalOverall = factures.reduce((acc, f) => acc + (f.totalTTC || 0), 0);
        console.log('---------------------------------------');
        console.log(`TOTAL OVERALL: ${totalOverall.toFixed(2)}`);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
