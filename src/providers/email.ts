/**
 * Email verification providers.
 *
 * Verifying an address for real means asking a mail server (SMTP handshake, MX
 * lookup, or a paid API) — none of which a browser can do. The library therefore
 * keeps local syntax validation in the hook (fully offline) and makes remote
 * verification an explicit provider with a mandatory endpoint.
 */

import {
  fetchJson,
  providerError,
  providerSuccess,
  type EmailVerificationProvider,
  type EmailVerificationRequest,
  type EmailVerificationVerdict,
} from "./contracts";

export interface HttpEmailVerificationOptions {
  /** Verification endpoint. Required. */
  endpoint: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  /** Query parameter name when using `GET`. Defaults to `email`. */
  queryParam?: string;
  /** Maps the response body to a verdict. Defaults to a common flat shape. */
  parse?: (body: unknown) => Partial<EmailVerificationVerdict> | null;
  timeoutMs?: number;
}

const defaultParse = (body: unknown): Partial<EmailVerificationVerdict> | null => {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  const rawState = record.state ?? record.status ?? record.result;
  if (typeof rawState !== "string" && typeof record.deliverable !== "boolean") return null;
  const state =
    typeof rawState === "string" ? rawState : record.deliverable ? "deliverable" : "undeliverable";
  const deliverable =
    typeof record.deliverable === "boolean"
      ? record.deliverable
      : ["deliverable", "valid", "ok", "accepted"].includes(state.toLowerCase());
  return {
    deliverable,
    state,
    domainHasMx: typeof record.domain_has_mx === "boolean" ? record.domain_has_mx : null,
    mailboxConfirmed: typeof record.mailbox_confirmed === "boolean" ? record.mailbox_confirmed : null,
    message: typeof record.message === "string" ? record.message : null,
  };
};

/**
 * HTTP verification provider.
 *
 * ```ts
 * const verification = createHttpEmailVerificationProvider({
 *   endpoint: "/api/verify-email",
 *   method: "POST",
 * });
 * ```
 *
 * The endpoint is yours: a route on your own backend that performs the SMTP check.
 * The library never contacts a third-party verification service on its own.
 */
export const createHttpEmailVerificationProvider = (
  options: HttpEmailVerificationOptions,
): EmailVerificationProvider => {
  const parse = options.parse ?? defaultParse;
  const method = options.method ?? "POST";

  return {
    name: "http",
    endpoint: options.endpoint,
    async verify(request: EmailVerificationRequest) {
      if (!options.endpoint) {
        return providerError("No verification endpoint was configured.", { retryable: false });
      }
      try {
        const url =
          method === "GET"
            ? (() => {
                const target = new URL(
                  options.endpoint,
                  typeof location !== "undefined" ? location.href : "http://localhost",
                );
                target.searchParams.set(options.queryParam ?? "email", request.email);
                return target.toString();
              })()
            : options.endpoint;

        const response = await fetchJson(url, {
          method,
          headers: {
            "content-type": "application/json",
            ...options.headers,
          },
          ...(method === "POST" ? { body: JSON.stringify({ email: request.email }) } : {}),
          timeoutMs: options.timeoutMs ?? 10000,
          ...(request.signal ? { signal: request.signal } : {}),
        });

        if (!response.ok) {
          return providerError(`The verification endpoint responded with HTTP ${response.status}.`, {
            httpStatus: response.status,
            retryable: response.status >= 500,
          });
        }

        const parsed = parse(response.data);
        if (!parsed || typeof parsed.deliverable !== "boolean") {
          return providerError("The verification endpoint returned an unexpected payload.", {
            retryable: false,
          });
        }

        const verdict: EmailVerificationVerdict = {
          deliverable: parsed.deliverable,
          state: parsed.state ?? (parsed.deliverable ? "deliverable" : "undeliverable"),
          domainHasMx: parsed.domainHasMx ?? null,
          mailboxConfirmed: parsed.mailboxConfirmed ?? null,
          message: parsed.message ?? null,
        };
        return providerSuccess(verdict, "http");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return providerError("The verification request was aborted.", { retryable: false });
        }
        return providerError(error instanceof Error ? error.message : "The verification request failed.");
      }
    },
  };
};

/**
 * Local, offline "verification" that only reflects what is provable without a
 * network: the address parses as an email address.
 *
 * It is explicit about being limited, which makes it safe to use in tests and in
 * offline demos without ever pretending the mailbox exists.
 */
export const createSyntaxOnlyVerificationProvider = (): EmailVerificationProvider => ({
  name: "syntax-only",
  endpoint: null,
  async verify({ email }: EmailVerificationRequest) {
    return providerSuccess(
      {
        deliverable: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email),
        state: "syntax-only",
        domainHasMx: null,
        mailboxConfirmed: null,
        message:
          "Syntax-only provider: the address format is valid, but nothing about the mailbox was checked.",
      },
      "syntax-only",
    );
  },
});
