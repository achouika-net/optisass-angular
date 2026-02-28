const axios = require('axios');

async function debugTreasuryData() {
    try {
        const res = await axios.get('http://localhost:3000/api/treasury/summary?month=0&year=2026');
        console.log('Treasury Summary Keys:', Object.keys(res.data));
        console.log('totalIncoming:', res.data.totalIncoming);
        console.log('totalExpenses:', res.data.totalExpenses);

        // Let's check if there are many categories
        if (res.data.categories) {
            console.log('Categories:', res.data.categories.length);
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
}

debugTreasuryData();
