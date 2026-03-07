export const TypesClient = {
  ALL: -1,
  COMPTE: 2,
  PASSAGE: 1,
} as const;

export type TypeClient = (typeof TypesClient)[keyof typeof TypesClient];
