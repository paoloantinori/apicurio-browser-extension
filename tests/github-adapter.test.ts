import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GitHubAdapter } from "../src/adapters/github";

// Provide a minimal HTMLElement global so that `instanceof HTMLElement` checks
// in the adapter source code do not throw in the Node.js test environment.
// Stubs that need to pass the check must set their prototype accordingly.
class MinimalHTMLElement {}
(globalThis as any).HTMLElement = MinimalHTMLElement;

/**
 * Creates a stub element with textContent and tagName.
 * If `isHTMLElement` is true, sets the prototype so `instanceof HTMLElement` passes.
 */
function stubElement(tagName: string, textContent?: string, isHTMLElement: boolean = false): any {
  const el: any = {
    tagName: tagName.toUpperCase(),
    textContent: textContent ?? null,
    querySelectorAll: vi.fn().mockReturnValue([]),
  };
  if (isHTMLElement) {
    Object.setPrototypeOf(el, MinimalHTMLElement.prototype);
  }
  return el;
}

function mockDocumentWithSelectorMap(
  selectorMap: Record<string, any>,
  allMap?: Record<string, any[]>
) {
  const qsMock = vi.fn((selector: string) => selectorMap[selector] ?? null);
  const qsaMock = vi.fn((selector: string) => allMap?.[selector] ?? []);

  globalThis.document = {
    querySelector: qsMock,
    querySelectorAll: qsaMock,
  } as any;
}

describe("GitHubAdapter", () => {
  let adapter: GitHubAdapter;
  let savedWindow: any;

  beforeEach(() => {
    adapter = new GitHubAdapter();
    savedWindow = globalThis.window;
  });

  afterEach(() => {
    globalThis.window = savedWindow;
  });

  // ---- isFileView ----

  describe("isFileView()", () => {
    it("returns true when [data-testid='blob-file'] element exists", () => {
      mockDocumentWithSelectorMap({
        '[data-testid="blob-file"]': stubElement("div"),
      });
      expect(adapter.isFileView()).toBe(true);
    });

    it("returns true when .react-code-view element exists", () => {
      mockDocumentWithSelectorMap({
        '[data-testid="blob-file"]': null,
        ".react-code-view": stubElement("div"),
      });
      expect(adapter.isFileView()).toBe(true);
    });

    it("returns true when legacy .Box[itemprop='text'] element exists", () => {
      mockDocumentWithSelectorMap({
        '[data-testid="blob-file"]': null,
        ".react-code-view": null,
        '.Box[itemprop="text"]': stubElement("div"),
      });
      expect(adapter.isFileView()).toBe(true);
    });

    it("returns false when no matching elements", () => {
      mockDocumentWithSelectorMap({
        '[data-testid="blob-file"]': null,
        ".react-code-view": null,
        '.Box[itemprop="text"]': null,
      });
      expect(adapter.isFileView()).toBe(false);
    });
  });

  // ---- getFileName ----

  describe("getFileName()", () => {
    function mockWindowLocation(pathname: string) {
      globalThis.window = {
        location: {
          href: `https://github.com${pathname}`,
          pathname,
        },
      } as any;
    }

    it("extracts filename from URL /owner/repo/blob/main/openapi.json", () => {
      mockDocumentWithSelectorMap({
        '[data-testid="breadcrumbs"]': null,
      });
      mockWindowLocation("/owner/repo/blob/main/openapi.json");

      expect(adapter.getFileName()).toBe("openapi.json");
    });

    it("extracts filename from nested path URL", () => {
      mockDocumentWithSelectorMap({
        '[data-testid="breadcrumbs"]': null,
      });
      mockWindowLocation("/owner/repo/blob/main/docs/api/spec.yaml");

      expect(adapter.getFileName()).toBe("spec.yaml");
    });

    it("returns null for non-blob URLs", () => {
      mockDocumentWithSelectorMap({
        '[data-testid="breadcrumbs"]': null,
      });
      mockWindowLocation("/owner/repo");

      expect(adapter.getFileName()).toBeNull();
    });

    it("extracts filename from breadcrumbs when available", () => {
      const li = stubElement("li", "openapi.json");
      const breadcrumbList = {
        querySelectorAll: vi.fn().mockReturnValue([li]),
      };

      mockDocumentWithSelectorMap({
        '[data-testid="breadcrumbs"]': breadcrumbList,
      });

      expect(adapter.getFileName()).toBe("openapi.json");
    });
  });

  // ---- getFileContent ----

  describe("getFileContent()", () => {
    it("returns null when no code elements exist", () => {
      mockDocumentWithSelectorMap({}, {
        ".react-code-lines .react-code-text": [],
        '[data-testid="code-cell"]': [],
        ".js-file-line-container .js-file-line": [],
      });
      expect(adapter.getFileContent()).toBeNull();
    });

    it("returns text content from react code lines", () => {
      const line1 = stubElement("span", "openapi: '3.0.0'");
      const line2 = stubElement("span", "info:");

      mockDocumentWithSelectorMap({}, {
        ".react-code-lines .react-code-text": [line1, line2],
        '[data-testid="code-cell"]': [],
        ".js-file-line-container .js-file-line": [],
      });
      expect(adapter.getFileContent()).toBe("openapi: '3.0.0'\ninfo:");
    });

    it("returns text content from data-testid code cells", () => {
      const line1 = stubElement("div", 'swagger: "2.0"');

      mockDocumentWithSelectorMap({}, {
        ".react-code-lines .react-code-text": [],
        '[data-testid="code-cell"]': [line1],
        ".js-file-line-container .js-file-line": [],
      });
      expect(adapter.getFileContent()).toBe('swagger: "2.0"');
    });

    it("returns text content from legacy js-file-line elements", () => {
      const line1 = stubElement("td", "paths:");

      mockDocumentWithSelectorMap({}, {
        ".react-code-lines .react-code-text": [],
        '[data-testid="code-cell"]': [],
        ".js-file-line-container .js-file-line": [line1],
      });
      expect(adapter.getFileContent()).toBe("paths:");
    });
  });

  // ---- getToolbarArea ----

  describe("getToolbarArea()", () => {
    it("returns the code-view-header element when found", () => {
      const headerEl = stubElement("div", undefined, true);
      mockDocumentWithSelectorMap({
        '[data-testid="code-view-header"]': headerEl,
        ".Box-header .d-flex": null,
        ".file-actions": null,
      });
      expect(adapter.getToolbarArea()).toBe(headerEl);
    });

    it("returns null when element is not an HTMLElement instance", () => {
      const headerEl = stubElement("div"); // not an HTMLElement
      mockDocumentWithSelectorMap({
        '[data-testid="code-view-header"]': headerEl,
        ".Box-header .d-flex": headerEl,
        ".file-actions": headerEl,
      });
      expect(adapter.getToolbarArea()).toBeNull();
    });

    it("returns null when no toolbar found", () => {
      mockDocumentWithSelectorMap({
        '[data-testid="code-view-header"]': null,
        ".Box-header .d-flex": null,
        ".file-actions": null,
      });
      expect(adapter.getToolbarArea()).toBeNull();
    });
  });

  // ---- getFileExtension ----

  describe("getFileExtension()", () => {
    function mockWindowLocation(pathname: string) {
      globalThis.window = {
        location: {
          href: `https://github.com${pathname}`,
          pathname,
        },
      } as any;
    }

    it("returns 'json' for 'openapi.json'", () => {
      mockDocumentWithSelectorMap({
        '[data-testid="breadcrumbs"]': null,
      });
      mockWindowLocation("/owner/repo/blob/main/openapi.json");

      expect(adapter.getFileExtension()).toBe("json");
    });

    it("returns 'yaml' for 'swagger.yaml'", () => {
      mockDocumentWithSelectorMap({
        '[data-testid="breadcrumbs"]': null,
      });
      mockWindowLocation("/owner/repo/blob/main/swagger.yaml");

      expect(adapter.getFileExtension()).toBe("yaml");
    });

    it("returns null when no filename available", () => {
      mockDocumentWithSelectorMap({
        '[data-testid="breadcrumbs"]': null,
      });
      mockWindowLocation("/owner/repo");

      expect(adapter.getFileExtension()).toBeNull();
    });
  });

  // ---- getCodeContainer ----

  describe("getCodeContainer()", () => {
    it("returns the blob-file element when it is an HTMLElement", () => {
      const el = stubElement("div", undefined, true);
      mockDocumentWithSelectorMap({
        '[data-testid="blob-file"]': el,
        ".react-code-view": null,
        '.Box[itemprop="text"]': null,
      });
      expect(adapter.getCodeContainer()).toBe(el);
    });

    it("returns null when element is not an HTMLElement instance", () => {
      const el = stubElement("div"); // not an HTMLElement
      mockDocumentWithSelectorMap({
        '[data-testid="blob-file"]': el,
        ".react-code-view": el,
        '.Box[itemprop="text"]': el,
      });
      expect(adapter.getCodeContainer()).toBeNull();
    });

    it("returns null when no selectors match at all", () => {
      mockDocumentWithSelectorMap({
        '[data-testid="blob-file"]': null,
        ".react-code-view": null,
        '.Box[itemprop="text"]': null,
      });
      expect(adapter.getCodeContainer()).toBeNull();
    });
  });
});
