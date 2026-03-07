export interface IStockSettings {
  defaultAlertThreshold: number;
  defaultCoefficient: number;
  minCoefficient: number;
  defaultTvaRate: number;
  tvaRateOptions: number[];
  expirationWarningDays: number;
  expirationCriticalDays: number;
  photoMaxSizeMb: number;
  photoAcceptedTypes: string[];
}

export const DEFAULT_STOCK_SETTINGS: IStockSettings = {
  defaultAlertThreshold: 2,
  defaultCoefficient: 2.5,
  minCoefficient: 1,
  defaultTvaRate: 0.2,
  tvaRateOptions: [0, 0.2],
  expirationWarningDays: 30,
  expirationCriticalDays: 7,
  photoMaxSizeMb: 2,
  photoAcceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
};
