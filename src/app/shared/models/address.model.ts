export type AddressField = 'street' | 'streetLine2' | 'postcode' | 'city';

export interface IAddress {
  street: string | null;
  streetLine2?: string | null;
  postcode: string | null;
  city: string | null;
  country?: string | null;
  lat?: number | null;
  lon?: number | null;
}

/**
 * Creates an empty address object
 * @returns Empty IAddress with null values
 */
export function createEmptyAddress(): IAddress {
  return {
    street: null,
    streetLine2: null,
    postcode: null,
    city: null,
    country: null,
    lat: null,
    lon: null,
  };
}

/**
 * Formats an address object into a single line string
 * @param address - The address object to format
 * @returns Formatted address string or empty string if no address
 */
export function formatAddress(address: IAddress | null): string {
  if (!address) return '';

  const parts: string[] = [];

  if (address.street) {
    parts.push(address.street);
  }
  if (address.streetLine2) {
    parts.push(address.streetLine2);
  }
  if (address.postcode || address.city) {
    const cityPart = [address.postcode, address.city].filter(Boolean).join(' ');
    parts.push(cityPart);
  }
  if (address.country) {
    parts.push(address.country);
  }

  return parts.join(', ');
}
