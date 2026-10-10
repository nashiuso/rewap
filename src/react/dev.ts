/**
 * Development-only warnings.
 *
 * Warnings are emitted once per unique message and are stripped from production
 * bundles by the `process.env.NODE_ENV` guard. Nothing here throws: a mistake in
 * development should explain itself, not break a layout at runtime.
 */

const seen = new Set<string>();

/**
 * Bundlers replace `process.env.NODE_ENV` at build time. The declaration keeps
 * this file independent of `@types/node`, which a browser library should not
 * require.
 */
declare const process: { env?: { NODE_ENV?: string } } | undefined;

const isDevelopment = (): boolean => {
  if (typeof process === "undefined" || !process.env) return true;
  return process.env.NODE_ENV !== "production";
};

export const warnOnce = (message: string): void => {
  if (!isDevelopment() || seen.has(message)) return;
  seen.add(message);
  console.warn(`[@nashiuso/rewap] ${message}`);
};

/** Clears the "warn once" cache. Exposed for tests. */
export const resetWarnings = (): void => {
  seen.clear();
};

export const warnDuplicateIds = (ids: readonly string[]): void => {
  const seenIds = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seenIds.has(id)) duplicates.add(id);
    else seenIds.add(id);
  }
  if (duplicates.size > 0) {
    warnOnce(
      `Duplicate item ids found: ${[...duplicates].join(", ")}. Ids must be unique inside a <Layout>.`,
    );
  }
};

export const warnItemsWithoutChildren = (
  hasItems: boolean,
  idCount: number,
): void => {
  if (hasItems && idCount === 0) {
    warnOnce(
      "The `items` prop was provided without matching <Item id> children, so there is nothing to order.",
    );
  }
};

export const warnPersistenceControlled = (
  enabled: boolean,
  controlled: boolean,
): void => {
  if (enabled && controlled) {
    warnOnce(
      "Persistence is ignored while `items` is controlled: store the order yourself or use `defaultItems`.",
    );
  }
};
