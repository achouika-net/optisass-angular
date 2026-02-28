const axios = require('axios');

async function verifyProfitFix() {
    try {
        console.log('--- Verifying Real Profit All Period ---');
        const profitRes = await axios.get('http://localhost:3000/api/stats/profit?startDate=&endDate=');
        console.log('Profit Summary:', JSON.stringify(profitRes.data, null, 2));

        console.log('\n--- Verifying Profit Evolution All Period ---');
        const evolutionRes = await axios.get('http://localhost:3000/api/stats/profit-evolution?startDate=&endDate=');
        console.log('Evolution Data:');
        evolutionRes.data.forEach(d => {
            console.log(`Month: ${d.month}, Revenue: ${d.revenue}, Expenses: ${d.expenses}`);
        });

        if (evolutionRes.data.length > 0) {
            console.log(`SUCCESS: Found ${evolutionRes.data.length} months of history.`);
        } else {
            console.log('WARNING: Evolution data is empty.');
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}

verifyProfitFix();
