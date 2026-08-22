export function normalizeContactName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' '); // collapse multiple whitespace
}
