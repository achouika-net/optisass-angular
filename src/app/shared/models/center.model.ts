export interface ICenter {
  id: string;        // UUID (backend NestJS)
  name: string;
  dbSchema: string;
}

// Alias pour la cohérence avec le backend
export type ITenant = ICenter;
