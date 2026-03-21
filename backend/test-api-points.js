const axios = require('axios');

async function testApi() {
  try {
    const factureId = 'b00ce4fe-49d2-4305-8dff-6eb4afd4a35e'; // BC-2026-015
    const payload = {
      proprietes: {
        pointsUtilises: 50
      }
    };
    console.log('Sending payload:', payload);
    const res = await axios.patch(`http://localhost:3001/api/factures/${factureId}`, payload);
    console.log('Response status:', res.status);
    console.log('Response data:', res.data.proprietes);
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

testApi();
