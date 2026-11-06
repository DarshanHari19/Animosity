// Runs a command with variables from the repo-root .env loaded into its environment.
// Usage: node scripts/with-env.mjs <command> [args...]
import { spawn } from "node:child_process";
import "./load-env.mjs";

const [command, ...args] = process.argv.slice(2);
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
