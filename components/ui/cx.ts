/** Joins class names, skipping falsy values (tiny clsx). */
export function cx(...parts: (string | false | null | undefined | 0)[]): string {
  let out = '';
  for (const p of parts) if (p) out += (out ? ' ' : '') + p;
  return out;
}
