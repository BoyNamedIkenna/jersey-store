// The API stores and returns money in kobo (integers). Convert only when displaying.
export function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG")}`;
}