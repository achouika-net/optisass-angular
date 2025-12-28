
async function checkApi() {
    try {
        const tenantId = '456f5be0-9f01-4ea1-8d55-f17a82e85ef8';
        const clientId = '5d9433ff-c646-449c-b90b-5e0de97979be';
        console.log(`Fetching invoices for Client ${clientId} with Tenant ${tenantId}...`);

        // Use dynamic import for node-fetch if needed or built-in global fetch (Node 18+)
        const res = await fetch(`http://localhost:3000/api/factures?clientId=${clientId}`, {
            headers: {
                'Tenant': tenantId,
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) { console.error('API Error:', res.status, res.statusText); return; }

        const invoices = await res.json();
        console.log(`API returned ${invoices.length} invoices.`);
        invoices.forEach(i => {
            console.log(`[API] ${i.numero} (${i.statut}) - ID: ${i.id} - Reste: ${i.resteAPayer}`);
        });

        // Check if expected invoice is there
        const found = invoices.find(i => i.id === 'fd7f7ac4-dcb4-4690-9c5f-23bdd6880969');
        if (found) console.log('✅ TARGET INVOICE FOUND via API');
        else console.log('❌ TARGET INVOICE NOT FOUND via API');

    } catch (e) { console.error(e); }
}
checkApi();
