import { test, expect } from "./fixtures";
import { GH, EXT, URLS } from "./selectors";
import {
  waitForApicurioTab,
  clickTab,
  assertViewerVisible,
  assertViewerGone,
  assertCodeHidden,
  assertCodeVisible,
  assertStyleOverrideRemoved,
  assertActiveClassAbsent,
  navigateToSpecFile,
} from "./helpers";

test.describe("Blame transition edge cases", () => {
  test("code container and line numbers are hidden while viewer is active", async ({
    page,
  }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);
    await assertViewerVisible(page);
    await assertCodeHidden(page);

    const lineNumbersHidden = await page.evaluate((GH_SEL) => {
      const codeContainer = document.querySelector(GH_SEL) as HTMLElement;
      if (!codeContainer?.parentElement) return false;
      const lineNumbers = codeContainer.parentElement.querySelector(
        ".react-line-numbers"
      ) as HTMLElement | null;
      return lineNumbers?.style.display === "none" ?? false;
    }, GH.CODE_CONTAINER);

    expect(lineNumbersHidden).toBe(true);
  });

  test("clicking Code does not auto-reactivate Apicurio", async ({ page }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);
    await assertViewerVisible(page);

    await clickTab(page, "Code");

    await assertViewerGone(page);
    await assertCodeVisible(page);
    await assertStyleOverrideRemoved(page);
    await assertActiveClassAbsent(page);
  });

  test("clicking Blame does not auto-reactivate Apicurio", async ({ page }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);
    await assertViewerVisible(page);

    await clickTab(page, "Blame");

    await assertViewerGone(page);

    // Tab re-injects but does not auto-activate
    await waitForApicurioTab(page);
    const states = await page.evaluate((sel) => {
      const tabList = document.querySelector(sel.TAB_LIST);
      if (!tabList) return [];
      return Array.from(tabList.querySelectorAll("li")).map((li) => ({
        label: li.querySelector("button")?.textContent?.trim() ?? "",
        selected: li.hasAttribute("data-selected"),
      }));
    }, GH);

    const apicurio = states.find((s) => s.label === "Apicurio");
    expect(apicurio).toBeDefined();
    expect(apicurio?.selected).toBe(false);
  });

  test("code container has pointer events disabled when viewer active", async ({
    page,
  }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);
    await assertViewerVisible(page);
    await assertCodeHidden(page);

    const pointerDisabled = await page.evaluate((GH_SEL) => {
      const codeContainer = document.querySelector(GH_SEL) as HTMLElement;
      if (!codeContainer) return false;
      let current = codeContainer.parentElement;
      while (current) {
        if (current.style?.pointerEvents === "none") return true;
        current = current.parentElement;
      }
      return false;
    }, GH.CODE_CONTAINER);
    expect(pointerDisabled).toBe(true);
  });
});
