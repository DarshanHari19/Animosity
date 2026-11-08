// Runs a command with variables from the repo-root .env loaded into its environment.
// Usage: node scripts/with-env.mjs [--unset NAME,NAME,...] <command> [args...]
// --unset removes the named variables after .env is loaded (and from the shell), so
// the command cannot see them. `pnpm test` uses it to keep paid provider keys out of tests.
import { spawn } from "node:child_process";
import "./load-env.mjs";

let argv = process.argv.slice(2);
if (argv[0] === "--unset") {
  for (const name of (argv[1] ?? "").split(",").filter(Boolean)) delete process.env[name];
  argv = argv.slice(2);
}
const [command, ...args] = argv;
if (!command) {
  console.error("Usage: node scripts/with-env.mjs <command> [args...]");
  process.exit(2);
}

const child = spawn(command, args, { stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error.message);
  process.exit(127);
});
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
