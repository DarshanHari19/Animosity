// `pnpm dev`: runs the API server and the Vite frontend together.
// The two processes need different PORT values, so each gets its own env here
// instead of sharing one loaded .env: API gets PORT=<PORT or 8080>; the frontend
// gets PORT=<WEB_PORT or 5173>, BASE_PATH=/ and API_PORT for the Vite /api proxy.
import "./load-env.mjs";
import { concurrently } from "concurrently";

const apiPort = process.env.PORT || "8080";
const webPort = process.env.WEB_PORT || "5173";

const { result } = concurrently(
  [
    {
      name: "api",
      prefixColor: "blue",
      command: "pnpm --filter @workspace/api-server run dev",
      env: { PORT: apiPort },
    },
    {
      name: "web",
      prefixColor: "green",
      command: "pnpm --filter @workspace/fight-club run dev",
      env: { PORT: webPort, BASE_PATH: "/", API_PORT: apiPort },
    },
  ],
  { killOthersOn: ["failure"], handleInput: false },
);

console.log(`[dev] API http://localhost:${apiPort}  |  web http://localhost:${webPort} (proxies /api to the API)`);
result.then(
  () => process.exit(0),
  () => process.exit(1),
);
