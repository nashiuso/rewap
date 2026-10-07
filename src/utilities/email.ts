/**
 * Local email validation.
 *
 * Fully offline and deterministic. It deliberately checks *syntax* and a few
 * well-known traps, and it never claims to know whether a mailbox exists: only a
 * mail server can answer that, which is why remote verification is a separate,
 * explicit provider.
 */

export type CheckSeverity = "error" | "warning" | "info";

export interface EmailCheck {
  id: string;
  label: string;
  passed: boolean;
  severity: CheckSeverity;
  detail?: string;
}

export interface LocalEmailCheck {
  value: string;
  /** Lower-cased, trimmed form (the domain is case-insensitive, so it is folded). */
  normalized: string;
  localPart: string;
  domain: string;
  /** True when every check of severity `error` passed. */
  valid: boolean;
  checks: EmailCheck[];
  errors: string[];
  warnings: string[];
  /** Suggested corrections for a mistyped domain, e.g. `gmial.com` → `gmail.com`. */
  suggestions: string[];
  /** True when the domain is on the bundled disposable-domain list. */
  disposable: boolean;
  /** True when the address contains non-ASCII characters (valid under SMTPUTF8). */
  unicode: boolean;
}

/** Popular domains used only to *suggest* a correction; never to reject an address. */
export const popularDomains = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.co.uk",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "gmx.de",
  "fastmail.com",
  "zoho.com",
  "aol.com",
  "qq.com",
  "163.com",
  "yandex.com",
  "tutanota.com",
  "hey.com",
];

/**
 * A short, non-exhaustive list of disposable domains.
 *
 * It is intentionally small and documented as such: a real disposable-domain list
 * is thousands of entries long and changes weekly, so treat a hit as a warning,
 * never as proof.
 */
export const disposableDomains = [
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "sharklasers.com",
  "trashmail.com",
  "getnada.com",
  "dispostable.com",
  "fakeinbox.com",
  "maildrop.cc",
  "mohmal.com",
  "emailondeck.com",
];

export const isDisposableDomain = (domain: string): boolean =>
  disposableDomains.includes(domain.toLowerCase());

/** Classic Levenshtein distance, iterative and O(min(a, b)) in memory. */
export const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = new Array<number>(b.length + 1);
  let current = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) previous[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const deletion = (previous[j] ?? 0) + 1;
      const insertion = (current[j - 1] ?? 0) + 1;
      const substitution = (previous[j - 1] ?? 0) + cost;
      current[j] = Math.min(deletion, insertion, substitution);
    }
    const swap = previous;
    previous = current;
    current = swap;
  }

  return previous[b.length] ?? 0;
};

/**
 * Suggests the closest popular domain within an edit distance of two.
 * Purely advisory — a domain that is not in the list is never rejected.
 */
export const suggestDomain = (domain: string): string | null => {
  const normalized = domain.toLowerCase();
  if (popularDomains.includes(normalized)) return null;
  // Only correct obvious slips: a short-ish domain one or two edits away.
  if (normalized.length < 6) return null;
  let best: string | null = null;
  let bestDistance = 3;
  for (const candidate of popularDomains) {
    if (Math.abs(candidate.length - normalized.length) > 2) continue;
    const distance = levenshtein(normalized, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return bestDistance <= 2 ? best : null;
};

const localPartPattern = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const domainLabelPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;
/**
 * True when the string is plain ASCII.
 *
 * Written as a scan rather than a negated control-character range: the range
 * works, but a regex containing control characters is hard to read and trips
 * linters for good reason.
 */
const isAscii = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) > 0x7f) return false;
  }
  return true;
};

/**
 * Validates an address locally.
 *
 * Rules follow the practical subset of RFC 5322 (dot-atom local part, DNS-style
 * domain with at least one dot and an alphabetic TLD) and add warnings for the
 * two traps people actually hit: disposable domains and near-miss domain typos.
 */
// NOTE(nashiuso): everything in this file is offline and stays offline. No MX
// lookup, no SMTP probe, no third-party API. Anything that claims more than "this
// parses and the domain is not obviously a typo" belongs in a provider.
export const validateEmailLocal = (value: string): LocalEmailCheck => {
  const trimmed = value.trim();
  const atIndex = trimmed.lastIndexOf("@");
  const hasSingleAt = trimmed.indexOf("@") === atIndex && atIndex > 0;
  const localPart = atIndex > 0 ? trimmed.slice(0, atIndex) : trimmed;
  const domain = atIndex > 0 ? trimmed.slice(atIndex + 1) : "";
  const normalizedDomain = domain.toLowerCase();
  const normalized = `${localPart}@${normalizedDomain}`;

  const labels = normalizedDomain.length > 0 ? normalizedDomain.split(".") : [];
  const tld = labels.length > 1 ? (labels[labels.length - 1] ?? "") : "";
  const hasWhitespace = /\s/.test(trimmed);
  const unicode = !isAscii(trimmed);
  const suggestion = suggestDomain(normalizedDomain);

  const checks: EmailCheck[] = [
    {
      id: "non-empty",
      label: "An address was entered",
      passed: trimmed.length > 0,
      severity: "error",
    },
    {
      id: "no-whitespace",
      label: "No spaces inside the address",
      passed: trimmed.length > 0 && !hasWhitespace,
      severity: "error",
    },
    {
      id: "single-at",
      label: "Exactly one @ with a local part before it",
      passed: hasSingleAt,
      severity: "error",
    },
    {
      id: "local-part",
      label: "The part before @ uses valid characters",
      passed: localPart.length > 0 && (unicode ? true : localPartPattern.test(localPart)),
      severity: "error",
      ...(localPart.length > 0 && !unicode && !localPartPattern.test(localPart)
        ? {
            detail:
              "Letters, digits and . ! # $ % & ' * + / = ? ^ _ ` { | } ~ - are allowed; dots cannot lead, trail or repeat.",
          }
        : {}),
    },
    {
      id: "local-length",
      label: "The part before @ is at most 64 characters",
      passed: localPart.length > 0 && localPart.length <= 64,
      severity: "error",
    },
    {
      id: "local-dots",
      label: "No leading, trailing or doubled dots",
      passed:
        localPart.length > 0 &&
        !localPart.startsWith(".") &&
        !localPart.endsWith(".") &&
        !localPart.includes(".."),
      severity: "error",
    },
    {
      id: "domain-present",
      label: "A domain follows the @",
      passed: normalizedDomain.length > 0,
      severity: "error",
    },
    {
      id: "domain-labels",
      label: "Every domain label is 1–63 characters without leading or trailing hyphens",
      passed:
        labels.length > 0 &&
        labels.every((label) => label.length > 0 && label.length <= 63 && domainLabelPattern.test(label)),
      severity: "error",
    },
    {
      id: "domain-dot",
      label: "The domain contains a dot",
      passed: labels.length >= 2,
      severity: "error",
    },
    {
      id: "tld",
      label: "The top-level domain is at least two letters",
      passed: /^[A-Za-z]{2,}$/.test(tld),
      severity: "error",
    },
    {
      id: "total-length",
      label: "The whole address is at most 254 characters",
      passed: trimmed.length > 0 && trimmed.length <= 254,
      severity: "error",
    },
    {
      id: "not-disposable",
      label: "The domain is not a known disposable provider",
      passed: !isDisposableDomain(normalizedDomain),
      severity: "warning",
      ...(isDisposableDomain(normalizedDomain)
        ? { detail: "This domain appears on a short list of throwaway providers." }
        : {}),
    },
    {
      id: "ascii",
      label: "The address uses ASCII characters",
      passed: !unicode,
      severity: "info",
      ...(unicode
        ? { detail: "Non-ASCII addresses are valid under SMTPUTF8 but many systems still reject them." }
        : {}),
    },
  ];

  return {
    value: trimmed,
    normalized,
    localPart,
    domain: normalizedDomain,
    valid: checks.filter((check) => check.severity === "error").every((check) => check.passed),
    checks,
    errors: checks.filter((check) => check.severity === "error" && !check.passed).map((check) => check.id),
    warnings: checks
      .filter((check) => check.severity === "warning" && !check.passed)
      .map((check) => check.id),
    suggestions: suggestion ? [`${localPart}@${suggestion}`] : [],
    disposable: isDisposableDomain(normalizedDomain),
    unicode,
  };
};
