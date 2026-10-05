// Input checks for the sign-in forms. There is no server, so nothing here is "verification":
// it only makes sure the farmer typed a usable Indian mobile number or email and a name.

const DECIMAL_DIGIT = /\p{Nd}/u;
const DECIMAL_DIGITS = /\p{Nd}/gu;
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
// Optional +91 / 91 / 0 prefix, then 10 digits starting with 6–9.
const PHONE_RE = /^(?:\+?91|0)?([6-9]\d{9})$/;

/**
 * Any script's digits → 0–9 ("९८७६", "৯৮৭৬", "੯੮੭੬", "௯௮௭௬", "۹۸۷۶" → "9876"), so every Indian
 * keyboard works. Unicode encodes each script's digits as a contiguous 0–9 run, so a digit's
 * value is its distance from the start of its run (mod 10 for runs that sit back to back).
 */
export function toLatinDigits(s: string): string {
  return s.replace(DECIMAL_DIGITS, d => {
    const c = d.codePointAt(0)!;
    if (c <= 0x39) return d;
    let start = c;
    while (DECIMAL_DIGIT.test(String.fromCodePoint(start - 1))) start--;
    return String((c - start) % 10);
  });
}

export type Contact = { kind: 'phone'; phone: string } | { kind: 'email'; email: string };
export type ContactError = 'empty' | 'phone' | 'email';

/**
 * Parses "98765 43210", "+91-98765-43210", "०९८७६५४३२१०", "৯৮৭৬৫৪৩২১০" or "Naam@Gmail.com".
 * Phones come back as "+91XXXXXXXXXX", emails lower-cased.
 */
export function parseContact(raw: string): { ok: true; value: Contact } | { ok: false; error: ContactError } {
  const s = toLatinDigits(raw).trim();
  if (!s) return { ok: false, error: 'empty' };
  if (s.includes('@') || /\p{L}/u.test(s)) {
    const email = s.toLowerCase();
    return EMAIL_RE.test(email) ? { ok: true, value: { kind: 'email', email } } : { ok: false, error: 'email' };
  }
  const m = PHONE_RE.exec(s.replace(/[\s\-().]/g, ''));
  return m ? { ok: true, value: { kind: 'phone', phone: `+91${m[1]}` } } : { ok: false, error: 'phone' };
}

/** "+919876543210" → "+91 98765 43210" (anything else is returned unchanged). */
export function formatPhone(phone: string): string {
  const m = /^\+91([6-9]\d{4})(\d{5})$/.exec(phone);
  return m ? `+91 ${m[1]} ${m[2]}` : phone;
}

/** Trimmed name with single spaces; null when it has fewer than 2 letters. */
export function cleanName(raw: string): string | null {
  const name = raw.replace(/\s+/g, ' ').trim();
  const letters = name.match(/\p{L}|\p{M}/gu)?.length ?? 0;
  return letters >= 2 ? name : null;
}

/** Name, village or district typed (or spoken) by the farmer, capped to a sane length. */
export function cleanText(raw: string, max = 60): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, max);
}
