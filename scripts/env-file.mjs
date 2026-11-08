// Pure .env loader (no side effects on import). Shell variables win over the file.
// Node's parser can fold the next line into a value when a line ends with
// whitespace (`A= ` above `B=x` gives A="B=x"). Such values are dropped with a
// warning that names only the variable, never the value.
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const FOLDED_LINE = /^(export\s+)?[A-Za-z_][A-Za-z0-9_]*=/;

export function loadDotEnv(file, env = process.env, warn = console.warn) {
  let content;
  try { content = readFileSync(file, "utf8"); }
  catch (error) { if (error?.code === "ENOENT") return; throw error; }
  for (const [name, value] of Object.entries(parseEnv(content))) {
    if (name in env) continue;
    if (FOLDED_LINE.test(value)) {
      warn(`.env: ${name} looks like it absorbed the next line (trailing whitespace on its line?). Ignoring ${name}; remove the trailing whitespace in .env.`);
      continue;
    }
    env[name] = value;
  }
}
