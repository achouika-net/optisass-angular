/* eslint-disable @typescript-eslint/no-explicit-any */
export const flattenOneLevel = (
  obj: Record<string, any>
): Record<string, any> => {
  return Object.fromEntries(
    Object.entries(obj).flatMap(([_, value]) =>
      typeof value === 'object' && value !== null && !Array.isArray(value)
        ? Object.entries(value)
        : [[_, value]]
    )
  );
};
