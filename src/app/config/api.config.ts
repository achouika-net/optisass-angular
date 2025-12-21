import { environment } from 'environments/environment';

export const API_URL = `${environment.apiUrl}`;
export const LOGIN_API_URL = `${API_URL}/client/auth/login`;
export const CLIENTS_API_URL = `${API_URL}/clients`;
export const ROLES_API_URL = `${API_URL}/roles`;
export const USERS_API_URL = `${API_URL}/users`;
export const API_ADDRESS_URL = `${API_URL}/adresse`;
