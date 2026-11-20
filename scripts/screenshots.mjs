// `pnpm screenshots`: full-page PNGs of the picker, the VS screen and How it works
// at phone, tablet and desktop widths, for agents (and people) to check layout.
// Target: --base-url, then SCREENSHOT_BASE_URL, then http://localhost:$WEB_PORT (default 5173).
// It does NOT start the dev server; run `pnpm dev` first, or point it at staging.
// Uses the installed system Chrome (playwright-core, channel "chrome"); nothing is downloaded.
//
// SAFETY: this script must NEVER click "Ring the bell" (button-ring) or otherwise request a
// verdict. That triggers a paid model call. It stops at the VS screen.
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

function baseUrl() {
  const i = process.argv.indexOf("--base-url");
  const raw =
    (i !== -1 && process.argv[i + 1]) ||
    process.env.SCREENSHOT_BASE_URL ||
    `http://localhost:${process.env.WEB_PORT || "5173"}`;
  return raw.replace(/\/+$/, "");
}

const base = baseUrl();
mkdirSync(OUT_DIR, { recursive: true });

let browser;
try {
  browser = await chromium.launch({ channel: "chrome" });
} catch (err) {
  console.error(`Could not launch system Chrome: ${err.message}`);
  process.exit(1);
}

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

    const shoot = async (page, screen, [w, h]) => {
      await page.waitForTimeout(1500); // let entrance animations settle
      const scrollH = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.screenshot({ path: `${OUT_DIR}${screen}-${w}x${h}.png`, fullPage: true });
      console.log(
        `${screen.padEnd(18)} ${`${w}x${h}`.padEnd(11)} ${String(scrollH).padStart(7)}  ${String(h).padStart(5)}  ${scrollH <= h ? "yes" : "no"}`,
      );
    };

    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp[0], height: vp[1] } });
      const page = await context.newPage();

      await page.goto(base + "/", { waitUntil: "networkidle" });
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
      await page.getByTestId("button-start").click();
      await page.getByTestId("stage-vs").waitFor();
      await shoot(page, "vs", vp);

      await page.goto(base + "/how-it-works", { waitUntil: "networkidle" });
      await page.getByTestId("text-how-title").waitFor();
      await shoot(page, "how-it-works", vp);

      await context.close();
    }
    console.log(`PNGs written to ${OUT_DIR}`);
  }
} catch (err) {
  console.error(`Screenshot run failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
