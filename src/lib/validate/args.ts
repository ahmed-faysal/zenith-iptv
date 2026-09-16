export type ValidateArgs = {
  // Cap how many *pending* channels this run works through. Undefined = all.
  limit: number | undefined;
  // Discard any existing checkpoint and re-test every channel from scratch.
  fresh: boolean;
};

// CLI flags for `npm run validate`. A full pass takes ~100 minutes, so the two
// flags that matter are `--limit` (a short smoke run) and `--fresh` (ignore the
// checkpoint and re-test everything, e.g. for a periodic full refresh).
export function parseValidateArgs(argv: string[]): ValidateArgs {
  let limit: number | undefined;
  let fresh = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--fresh") { fresh = true; continue; }

    const inline = arg.startsWith("--limit=") ? arg.slice("--limit=".length) : null;
    const separate = arg === "--limit" ? argv[++i] : null;
    const raw = inline ?? separate;
    if (raw === null) continue;

    const n = Number(raw);
    // A silently-ignored bad limit would start a 100-minute run by accident.
    if (!Number.isInteger(n) || n <= 0) {
      throw new Error(`--limit expects a positive integer, got ${JSON.stringify(raw)}`);
    }
    limit = n;
  }

  return { limit, fresh };
}
