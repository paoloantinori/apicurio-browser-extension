import type { RepoFilePath } from "../adapters/types";

export type Platform = "github" | "gitlab";

/**
 * Resolves an external $ref path against the current file's location
 * and constructs the platform-specific raw content URL.
 */
export function resolveExternalRef(
  externalRef: string,
  currentFile: RepoFilePath,
  platform: Platform
): string {
  if (externalRef.startsWith("http://") || externalRef.startsWith("https://")) {
    return externalRef;
  }

  const dir = currentFile.filePath.includes("/")
    ? currentFile.filePath.substring(0, currentFile.filePath.lastIndexOf("/"))
    : "";

  let resolvedPath: string;
  if (externalRef.startsWith("/")) {
    resolvedPath = externalRef.substring(1);
  } else {
    resolvedPath = normalizePath(dir + "/" + externalRef);
  }

  if (platform === "github") {
    return `https://raw.githubusercontent.com/${currentFile.owner}/${currentFile.repo}/${currentFile.branch}/${resolvedPath}`;
  }
  return `https://gitlab.com/${currentFile.owner}/${currentFile.repo}/-/raw/${currentFile.branch}/${resolvedPath}`;
}

function normalizePath(path: string): string {
  const parts = path.split("/");
  const result: string[] = [];
  for (const part of parts) {
    if (part === "..") {
      result.pop();
    } else if (part !== "." && part !== "") {
      result.push(part);
    }
  }
  return result.join("/");
}
