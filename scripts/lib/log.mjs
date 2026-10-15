/**
 * Shared log vocabulary for build scripts.
 * Uses ANSI colours only on TTYs; respects NO_COLOR.
 * Emits GitHub Actions annotations when GITHUB_ACTIONS is set.
 */
const ghActions = process.env.GITHUB_ACTIONS === "true";
const noColor = process.env.NO_COLOR || ghActions;
const bold = noColor ? (s) => s : (s) => `\x1b[1m${s}\x1b[0m`;
const green = noColor ? (s) => s : (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = noColor ? (s) => s : (s) => `\x1b[33m${s}\x1b[0m`;
const red = noColor ? (s) => s : (s) => `\x1b[31m${s}\x1b[0m`;
const dim = noColor ? (s) => s : (s) => `\x1b[2m${s}\x1b[0m`;

export function ok(message) {
  console.log(`${green("[ok]")} ${message}`);
}

export function warn(message) {
  console.warn(`${yellow("[warn]")} ${message}`);
  if (ghActions) console.log(`::warning::${message}`);
}

export function error(message) {
  console.error(`${red("[error]")} ${message}`);
  if (ghActions) console.log(`::error::${message}`);
}

export function heading(message) {
  console.log(`\n${bold(message)}`);
}

export function command(cmd, args = []) {
  console.log(dim(`$ ${cmd} ${args.join(" ")}`));
}
