export function sortByYear<T extends { year: number }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => a.year - b.year);
}
