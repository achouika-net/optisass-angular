export interface IAddress {
  id: string;
  adresse: string;
  suite?: string;
  cp?: string;
  ville?: string;
}

export class Address implements IAddress {
  id: string;
  adresse: string;
  suite?: string;
  cp?: string;
  ville?: string;

  constructor(
    address = '',
    cp = '',
    ville = '',
    suite = '',
    id: string = null
  ) {
    this.id = id;
    this.adresse = address;
    this.cp = cp;
    this.ville = ville;
    this.suite = suite;
  }
}
