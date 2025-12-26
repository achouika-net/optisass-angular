const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- Testing Credit Note Handling ---');

        // Get current month summary
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        console.log(`\nFetching treasury summary for ${month}/${year}...`);

        const response = await fetch(`http://localhost:3000/treasury/summary?year=${year}&month=${month}`);
        const data = await response.json();

        console.log('\n📊 Treasury Summary:');
        console.log('Total Incoming:', data.totalIncoming, 'DH');
        console.log('Total Incoming Cashed:', data.totalIncomingCashed, 'DH');
        console.log('Total Incoming Pending:', data.totalIncomingPending, 'DH');
        console.log('Balance:', data.balance, 'DH');

        console.log('\n💰 Testing Consolidated Incomings...');
        const incomingsResponse = await fetch('http://localhost:3000/treasury/consolidated-incomings');
        const incomings = await incomingsResponse.json();

        const avoirs = incomings.filter(p => p.isAvoir);
        console.log(`Found ${avoirs.length} credit notes (Avoirs)`);

        if (avoirs.length > 0) {
            console.log('\n📋 Sample Avoir:');
            console.log(JSON.stringify(avoirs[0], null, 2));
        }

        console.log('\n✅ Test completed successfully!');
    } catch (e) {
        console.error('❌ Test failed:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
