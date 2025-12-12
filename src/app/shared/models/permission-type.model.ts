export const PermissionType = {
  READ: 'read',
  WRITE: 'write',
  IMPORT: 'import',
  EXPORT: 'export',
  ACKNOWLEDGE_COMPTEURS: 'acknowledge_compteurs',
} as const;
export type PermissionTypeValues =
  (typeof PermissionType)[keyof typeof PermissionType];
