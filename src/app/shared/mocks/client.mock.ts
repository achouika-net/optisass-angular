export interface IClientStatistics {
  actif: number;
  pro: number;
  passage: number;
  inactif: number;
}

export const MOCK_CLIENT_STATISTICS: IClientStatistics = {
  actif: 150,
  pro: 85,
  passage: 42,
  inactif: 23,
};
