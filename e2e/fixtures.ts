import { test as base, chromium, type BrowserContext, type Page } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get a GitHub token: from GH_TOKEN env var (CI) or `gh auth token` (local).
 */
function getGitHubToken(): string {
  const envToken = process.env.GH_TOKEN?.trim();
  if (envToken) return envToken;

  try {
    return execSync("gh auth token", { encoding: "utf-8" }).trim();
  } catch {
    throw new Error(
      "No GitHub token found. Set GH_TOKEN env var or run `gh auth login`."
    );
  }
}

type ExtensionFixtures = {
  context: BrowserContext;
  extensionId: string;
  /**
   * Returns a page that has a GitHub token injected into the extension's
   * storage.  The token is read from GH_TOKEN env var or `gh auth token`.
   * After the test, the token is cleared from extension storage.
   */
  pageWithToken: Page;
};

export const test = base.extend<ExtensionFixtures>({
  context: async ({}, use) => {
    const pathToExtension = path.resolve(__dirname, "..", "dist", "chrome");
    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent("serviceworker");
    }
    const extensionId = serviceWorker.url().split("/")[2];
    await use(extensionId);
  },
  pageWithToken: async ({ context, extensionId, page }, use) => {
    const token = getGitHubToken();

    const popupUrl = `chrome-extension://${extensionId}/src/popup/popup.html`;
    const popup = await context.newPage();
    await popup.goto(popupUrl);

    const tokenInput = popup.locator("#githubToken");
    await tokenInput.fill(token);

    const saveBtn = popup.locator("#saveToken");
    await saveBtn.click();

    // Wait for auth status to confirm connection (PAT shows "Connected as @",
    // GITHUB_TOKEN may fail /user validation but the token is still stored)
    await popup.waitForFunction(
      () => {
        const el = document.querySelector(".status-text");
        const text = el?.textContent ?? "";
        return text.includes("Connected as") || text.includes("Not configured");
      },
      { timeout: 10_000 }
    );

    await popup.close();

    await use(page);

    // Clean up: clear the token from extension storage
    const cleanupPage = await context.newPage();
    await cleanupPage.goto(popupUrl);
    const clearBtn = cleanupPage.locator("#clearToken");
    await clearBtn.click();
    await cleanupPage.close();
  },
});

export const expect = test.expect;
