/** Practical check for user-entered contact email (not full RFC 5322). */
const CONTACT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeContactEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidContactEmail(raw: string): boolean {
  const s = normalizeContactEmail(raw);
  if (s.length < 5 || s.length > 254) return false;
  return CONTACT_EMAIL_RE.test(s);
}
