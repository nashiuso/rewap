/**
 * `useEmailVerification(email)` — local validation plus optional remote checks.
 *
 * Local validation always runs, always offline, and is synchronous. Remote
 * verification only happens when the application passes a provider, and even then
 * only when `verify()` is called (or `autoVerify` is enabled) — never as a side
 * effect of typing.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  EmailVerificationProvider,
  ProviderOutcome,
  EmailVerificationVerdict,
} from "../providers/contracts";
import { validateEmailLocal, type LocalEmailCheck } from "./email";

export type EmailVerificationStatus =
  | "empty"
  | "invalid"
  | "valid"
  | "verifying"
  | "verified"
  | "rejected"
  | "error";

export interface RemoteVerificationState {
  status:
    "not-configured" | "idle" | "pending" | "verified" | "rejected" | "error";
  provider: string | null;
  endpoint: string | null;
  message: string | null;
  checkedAt: number | null;
  /** Reason remote verification is unavailable, when it is. */
  unsupportedReason: string | null;
}

export interface EmailVerificationResult {
  value: string;
  normalized: string;
  status: EmailVerificationStatus;
  /** True when the local syntax checks pass. Never implies deliverability. */
  valid: boolean;
  local: LocalEmailCheck;
  remote: RemoteVerificationState;
  verify(): Promise<ProviderOutcome<EmailVerificationVerdict> | null>;
  reset(): void;
}

export interface UseEmailVerificationOptions {
  /**
   * Remote verification provider. When omitted, the hook stays local and reports
   * `remote.status === "not-configured"` instead of pretending otherwise.
   */
  provider?: EmailVerificationProvider;
  /** Run remote verification automatically once the address is locally valid. */
  autoVerify?: boolean;
  /** Delay before `autoVerify` runs. Defaults to 600 ms. */
  debounceMs?: number;
}

const idleRemote = (
  provider: EmailVerificationProvider | undefined,
): RemoteVerificationState => ({
  status: provider ? "idle" : "not-configured",
  provider: provider?.name ?? null,
  endpoint: provider?.endpoint ?? null,
  message: null,
  checkedAt: null,
  unsupportedReason: provider
    ? null
    : "No verification provider was supplied, so only local syntax checks run.",
});

export const useEmailVerification = (
  email: string,
  options: UseEmailVerificationOptions = {},
): EmailVerificationResult => {
  const provider = options.provider;
  const local = useMemo(() => validateEmailLocal(email), [email]);
  const [remote, setRemote] = useState<RemoteVerificationState>(() =>
    idleRemote(provider),
  );
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setRemote((previous) =>
      previous.provider === (provider?.name ?? null)
        ? previous
        : idleRemote(provider),
    );
  }, [provider]);

  const verify =
    useCallback(async (): Promise<ProviderOutcome<EmailVerificationVerdict> | null> => {
      if (!provider) {
        setRemote(idleRemote(undefined));
        return null;
      }
      if (!local.valid) {
        setRemote((previous) => ({
          ...previous,
          status: "idle",
          message:
            "The address does not pass local validation, so it was not sent anywhere.",
        }));
        return null;
      }

      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      setRemote((previous) => ({
        ...previous,
        status: "pending",
        message: null,
      }));

      const outcome = await provider.verify({
        email: local.normalized,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return outcome;

      setRemote({
        status:
          outcome.status === "success"
            ? outcome.data.deliverable
              ? "verified"
              : "rejected"
            : outcome.status === "unsupported"
              ? "error"
              : "error",
        provider: provider.name,
        endpoint: provider.endpoint,
        message:
          outcome.status === "success"
            ? outcome.data.message
            : outcome.status === "error"
              ? outcome.message
              : outcome.reason,
        checkedAt: outcome.status === "success" ? outcome.fetchedAt : null,
        unsupportedReason:
          outcome.status === "unsupported" ? outcome.reason : null,
      });

      return outcome;
    }, [local.normalized, local.valid, provider]);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setRemote(idleRemote(provider));
  }, [provider]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  useEffect(() => {
    if (!options.autoVerify || !provider || !local.valid) return;
    const timeout = setTimeout(() => {
      void verify();
    }, options.debounceMs ?? 600);
    return () => clearTimeout(timeout);
  }, [
    local.valid,
    local.normalized,
    options.autoVerify,
    options.debounceMs,
    provider,
    verify,
  ]);

  const status: EmailVerificationStatus =
    local.value.length === 0
      ? "empty"
      : !local.valid
        ? "invalid"
        : remote.status === "pending"
          ? "verifying"
          : remote.status === "verified"
            ? "verified"
            : remote.status === "rejected" || remote.status === "error"
              ? remote.status === "rejected"
                ? "rejected"
                : "error"
              : "valid";

  return {
    value: local.value,
    normalized: local.normalized,
    status,
    valid: local.valid,
    local,
    remote,
    verify,
    reset,
  };
};
