// `pnpm screenshots`: full-page PNGs of the picker, the VS screen and How it works
// at phone, tablet and desktop widths, for agents (and people) to check layout.
// Target: --base-url (or --base-url=x), then SCREENSHOT_BASE_URL, then http://localhost:$WEB_PORT
// (default 5173). It does NOT start the dev server; run `pnpm dev` first, or point it at staging.
// Uses the installed system Chrome (playwright-core, channel "chrome"); nothing is downloaded.
//
// SAFETY: this script must NEVER request a verdict, because that triggers a paid model call.
// Clicking "Start the bout" already sends POST /api/fight (narration + Jev), before the VS screen
// shows, so every request whose method is not GET or HEAD (any path) is aborted at the
// browser-context level before any navigation (fail closed), and service workers are blocked.
// The VS screen renders without the fight response. A page.on("request") guard counts every
// such write request; any not matched by an abort (reached = writes - blocked) fails the run.
// The script also never clicks "Ring the bell" (button-ring).
import "./load-env.mjs";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const VIEWPORTS = [
  [360, 640],
  [390, 844],
  [768, 1024],
  [1280, 800],
];
const OUT_DIR = fileURLToPath(new URL("../screenshots/", import.meta.url));

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function baseUrl() {
  const args = process.argv.slice(2);
  let flag;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--base-url") {
      flag = args[i + 1];
      if (flag === undefined || flag === "" || flag.startsWith("--")) die("--base-url needs a value.");
      break;
    }
    if (args[i].startsWith("--base-url=")) {
      flag = args[i].slice("--base-url=".length);
      if (flag === "" || flag.startsWith("--")) die("--base-url needs a value.");
      break;
    }
  }
  const raw = flag || process.env.SCREENSHOT_BASE_URL || `http://localhost:${process.env.WEB_PORT || "5173"}`;
  let url;
  try {
    url = new URL(raw);
  } catch {
    die(`Invalid base URL: ${raw}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") die(`Base URL must be http(s): ${raw}`);
  url.search = "";
  url.hash = "";
  return url.href.replace(/\/+$/, "");
}

const base = baseUrl();
mkdirSync(OUT_DIR, { recursive: true });

let browser;
try {
  browser = await chromium.launch({ channel: "chrome" });
} catch (err) {
  die(`Could not launch system Chrome (install Google Chrome): ${err.message}`);
}

const failures = [];
let blocked = 0;
let writes = 0;

try {
  const probe = await fetch(base, { signal: AbortSignal.timeout(10_000) }).catch((err) => err);
  if (probe instanceof Error || !probe.ok) {
    console.error(
      `Cannot reach ${base} (${probe instanceof Error ? probe.cause?.code || probe.message : probe.status}). ` +
        `Start the frontend (pnpm dev) or pass --base-url / SCREENSHOT_BASE_URL.`,
    );
    process.exitCode = 1;
  } else {
    console.log(`Target: ${base}`);
    console.log("screen             viewport    scrollH  viewH  fits");

    const isWrite = (req) => req.method() !== "GET" && req.method() !== "HEAD";

    const shoot = async (page, screen, [w, h]) => {
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await page.waitForTimeout(800); // let entrance animations and layout settle
      const scrollH = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.screenshot({ path: `${OUT_DIR}${screen}-${w}x${h}.png`, fullPage: true });
      console.log(
        `${screen.padEnd(18)} ${`${w}x${h}`.padEnd(11)} ${String(scrollH).padStart(7)}  ${String(h).padStart(5)}  ${scrollH <= h ? "yes" : "no"}`,
      );
    };

    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp[0], height: vp[1] },
        serviceWorkers: "block",
      });
      try {
        // Block every non-GET/HEAD request before any navigation (see SAFETY above).
        await context.route("**/*", (route) => {
          if (isWrite(route.request())) {
            blocked++;
            return route.abort();
          }
          return route.continue();
        });
        const page = await context.newPage();
        page.on("request", (req) => {
          if (isWrite(req)) writes++;
        });

        await page.goto(base + "/", { waitUntil: "domcontentloaded" });
        await page.getByTestId("select-animal-a").waitFor({ timeout: 20_000 });
        await page.waitForFunction(
          () => document.querySelectorAll("[data-testid=select-animal-a] option").length > 1,
          null,
          { timeout: 20_000 },
        );
        await shoot(page, "picker", vp);

        await page.getByTestId("select-animal-a").selectOption("Hippopotamus");
        await page.getByTestId("select-animal-b").selectOption("Lion");
        await page.getByTestId("button-terrain-land").click();
        await page.getByTestId("mode-forced-fight").click(); // "Arena"
        await page.getByTestId("button-start").click(); // its POST /api/fight is aborted
        await page.getByTestId("stage-vs").waitFor({ timeout: 20_000 });
        await shoot(page, "vs", vp);

        await page.goto(base + "/how-it-works", { waitUntil: "domcontentloaded" });
        await page.getByTestId("text-how-title").waitFor({ timeout: 20_000 });
        await shoot(page, "how-it-works", vp);
      } catch (err) {
        failures.push(`${vp[0]}x${vp[1]}: ${err.message.split("\n")[0]}`);
      } finally {
        await context.close();
      }
    }

    const reached = writes - blocked;
    console.log(`API writes blocked: ${blocked}, reached network: ${reached}`);
    if (reached > 0) {
      failures.push(`${reached} write request(s) reached the network`);
    }
    if (failures.length) {
      console.error("Screenshot run failed:");
      for (const f of failures) console.error(`  - ${f}`);
      process.exitCode = 1;
    } else {
      console.log(`PNGs written to ${OUT_DIR}`);
    }
  }
} catch (err) {
  console.error(`Screenshot run failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
