export interface IGeoapifyResponse {
  results: IGeoapifyResult[];
}

export interface IGeoapifyResult {
  datasource: {
    sourcename: string;
    attribution: string;
  };
  country: string;
  country_code: string;
  state?: string;
  county?: string;
  city?: string;
  postcode?: string;
  district?: string;
  suburb?: string;
  street?: string;
  housenumber?: string;
  lon: number;
  lat: number;
  formatted: string;
  address_line1: string;
  address_line2: string;
  result_type: string;
  rank: {
    importance: number;
    popularity: number;
    confidence: number;
    confidence_city_level: number;
    match_type: string;
  };
  place_id: string;
}

export interface IAddressOption {
  id: string;
  formatted: string;
  street?: string | null;
  housenumber?: string | null;
  postcode?: string | null;
  city?: string | null;
  country?: string;
  lat?: number;
  lon?: number;
}

/**
 * Convert Geoapify result to simplified address option
 */
export function toAddressOption(result: IGeoapifyResult): IAddressOption {
  return {
    id: result.place_id,
    formatted: result.formatted,
    street: result.street || null,
    housenumber: result.housenumber || null,
    postcode: result.postcode || null,
    city: result.city || null,
    country: result.country,
    lat: result.lat,
    lon: result.lon,
  };
}
