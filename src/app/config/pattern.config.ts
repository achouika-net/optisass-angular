export const NUMERO_FACTURE = '^([f|F|G|g]{1})?[0-9]{1,10}$';
export const ALPHA_NUMERIC = '^$|^[A-Za-z0-9 ]+';
export const NUMERIC = '^[-]?(\\d+(\\.\\d*)?|\\.\\d+)$';
export const IMMAT = '^$|^[A-Za-z0-9. , -- ]+';
export const MOBILE_PATTERN = /^(?!^0+$)((00|\+)[1-9]{2,3}|0)[0-9]([-. ]?[0-9]{2}){4}$/;
export const POSITIVE_INTEGER = '^[0-9]+$';
export const DECIMAL_NUMBER = '^[0-9]+(\\.[0-9])?$';
export const EMAIL_PATTERN = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]{2,}\.[a-zA-Z]{2,7}$/;
export const IP_V4_PATTERN =
  /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
export const PARTIAL_IP_V4_PATTERN =
  /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){0,3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)?$/;
export const ZIPCODE_PATTERN = /^\d{4,5}$/;
