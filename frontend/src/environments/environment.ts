
// URL dynamique pour s'adapter au partage (Localhost vs IP Lan/VPN)
const hostname = window.location.hostname;
const isLocal = hostname === 'localhost';

export const environment = {
  production: true,
  envName: 'production',
  defaultLanguage: 'fr',
  appName: 'Agenda',
  // Pour le deploy VPS: toutes les requetes API passent par le proxy Nginx (/api)
  // Cela evite ERR_CONNECTION_REFUSED sur le port 3003
  apiUrl: isLocal ? 'http://localhost:3001' : '',
  websocketUrl: 'wss://optisaas.com/app/',
  appVersion: '2.0.0',
  geoapifyApiKey: '',
  n8nWebhookUrl: isLocal ? 'http://localhost:5678/webhook/ocr-invoice' : '/api'
};
