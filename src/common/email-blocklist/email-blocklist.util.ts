import { BLOCKED_EMAIL_DOMAINS } from './blocked-email-domains';

const BLOCKED_SET = new Set<string>(BLOCKED_EMAIL_DOMAINS);

export function extractEmailDomain(email: string): string | null {
  const v = (email ?? '').trim();
  const at = v.lastIndexOf('@');
  if (at <= 0 || at === v.length - 1) return null;
  return v
    .slice(at + 1)
    .trim()
    .toLowerCase();
}

export function isBlockedEmailDomain(domain: string): boolean {
  const d = (domain ?? '').trim().toLowerCase();
  if (!d) return false;
  if (BLOCKED_SET.has(d)) return true;

  for (const bad of BLOCKED_SET) {
    if (d.endsWith('.' + bad)) return true;
  }
  return false;
}

export function isBlockedEmail(email: string): boolean {
  const domain = extractEmailDomain(email);
  if (!domain) return false;
  return isBlockedEmailDomain(domain);
}
