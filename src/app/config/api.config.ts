import { environment } from 'environments/environment';

export const API_URL = `${environment.apiUrl}`;

// Auth endpoints
export const LOGIN_API_URL = `${API_URL}/client/auth/login`;
export const ME_API_URL = `${API_URL}/client/auth/me`;
export const REFRESH_TOKEN_API_URL = `${API_URL}/client/auth/refresh`;

// Other endpoints
export const CLIENTS_API_URL = `${API_URL}/clients`;
export const ROLES_API_URL = `${API_URL}/roles`;
export const USERS_API_URL = `${API_URL}/client/users`;
export const API_ADDRESS_URL = `${API_URL}/adresse`;
