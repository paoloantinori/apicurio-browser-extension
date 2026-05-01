import { test, expect } from "./fixtures";
import { GH, EXT, URLS } from "./selectors";
import {
  waitForApicurioTab,
  getTabStates,
  clickTab,
  assertViewerVisible,
  assertViewerGone,
  assertCodeVisible,
  assertCodeHidden,
  assertStyleOverrideInjected,
  assertStyleOverrideRemoved,
  assertActiveClassPresent,
  assertActiveClassAbsent,
  navigateToSpecFile,
} from "./helpers";

test.describe("Tab switching on GitHub", () => {
  test("injects Apicurio tab and auto-activates on spec file", async ({
    page,
  }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);

    const tabItems = page.locator(GH.TAB_LIST).locator(GH.TAB_ITEM);
    await expect(tabItems).toHaveCount(3);

    const states = await getTabStates(page);
    expect(states.map((s) => s.label)).toEqual(["Code", "Blame", "Apicurio"]);

    expect(states[2].selected).toBe(true);
    expect(states[2].ariaCurrent).toBe("true");
    expect(states[0].selected).toBe(false);
    expect(states[1].selected).toBe(false);

    await assertViewerVisible(page);
    await assertActiveClassPresent(page);
    await assertStyleOverrideInjected(page);
  });

  test("does not inject Apicurio tab on non-spec file", async ({ page }) => {
    await page.goto(URLS.NON_SPEC_FILE, { waitUntil: "domcontentloaded" });

    const tabList = page.locator(GH.TAB_LIST);
    await expect(tabList).toBeVisible({ timeout: 15_000 });

    const tabItems = tabList.locator(GH.TAB_ITEM);
    await expect(tabItems).toHaveCount(2);

    const states = await getTabStates(page);
    expect(states.map((s) => s.label)).toEqual(["Code", "Blame"]);
  });

  test("click Code from Apicurio deactivates and stays on Code", async ({
    page,
  }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);
    await assertViewerVisible(page);

    await clickTab(page, "Code");

    // Wait for re-initialization to complete (tab re-injected, viewer not auto-activated)
    await waitForApicurioTab(page);
    await assertViewerGone(page);
    await assertCodeVisible(page);
    await assertStyleOverrideRemoved(page);
    await assertActiveClassAbsent(page);

    const states = await getTabStates(page);
    const codeTab = states.find((s) => s.label === "Code");
    expect(codeTab?.selected).toBe(true);
  });

  test("click Blame from Apicurio deactivates and stays on Blame", async ({
    page,
  }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);
    await assertViewerVisible(page);

    await clickTab(page, "Blame");

    await waitForApicurioTab(page);
    await assertViewerGone(page);

    const states = await getTabStates(page);
    const blameTab = states.find((s) => s.label === "Blame");
    expect(blameTab?.selected).toBe(true);
  });

  test("click Apicurio reactivates the viewer after switching to Code", async ({
    page,
  }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);
    await assertViewerVisible(page);

    await clickTab(page, "Code");
    await waitForApicurioTab(page);
    await assertViewerGone(page);
    await assertCodeVisible(page);

    await clickTab(page, "Apicurio");
    await assertViewerVisible(page);
    await assertCodeHidden(page);
    await assertActiveClassPresent(page);
    await assertStyleOverrideInjected(page);

    const states = await getTabStates(page);
    expect(states.find((s) => s.label === "Apicurio")?.selected).toBe(true);
  });

  test("full cycle: Apicurio → Code → Apicurio → Blame → Apicurio", async ({
    page,
  }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);
    await assertViewerVisible(page);

    await clickTab(page, "Code");
    await waitForApicurioTab(page);
    await assertViewerGone(page);
    await assertCodeVisible(page);

    await clickTab(page, "Apicurio");
    await assertViewerVisible(page);

    await clickTab(page, "Blame");
    await waitForApicurioTab(page);
    await assertViewerGone(page);

    // Wait for the extension's click handler to be wired on the re-injected tab
    await page.waitForTimeout(500);
    await clickTab(page, "Apicurio");
    await assertViewerVisible(page);

    await expect(page.locator(EXT.VIEWER_CONTAINER)).toHaveCount(1);
  });

  test("viewer has correct styling and layout", async ({ page }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);

    const viewerStyles = await page
      .locator(EXT.VIEWER_CONTAINER)
      .evaluate((el) => {
        const s = (el as HTMLElement).style;
        return {
          width: s.width,
          minHeight: s.minHeight,
          position: s.position,
          zIndex: s.zIndex,
          pointerEvents: s.pointerEvents,
        };
      });

    expect(viewerStyles.width).toBe("100%");
    expect(viewerStyles.minHeight).toBe("500px");
    expect(viewerStyles.position).toBe("relative");
    expect(viewerStyles.zIndex).toBe("10");
    expect(viewerStyles.pointerEvents).toBe("auto");
  });

  test("no duplicate viewer iframes exist", async ({ page }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);
    await expect(page.locator(EXT.VIEWER_CONTAINER)).toHaveCount(1);
    const iframe = page.locator(`${EXT.VIEWER_CONTAINER} iframe`);
    await expect(iframe).toHaveCount(1);
  });

  test("viewer is removed when navigating to a different file", async ({
    page,
  }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);
    await assertViewerVisible(page);

    await page.goto(URLS.NON_SPEC_FILE, { waitUntil: "domcontentloaded" });

    await expect(page.locator(EXT.VIEWER_CONTAINER)).toHaveCount(0, {
      timeout: 10_000,
    });
    await assertStyleOverrideRemoved(page);
  });
});
