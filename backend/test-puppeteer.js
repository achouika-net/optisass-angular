const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // Log console messages
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    // Intercept requests
    await page.setRequestInterception(true);
    page.on('request', request => {
        if (request.url().includes('/api/factures/b00ce4fe-49d2-4305-8dff-6eb4afd4a35e') && request.method() === 'PATCH') {
            console.log('--- EXPECTED PATCH REQUEST INTERCEPTED ---');
            console.log('Payload:', request.postData());
        }
        request.continue();
    });

    console.log('Navigating to Facture Form...');
    // We need to login first or just mock the auth? 
    // The previous workflow scripts in golden-cluster usually mock or bypass...
    console.log('This script needs authentication to work. Let me just test via local angular mock instead.');
    
    await browser.close();
})();
