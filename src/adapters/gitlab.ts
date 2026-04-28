import type { ISiteAdapter } from "./types";

/**
 * GitLab site adapter for interacting with GitLab's DOM.
 *
 * Supports GitLab's file view at URLs matching /-/blob/<branch>/<path>.
 * Handles GitLab's Turbo-based SPA navigation.
 */
export class GitLabAdapter implements ISiteAdapter {
  isFileView(): boolean {
    const selectors = [
      ".file-content",
      '[data-testid="file-content"]',
      ".blob-content",
    ];
    return selectors.some((sel) => document.querySelector(sel) !== null);
  }

  getFileName(): string | null {
    // Try breadcrumb first
    const breadcrumbLink = document.querySelector<HTMLAnchorElement>(
      ".breadcrumb-item-last a"
    );
    if (breadcrumbLink?.textContent?.trim()) {
      return breadcrumbLink.textContent.trim();
    }

    // Fallback: parse from URL
    return this.getFileNameFromUrl();
  }

  getFileContent(): string | null {
    const selectors = [
      ".file-content pre",
      ".blob-content pre code",
      ".file-content code",
    ];

    for (const sel of selectors) {
      const el = document.querySelector<HTMLElement>(sel);
      if (el?.textContent) {
        return el.textContent;
      }
    }

    return null;
  }

  getToolbarArea(): HTMLElement | null {
    const selectors = [".file-actions", ".js-file-title", ".file-title"];

    for (const sel of selectors) {
      const el = document.querySelector<HTMLElement>(sel);
      if (el) return el;
    }

    return null;
  }

  getCodeContainer(): HTMLElement | null {
    const selectors = [".file-content", ".blob-content"];

    for (const sel of selectors) {
      const el = document.querySelector<HTMLElement>(sel);
      if (el) return el;
    }

    return null;
  }

  getFileExtension(): string | null {
    const fileName = this.getFileName();
    if (!fileName) return null;

    const dotIndex = fileName.lastIndexOf(".");
    if (dotIndex === -1 || dotIndex === fileName.length - 1) return null;

    return fileName.slice(dotIndex + 1).toLowerCase();
  }

  onNavigationChange(callback: (url: string) => void): void {
    const handler = () => callback(window.location.href);

    // GitLab uses Turbo for SPA navigation
    document.addEventListener("turbo:load", handler);
    document.addEventListener("turbo:render", handler);

    // Standard popstate for back/forward navigation
    window.addEventListener("popstate", handler);

    // URL polling fallback for edge cases
    let lastUrl = window.location.href;
    const pollInterval = setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        callback(lastUrl);
      }
    }, 1000);

    // Clean up polling on page unload
    window.addEventListener("unload", () => {
      clearInterval(pollInterval);
    });
  }

  private getFileNameFromUrl(): string | null {
    const url = window.location.href;
    // GitLab file view pattern: /-/blob/<branch>/<path>
    const blobMatch = url.match(/\/-\/blob\/[^/]+\/(.+?)(?:\?|#|$)/);
    if (blobMatch) {
      const filePath = blobMatch[1];
      // Extract just the filename from the path
      const segments = filePath.split("/");
      return segments[segments.length - 1] || null;
    }
    return null;
  }
}
