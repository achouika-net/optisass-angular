const axios = require('axios');

async function debugTreasuryDates() {
    try {
        const res = await axios.get('http://localhost:3000/api/treasury/summary?month=0&year=2026');
        console.log('Total Incoming:', res.data.totalIncoming);

        // We can't see dates directly in summary, so let's check a month in 2025
        const res2025 = await axios.get('http://localhost:3000/api/treasury/summary?month=7&year=2025');
        console.log('July 2025 Incoming:', res2025.data.totalIncoming);

        const res2026 = await axios.get('http://localhost:3000/api/treasury/summary?month=1&year=2026');
        console.log('Jan 2026 Incoming:', res2026.data.totalIncoming);

    } catch (err) {
        console.error('Error:', err.message);
    }
}

debugTreasuryDates();
