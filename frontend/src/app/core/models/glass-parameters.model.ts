export interface GlassIndex {
  id: string;
  value: number;
  label: string;
  price: number;
  materialId: string;
}

export interface GlassMaterial {
  id: string;
  name: string;
  indices: GlassIndex[];
}

export interface GlassBrand {
  id: string;
  name: string;
}

export interface GlassTreatment {
  id: string;
  name: string;
  price: number;
}

export interface GlassParameters {
  brands: GlassBrand[];
  materials: GlassMaterial[];
  treatments: GlassTreatment[];
}
