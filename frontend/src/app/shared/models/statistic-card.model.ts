export interface IStatisticCardData {
  id?: number;
  class: string;
  value: number;
  label: string;
  icon?: string;
  extras?: IStatisticCardDataExtras[];
}

export interface IStatisticCardDataExtras {
  iconClass: string;
  value: number;
  label: string;
  icon?: string;
  hide?: boolean;
}
