// Pure helpers for building external share links.
// Kept side-effect-free so they're trivial to unit test.

export function buildWhatsAppShareUrl(roomCode: string, message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/** Substitute {code} (and any future templated values) into a translated body. */
export function fillShareTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(v);
  }
  return out;
}
