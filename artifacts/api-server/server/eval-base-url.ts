export interface EvalBaseUrlInputs {
  flag?: string | undefined;
  env: Readonly<Record<string, string | undefined>>;
}

// Precedence: --base-url flag, EVAL_BASE_URL, then the local API server on PORT
// (default 8080).
// Blank values count as unset.
export function resolveEvalBaseUrl({ flag, env }: EvalBaseUrlInputs): string {
  if (flag) return flag;
  if (env.EVAL_BASE_URL) return env.EVAL_BASE_URL;
  return `http://localhost:${env.PORT || 8080}`;
}
