import { IOcrConfig } from '@app/models';

/**
 * Environment configuration interface.
 */
export interface IEnvironment {
  production: boolean;
  envName: string;
  defaultLanguage: string;
  appName: string;
  apiUrl: string;
  websocketUrl: string;
  appVersion: string;
  geoapifyApiKey: string;
  ocr: Partial<IOcrConfig>;
}
