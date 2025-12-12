export const DirectionType = {
  LEFT: 'left',
  RIGHT: 'right',
} as const;

export type DirectionTypeValues =
  (typeof DirectionType)[keyof typeof DirectionType];
