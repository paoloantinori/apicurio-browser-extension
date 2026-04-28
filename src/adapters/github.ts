import type { ISiteAdapter } from "./types";

/**
 * GitHub site adapter for interacting with GitHub's DOM.
 *
 * Supports both the modern React-based code view (data-testid selectors)
 * and legacy GitHub DOM structures as fallback.
 */
export class GitHubAdapter implements ISiteAdapter {
  // ---- File view detection ----

  isFileView(): boolean {
    // Primary: modern React code view
    if (document.querySelector('[data-testid="blob-file"]')) return true;
    if (document.querySelector(".react-code-view")) return true;

    // Fallback: legacy code view container
    const legacyBox = document.querySelector('.Box[itemprop="text"]');
    if (legacyBox) return true;

    return false;
  }

  // ---- File name extraction ----

  getFileName(): string | null {
    // Try breadcrumbs first
    const breadcrumbList = document.querySelector(
      '[data-testid="breadcrumbs"]'
    );
    if (breadcrumbList) {
      const items = breadcrumbList.querySelectorAll("li");
      if (items.length > 0) {
        const lastItem = items[items.length - 1];
        const name = lastItem?.textContent?.trim();
        if (name) return name;
      }
    }

    // Fallback: parse URL (/owner/repo/blob/branch/path/to/file.ext)
    return this.getFileNameFromUrl();
  }

  private getFileNameFromUrl(): string | null {
    const url = new URL(window.location.href);
    const pathParts = url.pathname.split("/").filter(Boolean);

    // GitHub blob URLs: /owner/repo/blob/branch/path/to/file.ext
    const blobIndex = pathParts.indexOf("blob");
    if (blobIndex !== -1 && blobIndex + 2 < pathParts.length) {
      // Segments after blob/branch are the file path
      const filePathParts = pathParts.slice(blobIndex + 2);
      return filePathParts[filePathParts.length - 1] ?? null;
    }

    return null;
  }

  // ---- File content extraction ----

  getFileContent(): string | null {
    // Primary: modern React code lines
    const reactLines = document.querySelectorAll(
      ".react-code-lines .react-code-text"
    );
    if (reactLines.length > 0) {
      return this.extractLinesAsText(reactLines);
    }

    // Secondary: data-testid code cells
    const codeCells = document.querySelectorAll(
      '[data-testid="code-cell"]'
    );
    if (codeCells.length > 0) {
      return this.extractLinesAsText(codeCells);
    }

    // Legacy: js-file-line-container
    const legacyLines = document.querySelectorAll(
      ".js-file-line-container .js-file-line"
    );
    if (legacyLines.length > 0) {
      return this.extractLinesAsText(legacyLines);
    }

    return null;
  }

  private extractLinesAsText(elements: NodeListOf<Element>): string {
    const lines: string[] = [];
    elements.forEach((el) => {
      lines.push(el.textContent ?? "");
    });
    return lines.join("\n");
  }

  // ---- Toolbar area ----

  getToolbarArea(): HTMLElement | null {
    // Primary: modern code view header
    const header = document.querySelector(
      '[data-testid="code-view-header"]'
    );
    if (header instanceof HTMLElement) return header;

    // Fallback: Box-header flex container
    const boxHeader = document.querySelector(
      ".Box-header .d-flex"
    );
    if (boxHeader instanceof HTMLElement) return boxHeader;

    // Legacy: file actions area
    const fileActions = document.querySelector(".file-actions");
    if (fileActions instanceof HTMLElement) return fileActions;

    return null;
  }

  // ---- Code container ----

  getCodeContainer(): HTMLElement | null {
    // Same elements used for file view detection
    const primary = document.querySelector('[data-testid="blob-file"]');
    if (primary instanceof HTMLElement) return primary;

    const reactView = document.querySelector(".react-code-view");
    if (reactView instanceof HTMLElement) return reactView;

    const legacyBox = document.querySelector('.Box[itemprop="text"]');
    if (legacyBox instanceof HTMLElement) return legacyBox;

    return null;
  }

  // ---- File extension ----

  getFileExtension(): string | null {
    const fileName = this.getFileName();
    if (!fileName) return null;

    const dotIndex = fileName.lastIndexOf(".");
    if (dotIndex === -1 || dotIndex === fileName.length - 1) return null;

    return fileName.slice(dotIndex + 1).toLowerCase();
  }

  // ---- SPA navigation change ----

  onNavigationChange(callback: (url: string) => void): void {
    const handler = (): void => {
      callback(window.location.href);
    };

    // GitHub uses Hotwire Turbo for SPA navigation
    document.addEventListener("turbo:load", handler);

    // Legacy pjax
    document.addEventListener("pjax:end", handler);

    // Browser back/forward
    window.addEventListener("popstate", handler);

    // URL polling fallback for edge cases where events don't fire
    let lastUrl = window.location.href;
    const pollIntervalId = setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        callback(currentUrl);
      }
    }, 1000);

    // Note: The interface returns void, so cleanup requires the caller
    // to handle teardown or the adapter to be garbage-collected.
    // Store references for potential future cleanup support.
    void pollIntervalId;
  }
}
