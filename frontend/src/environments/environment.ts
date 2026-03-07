import { IEnvironment } from './environment.model';

export const environment: IEnvironment = {
  production: false,
  envName: 'development',
  defaultLanguage: 'fr',
  appName: 'Agenda',
  apiUrl: 'http://151.80.146.74:3000/api/client',
  websocketUrl: 'wss://optisaas.com/app/',
  appVersion: '2.0.0',
  geoapifyApiKey: '1126815f98ed42a68fa0222dda3de4fc',
  ocr: {
    // Override only what differs from DEFAULT_OCR_CONFIG
    // backendOcrUrl: 'http://localhost:3000/api/ocr',  // Enable backend OCR
    // openaiKey: 'sk-xxx',                              // Enable OpenAI Vision
  },
};
