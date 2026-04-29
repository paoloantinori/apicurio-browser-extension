import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GitHubAdapter } from "../src/adapters/github";

// Provide a minimal HTMLElement global so that `instanceof HTMLElement` checks
// in the adapter source code do not throw in the Node.js test environment.
class MinimalHTMLElement {}
(globalThis as any).HTMLElement = MinimalHTMLElement;

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
    it("returns true when [data-testid='code-cell'] exists", () => {
      mockDocumentWithSelectorMap({
        '[data-testid="code-cell"]': stubElement("div"),
      });
      expect(adapter.isFileView()).toBe(true);
    });

    it("returns true when .react-code-lines exists", () => {
      mockDocumentWithSelectorMap({
        '[data-testid="code-cell"]': null,
        ".react-code-lines": stubElement("div"),
      });
      expect(adapter.isFileView()).toBe(true);
    });

    it("returns false when no matching elements", () => {
      mockDocumentWithSelectorMap({
        '[data-testid="code-cell"]': null,
        ".react-code-lines": null,
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

    it("extracts filename from breadcrumbs-filename element", () => {
      mockDocumentWithSelectorMap({
        '[data-testid="breadcrumbs-filename"]': stubElement("span", "openapi.json"),
      });
      expect(adapter.getFileName()).toBe("openapi.json");
    });

    it("falls back to last breadcrumb li when no breadcrumbs-filename", () => {
      const li = stubElement("li", "spec.yaml");
      const breadcrumbList = {
        querySelectorAll: vi.fn().mockReturnValue([li]),
      };

      mockDocumentWithSelectorMap({
        '[data-testid="breadcrumbs-filename"]': null,
        '[data-testid="breadcrumbs"]': breadcrumbList,
      });

      expect(adapter.getFileName()).toBe("spec.yaml");
    });

    it("falls back to URL parsing when no breadcrumbs", () => {
      mockDocumentWithSelectorMap({
        '[data-testid="breadcrumbs-filename"]': null,
        '[data-testid="breadcrumbs"]': null,
      });
      mockWindowLocation("/owner/repo/blob/main/openapi.json");

      expect(adapter.getFileName()).toBe("openapi.json");
    });

    it("extracts filename from nested path URL", () => {
      mockDocumentWithSelectorMap({
        '[data-testid="breadcrumbs-filename"]': null,
        '[data-testid="breadcrumbs"]': null,
      });
      mockWindowLocation("/owner/repo/blob/main/docs/api/spec.yaml");

      expect(adapter.getFileName()).toBe("spec.yaml");
    });

    it("returns null for non-blob URLs", () => {
      mockDocumentWithSelectorMap({
        '[data-testid="breadcrumbs-filename"]': null,
        '[data-testid="breadcrumbs"]': null,
      });
      mockWindowLocation("/owner/repo");

      expect(adapter.getFileName()).toBeNull();
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
    it("returns the react-blob-header-edit-and-raw-actions element when found", () => {
      const el = stubElement("div", undefined, true);
      mockDocumentWithSelectorMap({
        ".react-blob-header-edit-and-raw-actions": el,
        ".react-blob-view-header-sticky": null,
      });
      expect(adapter.getToolbarArea()).toBe(el);
    });

    it("returns null when element is not an HTMLElement instance", () => {
      const el = stubElement("div"); // not an HTMLElement
      mockDocumentWithSelectorMap({
        ".react-blob-header-edit-and-raw-actions": el,
        ".react-blob-view-header-sticky": el,
      });
      expect(adapter.getToolbarArea()).toBeNull();
    });

    it("returns null when no toolbar found", () => {
      mockDocumentWithSelectorMap({
        ".react-blob-header-edit-and-raw-actions": null,
        ".react-blob-view-header-sticky": null,
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
        '[data-testid="breadcrumbs-filename"]': null,
        '[data-testid="breadcrumbs"]': null,
      });
      mockWindowLocation("/owner/repo/blob/main/openapi.json");

      expect(adapter.getFileExtension()).toBe("json");
    });

    it("returns 'yaml' for 'swagger.yaml'", () => {
      mockDocumentWithSelectorMap({
        '[data-testid="breadcrumbs-filename"]': null,
        '[data-testid="breadcrumbs"]': null,
      });
      mockWindowLocation("/owner/repo/blob/main/swagger.yaml");

      expect(adapter.getFileExtension()).toBe("yaml");
    });

    it("returns null when no filename available", () => {
      mockDocumentWithSelectorMap({
        '[data-testid="breadcrumbs-filename"]': null,
        '[data-testid="breadcrumbs"]': null,
      });
      mockWindowLocation("/owner/repo");

      expect(adapter.getFileExtension()).toBeNull();
    });
  });

  // ---- getCodeContainer ----

  describe("getCodeContainer()", () => {
    it("returns .react-code-lines when it is an HTMLElement", () => {
      const el = stubElement("div", undefined, true);
      mockDocumentWithSelectorMap({
        ".react-code-lines": el,
      });
      expect(adapter.getCodeContainer()).toBe(el);
    });

    it("returns code-cell parent when no react-code-lines", () => {
      const parentEl = stubElement("div", undefined, true);
      const codeCell = { ...stubElement("div"), parentElement: parentEl };
      mockDocumentWithSelectorMap({
        ".react-code-lines": null,
        '[data-testid="code-cell"]': codeCell,
      });
      expect(adapter.getCodeContainer()).toBe(parentEl);
    });

    it("returns null when no selectors match at all", () => {
      mockDocumentWithSelectorMap({});
      expect(adapter.getCodeContainer()).toBeNull();
    });
  });

  // ---- getTabContainer ----

  describe("getTabContainer()", () => {
    it("returns the ul[aria-label='File view'] element", () => {
      const ul = stubElement("ul", undefined, true);
      mockDocumentWithSelectorMap({
        'ul[aria-label="File view"]': ul,
      });
      expect(adapter.getTabContainer()).toBe(ul);
    });

    it("returns null when no tab container found", () => {
      mockDocumentWithSelectorMap({});
      expect(adapter.getTabContainer()).toBeNull();
    });
  });

  // ---- getRepoFilePath ----

  describe("getRepoFilePath()", () => {
    it("extracts owner, repo, branch, and filePath from blob URL", () => {
      globalThis.window = {
        location: {
          href: "https://github.com/owner/repo/blob/main/docs/api/spec.yaml",
        },
      } as any;

      expect(adapter.getRepoFilePath()).toEqual({
        owner: "owner",
        repo: "repo",
        branch: "main",
        filePath: "docs/api/spec.yaml",
      });
    });

    it("returns null for non-blob URLs", () => {
      globalThis.window = {
        location: {
          href: "https://github.com/owner/repo",
        },
      } as any;

      expect(adapter.getRepoFilePath()).toBeNull();
    });
  });
});
