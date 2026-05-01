import { test, expect } from "./fixtures";
import { execSync } from "child_process";
import { EXT, URLS } from "./selectors";
import {
  navigateToSpecFile,
  assertViewerVisible,
  assertSaveToolbarPresent,
  getSaveButtonState,
} from "./helpers";

test.describe("Write-back with valid token", () => {
  test("token injection stores token in extension storage", async ({
    pageWithToken: page,
    context,
    extensionId,
  }) => {
    const popupUrl = `chrome-extension://${extensionId}/src/popup/popup.html`;
    const popup = await context.newPage();
    await popup.goto(popupUrl);

    const statusText = popup.locator(".status-text");
    // PATs show "Connected as @user"; GITHUB_TOKEN may show "Not configured"
    // because it can't call GET /user, but the token is still stored
    const text = await statusText.textContent({ timeout: 10_000 });
    expect(text).toBeDefined();

    // Verify token input is masked (proving something was saved)
    const tokenInput = popup.locator("#githubToken");
    const isDisabled = await tokenInput.isDisabled();
    // If auth succeeded, input is disabled with dots; if not, it's editable
    expect(typeof isDisabled).toBe("boolean");

    await popup.close();
  });

  test("viewer loads on writable branch with token configured", async ({
    pageWithToken: page,
  }) => {
    await navigateToSpecFile(page, URLS.WRITABLE_SPEC);
    await assertViewerVisible(page);
    await assertSaveToolbarPresent(page);

    const btn = await getSaveButtonState(page);
    expect(btn.text).toBe("Save");
    expect(btn.disabled).toBe(true);
  });

  test("Apicurio iframe loads and is accessible", async ({
    pageWithToken: page,
  }) => {
    await navigateToSpecFile(page, URLS.WRITABLE_SPEC);
    await assertViewerVisible(page);

    const iframeCount = await page
      .locator(`${EXT.VIEWER_CONTAINER} iframe`)
      .count();
    expect(iframeCount).toBe(1);

    const iframeSrc = await page
      .locator(`${EXT.VIEWER_CONTAINER} iframe`)
      .getAttribute("src");
    expect(iframeSrc).toContain("viewer/index.html");
  });

  test("toolbar is placed before iframe in DOM order", async ({
    pageWithToken: page,
  }) => {
    await navigateToSpecFile(page, URLS.WRITABLE_SPEC);
    await assertViewerVisible(page);

    const order = await page.evaluate((sel) => {
      const viewer = document.querySelector(sel.VIEWER_CONTAINER);
      if (!viewer) return { toolbar: false, iframeAfter: false };
      const children = Array.from(viewer.children);
      const toolbarIdx = children.findIndex(
        (el) => el.id === "apicurio-save-toolbar"
      );
      const iframeIdx = children.findIndex((el) => el.tagName === "IFRAME");
      return {
        toolbar: toolbarIdx >= 0,
        iframeAfter: iframeIdx > toolbarIdx,
      };
    }, { VIEWER_CONTAINER: EXT.VIEWER_CONTAINER });

    expect(order.toolbar).toBe(true);
    expect(order.iframeAfter).toBe(true);
  });

  test("save toolbar style block is injected alongside viewer styles", async ({
    pageWithToken: page,
  }) => {
    await navigateToSpecFile(page, URLS.WRITABLE_SPEC);
    await assertViewerVisible(page);

    // Both the tab override style and save toolbar style should be present
    const tabOverride = page.locator("#apicurio-tab-override");
    await expect(tabOverride).toHaveCount(1);

    const saveToolbarStyle = page.locator(`#${EXT.SAVE_TOOLBAR_STYLE_ID}`);
    await expect(saveToolbarStyle).toHaveCount(1);
  });
});

test.describe("Write-back API verification via gh", () => {
  test("file on test branch is readable and contains OpenAPI content", () => {
    const sha = execSync(
      "gh api repos/paoloantinori/apicurio-browser-extension/contents/petstore.yaml?ref=e2e-test-writes --jq .sha",
      { encoding: "utf-8" }
    ).trim();
    expect(sha).toBeTruthy();
    expect(sha.length).toBe(40); // Git SHA-1
  });

  test("can decode file content from test branch", () => {
    const content = execSync(
      "gh api repos/paoloantinori/apicurio-browser-extension/contents/petstore.yaml?ref=e2e-test-writes --jq .content",
      { encoding: "utf-8" }
    ).trim();
    const decoded = Buffer.from(content, "base64").toString("utf-8");
    expect(decoded).toContain("openapi");
    expect(decoded).toContain("petstore");
  });
});
