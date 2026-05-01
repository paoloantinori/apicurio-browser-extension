import { test, expect } from "./fixtures";
import { GH, EXT, URLS } from "./selectors";
import {
  navigateToSpecFile,
  assertViewerVisible,
  assertViewerGone,
  assertSaveToolbarPresent,
  assertSaveToolbarAbsent,
  assertSaveToolbarStyleInjected,
  assertSaveToolbarStyleRemoved,
  getSaveButtonState,
  getStatusText,
  clickTab,
  waitForApicurioTab,
} from "./helpers";

test.describe("Save toolbar presence and initial state", () => {
  test("save toolbar is injected when viewer is active", async ({ page }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);
    await assertViewerVisible(page);

    await assertSaveToolbarPresent(page);
    await assertSaveToolbarStyleInjected(page);
  });

  test("save button starts in idle state — disabled, text is 'Save'", async ({
    page,
  }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);
    await assertViewerVisible(page);

    const btn = await getSaveButtonState(page);
    expect(btn.text).toBe("Save");
    expect(btn.disabled).toBe(true);
    expect(btn.className).toBe("apicurio-save-btn");
  });

  test("status text is empty in idle state", async ({ page }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);
    await assertViewerVisible(page);

    const statusText = await getStatusText(page);
    expect(statusText).toBe("");
  });

  test("toolbar is positioned inside the viewer container", async ({
    page,
  }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);
    await assertViewerVisible(page);

    const isInsideViewer = await page.evaluate((sel) => {
      const viewer = document.querySelector(sel.VIEWER_CONTAINER);
      const toolbar = document.querySelector(sel.SAVE_TOOLBAR);
      if (!viewer || !toolbar) return false;
      return viewer.contains(toolbar);
    }, { VIEWER_CONTAINER: EXT.VIEWER_CONTAINER, SAVE_TOOLBAR: EXT.SAVE_TOOLBAR });

    expect(isInsideViewer).toBe(true);
  });

  test("toolbar is the first child of the viewer container", async ({
    page,
  }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);
    await assertViewerVisible(page);

    const isFirst = await page.evaluate((sel) => {
      const viewer = document.querySelector(sel.VIEWER_CONTAINER);
      if (!viewer) return false;
      return viewer.firstElementChild?.id === "apicurio-save-toolbar";
    }, { VIEWER_CONTAINER: EXT.VIEWER_CONTAINER });

    expect(isFirst).toBe(true);
  });

  test("toolbar has correct layout structure", async ({ page }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);
    await assertViewerVisible(page);

    const layout = await page.evaluate((sel) => {
      const toolbar = document.querySelector(sel) as HTMLElement | null;
      if (!toolbar) return null;
      const style = window.getComputedStyle(toolbar);
      return {
        display: style.display,
        alignItems: style.alignItems,
        gap: style.gap,
      };
    }, EXT.SAVE_TOOLBAR);

    expect(layout).not.toBeNull();
    expect(layout!.display).toBe("flex");
    expect(layout!.alignItems).toBe("center");
  });

  test("toolbar contains a status text span and a save button", async ({
    page,
  }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);
    await assertViewerVisible(page);

    const children = await page.evaluate((sel) => {
      const toolbar = document.querySelector(sel);
      if (!toolbar) return { spans: 0, buttons: 0 };
      return {
        spans: toolbar.querySelectorAll("span.apicurio-status-text").length,
        buttons: toolbar.querySelectorAll("button.apicurio-save-btn").length,
      };
    }, EXT.SAVE_TOOLBAR);

    expect(children.spans).toBe(1);
    expect(children.buttons).toBe(1);
  });
});

test.describe("Save toolbar lifecycle with tab switching", () => {
  test("toolbar is removed when switching to Code", async ({ page }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);
    await assertViewerVisible(page);
    await assertSaveToolbarPresent(page);

    await clickTab(page, "Code");
    await waitForApicurioTab(page);
    await assertViewerGone(page);

    await assertSaveToolbarAbsent(page);
    await assertSaveToolbarStyleRemoved(page);
  });

  test("toolbar is removed when switching to Blame", async ({ page }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);
    await assertViewerVisible(page);
    await assertSaveToolbarPresent(page);

    await clickTab(page, "Blame");
    await waitForApicurioTab(page);
    await assertViewerGone(page);

    await assertSaveToolbarAbsent(page);
  });

  test("toolbar reappears when switching back to Apicurio", async ({
    page,
  }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);
    await assertViewerVisible(page);
    await assertSaveToolbarPresent(page);

    await clickTab(page, "Code");
    await waitForApicurioTab(page);
    await assertViewerGone(page);
    await assertSaveToolbarAbsent(page);

    await clickTab(page, "Apicurio");
    await assertViewerVisible(page);
    await assertSaveToolbarPresent(page);
    await assertSaveToolbarStyleInjected(page);

    // Toolbar should be in idle state again after re-creation
    const btn = await getSaveButtonState(page);
    expect(btn.text).toBe("Save");
    expect(btn.disabled).toBe(true);
  });

  test("toolbar is removed when navigating to a different file", async ({
    page,
  }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);
    await assertViewerVisible(page);
    await assertSaveToolbarPresent(page);

    await page.goto(URLS.NON_SPEC_FILE, { waitUntil: "domcontentloaded" });

    await assertSaveToolbarAbsent(page);
    await assertSaveToolbarStyleRemoved(page);
  });
});

test.describe("Save toolbar styles", () => {
  test("style block contains expected CSS rules", async ({ page }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);
    await assertViewerVisible(page);
    await assertSaveToolbarStyleInjected(page);

    const styleContent = await page
      .locator(`#${EXT.SAVE_TOOLBAR_STYLE_ID}`)
      .evaluateAll(
        (els) => (els[0] as HTMLStyleElement)?.textContent ?? ""
      );

    expect(styleContent).toContain("#apicurio-save-toolbar");
    expect(styleContent).toContain(".apicurio-save-btn");
    expect(styleContent).toContain(".apicurio-save-btn--primary");
    expect(styleContent).toContain(".apicurio-save-btn--saving");
    expect(styleContent).toContain(".apicurio-save-btn--success");
    expect(styleContent).toContain(".apicurio-save-btn--error");
  });

  test("save button has GitHub-consistent styling", async ({ page }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);
    await assertViewerVisible(page);

    const btnStyles = await page.evaluate((sel) => {
      const toolbar = document.querySelector(sel);
      if (!toolbar) return null;
      const btn = toolbar.querySelector("button") as HTMLElement | null;
      if (!btn) return null;
      const s = window.getComputedStyle(btn);
      return {
        borderRadius: s.borderRadius,
        fontSize: s.fontSize,
        cursor: s.cursor,
      };
    }, EXT.SAVE_TOOLBAR);

    expect(btnStyles).not.toBeNull();
    expect(btnStyles!.borderRadius).toBe("6px");
    expect(btnStyles!.fontSize).toBe("13px");
  });
});

test.describe("Save toolbar without token configured", () => {
  test("save button remains disabled in idle state — no token prompt", async ({
    page,
  }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);
    await assertViewerVisible(page);

    // Without a token, the button stays disabled because the editor
    // hasn't been modified (no onChange fired).
    const btn = await getSaveButtonState(page);
    expect(btn.disabled).toBe(true);
  });

  test("no error messages shown in initial state", async ({ page }) => {
    await navigateToSpecFile(page, URLS.SPEC_FILE);
    await assertViewerVisible(page);

    const statusText = await getStatusText(page);
    expect(statusText).toBe("");

    // Verify no error class on the status text
    const hasErrorClass = await page.evaluate((sel) => {
      const toolbar = document.querySelector(sel);
      if (!toolbar) return false;
      const span = toolbar.querySelector(".apicurio-status-text");
      return span?.classList.contains("apicurio-status-text--error") ?? false;
    }, EXT.SAVE_TOOLBAR);
    expect(hasErrorClass).toBe(false);
  });
});
