import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GitLabAdapter } from "../src/adapters/gitlab";

function stubElement(tagName: string, textContent?: string): any {
  return {
    tagName: tagName.toUpperCase(),
    textContent: textContent ?? null,
  };
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

describe("GitLabAdapter", () => {
  let adapter: GitLabAdapter;
  let savedWindow: any;

  beforeEach(() => {
    adapter = new GitLabAdapter();
    savedWindow = globalThis.window;
  });

  afterEach(() => {
    globalThis.window = savedWindow;
  });

  // ---- isFileView ----

  describe("isFileView()", () => {
    it("returns true when .file-content exists", () => {
      mockDocumentWithSelectorMap({
        ".file-content": stubElement("div"),
      });
      expect(adapter.isFileView()).toBe(true);
    });

    it("returns true when [data-testid='file-content'] exists", () => {
      mockDocumentWithSelectorMap({
        ".file-content": null,
        '[data-testid="file-content"]': stubElement("div"),
      });
      expect(adapter.isFileView()).toBe(true);
    });

    it("returns true when .blob-content exists", () => {
      mockDocumentWithSelectorMap({
        ".file-content": null,
        '[data-testid="file-content"]': null,
        ".blob-content": stubElement("div"),
      });
      expect(adapter.isFileView()).toBe(true);
    });

    it("returns false when no matching elements", () => {
      mockDocumentWithSelectorMap({
        ".file-content": null,
        '[data-testid="file-content"]': null,
        ".blob-content": null,
      });
      expect(adapter.isFileView()).toBe(false);
    });
  });

  // ---- getFileName ----

  describe("getFileName()", () => {
    function mockWindowLocation(href: string) {
      globalThis.window = {
        location: { href },
      } as any;
    }

    it("extracts filename from breadcrumb", () => {
      const anchor = stubElement("a", "openapi.yaml");
      mockDocumentWithSelectorMap({
        ".breadcrumb-item-last a": anchor,
      });
      expect(adapter.getFileName()).toBe("openapi.yaml");
    });

    it("extracts filename from URL /-/blob/main/openapi.yaml", () => {
      mockDocumentWithSelectorMap({
        ".breadcrumb-item-last a": null,
      });
      mockWindowLocation("https://gitlab.com/owner/repo/-/blob/main/openapi.yaml");

      expect(adapter.getFileName()).toBe("openapi.yaml");
    });

    it("extracts filename from URL with nested path", () => {
      mockDocumentWithSelectorMap({
        ".breadcrumb-item-last a": null,
      });
      mockWindowLocation("https://gitlab.com/owner/repo/-/blob/main/docs/api/spec.yml");

      expect(adapter.getFileName()).toBe("spec.yml");
    });

    it("returns null for non-blob URLs", () => {
      mockDocumentWithSelectorMap({
        ".breadcrumb-item-last a": null,
      });
      mockWindowLocation("https://gitlab.com/owner/repo");

      expect(adapter.getFileName()).toBeNull();
    });
  });

  // ---- getFileContent ----

  describe("getFileContent()", () => {
    it("extracts text from .file-content pre", () => {
      const pre = stubElement("pre", "openapi: '3.0.0'\ninfo:\n  title: Test");
      mockDocumentWithSelectorMap({
        ".file-content pre": pre,
      });

      expect(adapter.getFileContent()).toBe("openapi: '3.0.0'\ninfo:\n  title: Test");
    });

    it("extracts text from .blob-content pre code fallback", () => {
      const code = stubElement("code", "swagger: '2.0'");
      mockDocumentWithSelectorMap({
        ".file-content pre": null,
        ".blob-content pre code": code,
      });

      expect(adapter.getFileContent()).toBe("swagger: '2.0'");
    });

    it("extracts text from .file-content code as third fallback", () => {
      const code = stubElement("code", "openapi: '3.1.0'");
      mockDocumentWithSelectorMap({
        ".file-content pre": null,
        ".blob-content pre code": null,
        ".file-content code": code,
      });

      expect(adapter.getFileContent()).toBe("openapi: '3.1.0'");
    });

    it("returns null when no content elements found", () => {
      mockDocumentWithSelectorMap({
        ".file-content pre": null,
        ".blob-content pre code": null,
        ".file-content code": null,
      });

      expect(adapter.getFileContent()).toBeNull();
    });
  });

  // ---- getToolbarArea ----

  describe("getToolbarArea()", () => {
    it("returns the file-actions element when found", () => {
      const el = stubElement("div");
      mockDocumentWithSelectorMap({
        ".file-actions": el,
      });
      // GitLab adapter does not use instanceof HTMLElement for getToolbarArea
      expect(adapter.getToolbarArea()).toBe(el);
    });

    it("returns js-file-title element as fallback", () => {
      const el = stubElement("div");
      mockDocumentWithSelectorMap({
        ".file-actions": null,
        ".js-file-title": el,
      });
      expect(adapter.getToolbarArea()).toBe(el);
    });

    it("returns null when no selectors match", () => {
      mockDocumentWithSelectorMap({
        ".file-actions": null,
        ".js-file-title": null,
        ".file-title": null,
      });
      expect(adapter.getToolbarArea()).toBeNull();
    });
  });

  // ---- getFileExtension ----

  describe("getFileExtension()", () => {
    it("returns 'yaml' for 'openapi.yaml'", () => {
      const anchor = stubElement("a", "openapi.yaml");
      mockDocumentWithSelectorMap({
        ".breadcrumb-item-last a": anchor,
      });
      expect(adapter.getFileExtension()).toBe("yaml");
    });

    it("returns 'yml' for 'api-spec.yml'", () => {
      const anchor = stubElement("a", "api-spec.yml");
      mockDocumentWithSelectorMap({
        ".breadcrumb-item-last a": anchor,
      });
      expect(adapter.getFileExtension()).toBe("yml");
    });

    it("returns null when no filename available", () => {
      mockDocumentWithSelectorMap({
        ".breadcrumb-item-last a": null,
      });
      globalThis.window = {
        location: { href: "https://gitlab.com/owner/repo" },
      } as any;

      expect(adapter.getFileExtension()).toBeNull();
    });
  });

  // ---- getCodeContainer ----

  describe("getCodeContainer()", () => {
    it("returns .file-content when present", () => {
      const el = stubElement("div");
      mockDocumentWithSelectorMap({
        ".file-content": el,
      });
      // GitLab adapter does not use instanceof HTMLElement for getCodeContainer
      expect(adapter.getCodeContainer()).toBe(el);
    });

    it("returns .blob-content as fallback", () => {
      const el = stubElement("div");
      mockDocumentWithSelectorMap({
        ".file-content": null,
        ".blob-content": el,
      });
      expect(adapter.getCodeContainer()).toBe(el);
    });

    it("returns null when no selectors match at all", () => {
      mockDocumentWithSelectorMap({});
      expect(adapter.getCodeContainer()).toBeNull();
    });
  });

  // ---- getRepoFilePath ----

  // ---- getTabContainer ----

  describe("getTabContainer()", () => {
    it("returns .file-actions when present", () => {
      const el = stubElement("div");
      mockDocumentWithSelectorMap({
        ".file-actions": el,
      });
      expect(adapter.getTabContainer()).toBe(el);
    });

    it("returns .js-file-title as fallback", () => {
      const el = stubElement("div");
      mockDocumentWithSelectorMap({
        ".file-actions": null,
        ".js-file-title": el,
      });
      expect(adapter.getTabContainer()).toBe(el);
    });

    it("returns null when no selectors match", () => {
      mockDocumentWithSelectorMap({});
      expect(adapter.getTabContainer()).toBeNull();
    });
  });

  describe("getRepoFilePath()", () => {
    it("extracts owner, repo, branch, and filePath from blob URL", () => {
      globalThis.window = {
        location: {
          href: "https://gitlab.com/owner/repo/-/blob/main/docs/api/spec.yaml",
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
          href: "https://gitlab.com/owner/repo",
        },
      } as any;

      expect(adapter.getRepoFilePath()).toBeNull();
    });
  });
});
