import type { Page, Locator } from "@playwright/test";
import { expect } from "./fixtures";
import { GH, EXT } from "./selectors";

/**
 * Wait for the extension to inject the Apicurio tab into the GitHub tab bar.
 * Returns the Apicurio tab's <li> Locator.
 */
export async function waitForApicurioTab(page: Page): Promise<Locator> {
  const tabList = page.locator(GH.TAB_LIST);
  await expect(tabList).toBeVisible({ timeout: 15_000 });

  const apicurioTab = tabList.locator(GH.TAB_ITEM).last();
  await expect(apicurioTab).toContainText("Apicurio", { timeout: 15_000 });
  return apicurioTab;
}

/**
 * Returns the tab list locator. Throws if not found within timeout.
 */
export async function getTabList(page: Page): Promise<Locator> {
  const tabList = page.locator(GH.TAB_LIST);
  await expect(tabList).toBeVisible({ timeout: 15_000 });
  return tabList;
}

/**
 * Returns text labels and selection state of each tab using direct DOM evaluation.
 * More resilient than Playwright locators for rapidly-changing GitHub DOM.
 */
export async function getTabStates(
  page: Page
): Promise<{ label: string; selected: boolean; ariaCurrent: string }[]> {
  return page.evaluate((sel) => {
    const tabList = document.querySelector(sel.TAB_LIST);
    if (!tabList) return [];
    const items = tabList.querySelectorAll("li");
    return Array.from(items).map((li) => {
      const btn = li.querySelector("button");
      return {
        label: (btn?.textContent ?? "").trim(),
        selected: li.hasAttribute("data-selected"),
        ariaCurrent: btn?.getAttribute("aria-current") ?? "false",
      };
    });
  }, GH);
}

/**
 * Click a tab by its label text using direct DOM evaluation.
 */
export async function clickTab(page: Page, label: string): Promise<void> {
  const clicked = await page.evaluate(
    ({ sel, targetLabel }) => {
      const tabList = document.querySelector(sel.TAB_LIST);
      if (!tabList) return false;
      const items = tabList.querySelectorAll("li");
      for (const li of Array.from(items)) {
        const btn = li.querySelector("button");
        if (btn && btn.textContent?.trim() === targetLabel) {
          btn.click();
          return true;
        }
      }
      return false;
    },
    { sel: GH, targetLabel: label }
  );
  if (!clicked) throw new Error(`Tab "${label}" not found in tab list`);
}

/**
 * Assert the Apicurio viewer container is present and visible.
 */
export async function assertViewerVisible(page: Page): Promise<void> {
  const viewer = page.locator(EXT.VIEWER_CONTAINER);
  await expect(viewer).toBeVisible({ timeout: 10_000 });
}

/**
 * Assert the Apicurio viewer container is not in the DOM.
 */
export async function assertViewerGone(page: Page): Promise<void> {
  const viewer = page.locator(EXT.VIEWER_CONTAINER);
  await expect(viewer).toHaveCount(0, { timeout: 5_000 });
}

/**
 * Assert the code container is visible (not hidden).
 */
export async function assertCodeVisible(page: Page): Promise<void> {
  const code = page.locator(GH.CODE_CONTAINER).first();
  await expect(code).toBeVisible({ timeout: 10_000 });
}

/**
 * Assert the code container is hidden (display: none).
 */
export async function assertCodeHidden(page: Page): Promise<void> {
  const code = page.locator(GH.CODE_CONTAINER).first();
  await expect(code).toBeHidden({ timeout: 5_000 });
}

/**
 * Assert the style override is injected in <head>.
 */
export async function assertStyleOverrideInjected(page: Page): Promise<void> {
  const style = page.locator(`#${EXT.STYLE_OVERRIDE_ID}`);
  await expect(style).toHaveCount(1);
}

/**
 * Assert the style override is removed from <head>.
 */
export async function assertStyleOverrideRemoved(page: Page): Promise<void> {
  const style = page.locator(`#${EXT.STYLE_OVERRIDE_ID}`);
  await expect(style).toHaveCount(0);
}

/**
 * Assert the tab list has the apicurio-active class.
 */
export async function assertActiveClassPresent(page: Page): Promise<void> {
  const tabList = page.locator(GH.TAB_LIST);
  await expect(tabList).toHaveClass(new RegExp(EXT.ACTIVE_CLASS));
}

/**
 * Assert the tab list does NOT have the apicurio-active class.
 */
export async function assertActiveClassAbsent(page: Page): Promise<void> {
  const tabList = page.locator(GH.TAB_LIST);
  const cls = (await tabList.getAttribute("class")) ?? "";
  expect(cls).not.toContain(EXT.ACTIVE_CLASS);
}

/**
 * Navigate to the spec file and wait for the extension to initialize.
 * Returns the Apicurio tab Locator.
 */
export async function navigateToSpecFile(
  page: Page,
  url: string
): Promise<Locator> {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  return waitForApicurioTab(page);
}

// ---------------------------------------------------------------------------
// Save toolbar helpers
// ---------------------------------------------------------------------------

/**
 * Assert the save toolbar is present in the DOM.
 */
export async function assertSaveToolbarPresent(page: Page): Promise<void> {
  const toolbar = page.locator(EXT.SAVE_TOOLBAR);
  await expect(toolbar).toHaveCount(1);
}

/**
 * Assert the save toolbar is absent from the DOM.
 */
export async function assertSaveToolbarAbsent(page: Page): Promise<void> {
  const toolbar = page.locator(EXT.SAVE_TOOLBAR);
  await expect(toolbar).toHaveCount(0);
}

/**
 * Assert the save toolbar style block is injected in <head>.
 */
export async function assertSaveToolbarStyleInjected(page: Page): Promise<void> {
  const style = page.locator(`#${EXT.SAVE_TOOLBAR_STYLE_ID}`);
  await expect(style).toHaveCount(1);
}

/**
 * Assert the save toolbar style block is removed.
 */
export async function assertSaveToolbarStyleRemoved(page: Page): Promise<void> {
  const style = page.locator(`#${EXT.SAVE_TOOLBAR_STYLE_ID}`);
  await expect(style).toHaveCount(0);
}

/**
 * Get the save button state via direct DOM evaluation.
 * Returns { text, disabled, className }.
 */
export async function getSaveButtonState(
  page: Page
): Promise<{ text: string; disabled: boolean; className: string }> {
  return page.evaluate((sel) => {
    const toolbar = document.querySelector(sel);
    if (!toolbar) return { text: "", disabled: true, className: "" };
    const btn = toolbar.querySelector("button.apicurio-save-btn");
    return {
      text: btn?.textContent?.trim() ?? "",
      disabled: btn?.disabled ?? true,
      className: btn?.className ?? "",
    };
  }, EXT.SAVE_TOOLBAR);
}

/**
 * Get the status text content from the save toolbar.
 */
export async function getStatusText(page: Page): Promise<string> {
  return page.evaluate((sel) => {
    const toolbar = document.querySelector(sel);
    if (!toolbar) return "";
    const span = toolbar.querySelector(".apicurio-status-text");
    return span?.textContent?.trim() ?? "";
  }, EXT.SAVE_TOOLBAR);
}
