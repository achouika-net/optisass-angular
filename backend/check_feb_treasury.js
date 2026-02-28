const axios = require('axios');

async function checkFeb() {
    try {
        const res2026Feb = await axios.get('http://localhost:3000/api/treasury/summary?month=2&year=2026');
        console.log('Feb 2026 Incoming (Payments):', res2026Feb.data.totalIncoming);

        const res2026Jan = await axios.get('http://localhost:3000/api/treasury/summary?month=1&year=2026');
        console.log('Jan 2026 Incoming (Payments):', res2026Jan.data.totalIncoming);

    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkFeb();
