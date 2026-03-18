export function sortByYear<T extends { year: number }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => a.year - b.year);
}

export function shuffle<T>(array: T[]): T[] {
  const b = [...array];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
