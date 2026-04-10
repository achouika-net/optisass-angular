
// URL dynamique pour s'adapter au partage (Localhost vs IP Lan/VPN)
const hostname = window.location.hostname;
const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.');


export const environment = {
  production: true,
  envName: 'production',
  defaultLanguage: 'fr',
  appName: 'Agenda',
  // Cela evite ERR_CONNECTION_REFUSED sur le port 3003
  apiUrl: isLocal ? 'http://localhost:3000' : '',
  websocketUrl: 'wss://optisaas.com/app/',
  appVersion: '2.0.0',
  geoapifyApiKey: '',
  n8nWebhookUrl: isLocal ? 'http://localhost:5678/webhook/ocr-invoice' : '/api'
};
