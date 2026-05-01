import { test, expect } from "./fixtures";
import { GH, EXT, URLS } from "./selectors";
import {
  getTabStates,
  clickTab,
  assertViewerVisible,
  assertStyleOverrideInjected,
  assertStyleOverrideRemoved,
  navigateToSpecFile,
} from "./helpers";

test.describe("Tab visual state consistency", () => {
  test("only one tab is selected when Apicurio is active", async ({ page }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);

    // Wait for viewer to be visible (proves full initialization)
    await assertViewerVisible(page);

    // Auto-activated: exactly one tab selected (Apicurio)
    const states = await getTabStates(page);
    expect(states).toHaveLength(3);
    expect(states.filter((s) => s.selected)).toHaveLength(1);
    expect(states.filter((s) => s.ariaCurrent === "true")).toHaveLength(1);
    expect(states[2].selected).toBe(true);
    expect(states[2].label).toBe("Apicurio");
  });

  test("style override is correctly scoped with !important rules", async ({
    page,
  }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);

    // Auto-activated — style override should be present
    await assertStyleOverrideInjected(page);

    const styleContent = await page
      .locator(`#${EXT.STYLE_OVERRIDE_ID}`)
      .evaluateAll(
        (els) => (els[0] as HTMLStyleElement)?.textContent ?? ""
      );

    // Must contain both selectors
    expect(styleContent).toContain("ul.apicurio-active > li:not(:last-child)");
    expect(styleContent).toContain("ul.apicurio-active > li:last-child");

    // Must use !important for all properties
    const importantCount = (styleContent.match(/!important/g) ?? []).length;
    expect(importantCount).toBeGreaterThanOrEqual(3);
  });

  test("MutationObserver prevents React re-render from restoring native tab state", async ({
    page,
  }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);
    await assertViewerVisible(page);

    // Manually inject data-selected on the Code tab (simulating React re-render)
    await page.evaluate((GH_SEL) => {
      const tabList = document.querySelector(GH_SEL);
      const codeTab = tabList?.querySelector("li");
      if (!codeTab) return;
      codeTab.setAttribute("data-selected", "");
      const btn = codeTab.querySelector("button");
      btn?.setAttribute("aria-current", "true");
    }, GH.TAB_LIST);

    // Wait for MutationObserver to remove the attribute
    await page.waitForFunction(
      (GH_SEL) => {
        const tabList = document.querySelector(GH_SEL);
        const codeTab = tabList?.querySelector("li");
        return !codeTab?.hasAttribute("data-selected");
      },
      GH.TAB_LIST,
      { timeout: 5_000 }
    );
  });

  test("no ghost overlays or pointer event issues", async ({ page }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);
    await assertViewerVisible(page);

    // Viewer has pointer-events: auto
    const viewerPointerEvents = await page
      .locator(EXT.VIEWER_CONTAINER)
      .evaluate((el) => (el as HTMLElement).style.pointerEvents);
    expect(viewerPointerEvents).toBe("auto");

    // An ancestor of code container has pointer-events: none
    const hasPointerNone = await page.evaluate((GH_SEL) => {
      const codeContainer = document.querySelector(GH_SEL) as HTMLElement;
      if (!codeContainer) return false;
      let current = codeContainer.parentElement;
      while (current) {
        if (current.style && current.style.pointerEvents === "none") {
          return true;
        }
        current = current.parentElement;
      }
      return false;
    }, GH.CODE_CONTAINER);
    expect(hasPointerNone).toBe(true);
  });
});
