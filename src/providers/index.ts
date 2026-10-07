/**
 * `@nashiuso/rewap/providers` — explicit adapters for external information.
 *
 * Importing this entry point performs no network access by itself. Requests only
 * happen when the application creates a provider with an endpoint and the
 * matching hook is used.
 */

export * from "./contracts";
export * from "./weather";
export * from "./location";
export * from "./email";
