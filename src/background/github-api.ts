import browser from "webextension-polyfill";

const GITHUB_API = "https://api.github.com";
const API_VERSION = "2022-11-28";

export interface GitHubError {
  type: "auth" | "permission" | "conflict" | "validation" | "network" | "unknown";
  message: string;
  status?: number;
}

export interface FileContent {
  content: string; // decoded text content
  sha: string;
}

export interface CommitResult {
  sha: string;
  htmlUrl: string;
}

export interface AuthStatus {
  authenticated: boolean;
  username?: string;
  avatarUrl?: string;
}

// ── Token management ──────────────────────────────────────────────────────────

const STORAGE_KEY = "github_token";
let cachedToken: string | null | undefined = undefined;

export async function getToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken;
  const result = await browser.storage.local.get(STORAGE_KEY);
  const value = (result as Record<string, unknown>)[STORAGE_KEY];
  cachedToken = typeof value === "string" ? value : null;
  return cachedToken;
}

export async function setToken(token: string): Promise<void> {
  cachedToken = token;
  await browser.storage.local.set({ [STORAGE_KEY]: token });
}

export async function clearToken(): Promise<void> {
  cachedToken = null;
  await browser.storage.local.remove(STORAGE_KEY);
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  if (!token) {
    throw { type: "auth", message: "No GitHub token configured. Add one in extension settings." } as GitHubError;
  }
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": API_VERSION,
  };
}

function classifyError(status: number, body: any): GitHubError {
  if (status === 401) return { type: "auth", message: "GitHub token is invalid or expired. Please update your token in settings.", status };
  if (status === 403) return { type: "permission", message: "Insufficient permissions. Ensure your token has 'Contents: Read and write' access.", status };
  if (status === 409) return { type: "conflict", message: "File was modified by someone else. Please reload and try again.", status };
  if (status === 422) return { type: "validation", message: body?.message ?? "Validation failed.", status };
  return { type: "unknown", message: body?.message ?? `GitHub API error (${status})`, status };
}

async function githubFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = await apiHeaders();
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers ?? {}) },
  });

  if (!response.ok) {
    let body: any;
    try { body = await response.json(); } catch { body = {}; }
    throw classifyError(response.status, body);
  }

  return response.json();
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getAuthStatus(): Promise<AuthStatus> {
  const token = await getToken();
  if (!token) return { authenticated: false };

  try {
    const user = await githubFetch<{ login: string; avatar_url: string }>("/user");
    return { authenticated: true, username: user.login, avatarUrl: user.avatar_url };
  } catch {
    return { authenticated: false };
  }
}

export async function getFileContent(
  owner: string, repo: string, path: string, branch: string
): Promise<FileContent> {
  const data = await githubFetch<{ content: string; sha: string }>(
    `/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
  );

  // GitHub returns Base64-encoded content
  const decoded = atob(data.content.replace(/\n/g, ""));
  return { content: decoded, sha: data.sha };
}

export async function updateFileContent(
  owner: string, repo: string, path: string,
  content: string, sha: string, message: string, branch: string
): Promise<CommitResult> {
  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
    sha,
    branch,
  };

  const data = await githubFetch<{ commit: { sha: string; html_url: string } }>(
    `/repos/${owner}/${repo}/contents/${path}`,
    { method: "PUT", body: JSON.stringify(body) }
  );

  return { sha: data.commit.sha, htmlUrl: data.commit.html_url };
}
