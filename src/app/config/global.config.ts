export const CRYPT_KEY = 'SomeRondomKey';
export const BACKGROUND_IMAGE_REFRESH = 15000; //15s';
export const PASSWORD_MIN_LENGTH = 12;
export const MAX_HISTORY = 50;
export const PING_INTERVAL = 15000;
export const LOCAL_STORAGE_KEYS = {
  STORE: {
    SETTINGS: 'OPT-APP-SETTINGS',
    AUTH: 'OPT-AUTH-TOKEN',
    RESET_PASSWORD_RETRY_TIMER: 'OPT-RESET-PASSWORD-RETRY-TIMER',
  },
  APP: {
    SESSION_ID: 'OPT-APP-SESSIONID',
    NAVIGATION_HISTORY: 'OPT-APP-NAVIGATION-HISTORY',
  },
  WSS_CHANNELS: 'OPT-WSS-CHANNELS',
  DOWNLOAD: {
    WEBSOCKET: 'OPT-DOWNLOAD-WEBSOCKET',
  },
} as const;

export const ALL_DATA_PAGINATION = `page=0&per_page=-1`;
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS: number[] = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
// Prendre par défaut la valeur minimal
export const MIN_PAGE_SIZE_OPTIONS = Math.min(...PAGE_SIZE_OPTIONS);
export const MIN_LENGTH_SEARCH = 3;

export const FILTER_ALL_YES_NO_OPTIONS = [
  { value: null, label: 'commun.all' },
  { value: true, label: 'commun.yes' },
  { value: false, label: 'commun.no' },
];
// Récupérer les années de l'année donnée en param à l'année en cours.
export const yearsFrom = (year: number) =>
  [...Array(new Date().getFullYear() - (year - 1)).keys()].map((e: number) => e + year).reverse();
