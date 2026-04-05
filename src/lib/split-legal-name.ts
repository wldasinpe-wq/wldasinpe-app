/** Splits Ridivi-style full name into two parts for storage (first token / remainder). */
export function splitLegalName(full: string): { firstName: string; lastName: string } {
  const t = full.trim();
  if (!t) {
    return { firstName: '', lastName: '' };
  }
  const i = t.indexOf(' ');
  if (i === -1) {
    return { firstName: t, lastName: '' };
  }
  return {
    firstName: t.slice(0, i).trim(),
    lastName: t.slice(i + 1).trim(),
  };
}
