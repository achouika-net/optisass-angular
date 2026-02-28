const axios = require('axios');

async function verifyAllPeriodFix() {
    try {
        const res = await axios.get('http://localhost:3000/api/treasury/summary?month=0&year=2026');
        console.log('All Period Summary (month=0):');
        console.log(`Total Incoming: ${res.data.totalIncoming}`);
    } catch (err) {
        console.error('Error:', err.message);
    }
}

verifyAllPeriodFix();
