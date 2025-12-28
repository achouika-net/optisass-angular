export interface IClientSearch {
  nom: string;
  prenom: string;
  entreprise: string;
  actif: number;
  is_export?: boolean;
}

export class ClientSearch implements IClientSearch {
  constructor(
    public nom: string = null,
    public prenom: string = null,
    public entreprise: string = null,
    public actif: number = -1
  ) {}
}
