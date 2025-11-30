export type UserRole = 1 | 2 | 3 | 4;
export const USER_ROLES: Record<UserRole, string> = {
  1: 'employee',
  2: 'manager',
  3: 'admin',
  4: 'superadmin',
} as const;
