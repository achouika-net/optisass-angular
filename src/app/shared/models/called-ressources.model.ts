export interface ICalledRessources {
  marques: boolean;
  taxes: boolean;
  appointmentStatus: boolean;
  promotionTypes: boolean;
}

export class CalledRessources implements ICalledRessources {
  marques: boolean;
  taxes: boolean;
  appointmentStatus: boolean;
  promotionTypes: boolean;
  constructor() {
    this.marques = false;
    this.taxes = false;
    this.appointmentStatus = false;
    this.promotionTypes = false;
  }
}
