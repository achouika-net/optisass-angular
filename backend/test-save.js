const axios = require('axios');

async function testApiSave() {
  try {
    // 1. Fetch a real fiche
    const fiches = await axios.get('http://localhost:3000/api/fiches?pageSize=1');
    if (!fiches.data.data.length) {
      console.log('No fiches');
      return;
    }
    const id = fiches.data.data[0].id;
    console.log('Testing on Fiche ID:', id);

    // 2. Imitate mapFrontendToBackendUpdate payload
    const payload = {
      content: {
        suiviCommande: {
          statut: 'RECU',
          fournisseur: 'Optiswiss_TEST',
          trackingNumber: 'TRK-999',
          referenceCommande: 'CMD-888'
        }
      }
    };

    // 3. Send PUT request
    const response = await axios.put(`http://localhost:3000/api/fiches/${id}`, payload);
    console.log('Saved Suivi Commande:', response.data.suiviCommande);
    console.log('Are they identical?', response.data.suiviCommande.fournisseur === 'Optiswiss_TEST');

  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err.message);
  }
}

testApiSave();
