/**
 * Platform adapter interface for site-specific DOM interaction.
 *
 * Adding support for a new platform (Bitbucket, Gitea, etc.) only
 * requires implementing this interface. The content script controller
 * delegates all platform-specific logic to the active adapter.
 */

/** Extracts the file extension from a filename, lowercased. Returns null if none. */
export function extractFileExtension(fileName: string): string | null {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === fileName.length - 1) return null;
  return fileName.slice(dotIndex + 1).toLowerCase();
}

/** Repository file path info extracted from the page URL. */
export interface RepoFilePath {
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
}

export interface ISiteAdapter {
  /** Returns true only when viewing a single file (not directory, diff, or PR) */
  isFileView(): boolean;

  /** Extracts the file name from the current page, or null if not a file view */
  getFileName(): string | null;

  /** Extracts raw text content from the code viewer DOM, or null on failure */
  getFileContent(): string | null;

  /** Returns the toolbar/header element where the toggle button should be injected */
  getToolbarArea(): HTMLElement | null;

  /** Returns the code container element to show/hide when toggling views */
  getCodeContainer(): HTMLElement | null;

  /** Extracts the file extension (e.g. "yaml", "json") or null if not determinable */
  getFileExtension(): string | null;

  /** Extracts owner, repo, branch, and full file path from the page URL, or null. */
  getRepoFilePath(): RepoFilePath | null;

  /**
   * Registers a callback for SPA navigation changes.
   * Handles platform-specific SPA mechanics (GitHub Turbo, GitLab pjax, etc.)
   */
  onNavigationChange(callback: (url: string) => void): void;
}
