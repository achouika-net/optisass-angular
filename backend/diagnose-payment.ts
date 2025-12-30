import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const paymentId = 'e2935561-f740-4645-b7b7-91e3f7df23ae';

    console.log(`Checking Payment ${paymentId}...`);
    const payment = await prisma.paiement.findUnique({
        where: { id: paymentId },
        include: { operationCaisse: true, facture: true }
    });

    console.log('Payment:', JSON.stringify(payment, null, 2));

    if (!payment?.operationCaisse) {
        console.log('⚠️ Payment has NO linked operation!');
        // TODO: Create operation if missing
    } else {
        console.log('✅ Linked operation found.');
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
