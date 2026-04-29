import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted to ensure mock factory can reference the mock functions
const { storageGet, storageSet, storageRemove } = vi.hoisted(() => ({
  storageGet: vi.fn<() => Promise<Record<string, unknown>>>().mockResolvedValue({}),
  storageSet: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  storageRemove: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

vi.mock("webextension-polyfill", () => ({
  default: {
    storage: {
      local: {
        get: storageGet,
        set: storageSet,
        remove: storageRemove,
      },
    },
  },
}));

const fetchMock = vi.fn();
globalThis.fetch = fetchMock;

import {
  getToken,
  setToken,
  clearToken,
  getAuthStatus,
  getFileContent,
  updateFileContent,
} from "../src/background/github-api";

describe("github-api", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Populate the in-memory token cache so apiHeaders() doesn't short-circuit.
    await setToken("test-token");
  });

  // ── Token management ──────────────────────────────────────────────────────────

  describe("getToken()", () => {
    it("returns null after clearToken()", async () => {
      await clearToken();
      expect(await getToken()).toBeNull();
    });

    it("returns the token set via setToken()", async () => {
      await setToken("ghp_test123");
      expect(await getToken()).toBe("ghp_test123");
    });
  });

  describe("setToken()", () => {
    it("stores the token in local storage", async () => {
      await setToken("ghp_newtoken");
      expect(storageSet).toHaveBeenCalledWith({ github_token: "ghp_newtoken" });
    });
  });

  describe("clearToken()", () => {
    it("removes the token from local storage", async () => {
      await clearToken();
      expect(storageRemove).toHaveBeenCalledWith("github_token");
    });
  });

  // ── getAuthStatus ──────────────────────────────────────────────────────────────

  describe("getAuthStatus()", () => {
    it("returns unauthenticated when no token is stored", async () => {
      await clearToken();
      const status = await getAuthStatus();
      expect(status).toEqual({ authenticated: false });
    });

    it("returns authenticated with user info on valid token", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          login: "testuser",
          avatar_url: "https://avatars.example.com/test.png",
        }),
      });

      const status = await getAuthStatus();
      expect(status).toEqual({
        authenticated: true,
        username: "testuser",
        avatarUrl: "https://avatars.example.com/test.png",
      });
    });

    it("returns unauthenticated when API call fails", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: "Bad credentials" }),
      });

      const status = await getAuthStatus();
      expect(status).toEqual({ authenticated: false });
    });
  });

  // ── getFileContent ─────────────────────────────────────────────────────────────

  describe("getFileContent()", () => {
    it("fetches and decodes file content", async () => {
      const originalContent = '{"openapi":"3.0.0"}';
      const base64Content = btoa(originalContent);

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: base64Content, sha: "abc123" }),
      });

      const result = await getFileContent("owner", "repo", "spec.yaml", "main");
      expect(result).toEqual({ content: originalContent, sha: "abc123" });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.github.com/repos/owner/repo/contents/spec.yaml?ref=main",
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          }),
        })
      );
    });

    it("throws auth error on 401", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: "Bad credentials" }),
      });

      await expect(
        getFileContent("owner", "repo", "spec.yaml", "main")
      ).rejects.toEqual(expect.objectContaining({ type: "auth", status: 401 }));
    });

    it("throws permission error on 403", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: "Forbidden" }),
      });

      await expect(
        getFileContent("owner", "repo", "spec.yaml", "main")
      ).rejects.toEqual(expect.objectContaining({ type: "permission", status: 403 }));
    });

    it("handles base64 content with newlines", async () => {
      const originalContent = "line1\nline2\nline3";
      const base64WithNewlines = btoa(originalContent).replace(/(.{76})/g, "$1\n");

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: base64WithNewlines, sha: "sha1" }),
      });

      const result = await getFileContent("o", "r", "f.yaml", "main");
      expect(result.content).toBe(originalContent);
    });
  });

  // ── updateFileContent ──────────────────────────────────────────────────────────

  describe("updateFileContent()", () => {
    it("sends PUT request with base64-encoded content", async () => {
      const content = '{"openapi":"3.0.0","info":{"title":"Updated"}}';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          commit: {
            sha: "newcommit123",
            html_url: "https://github.com/owner/repo/commit/newcommit123",
          },
        }),
      });

      const result = await updateFileContent(
        "owner", "repo", "spec.yaml", content, "oldsha", "Update spec", "main"
      );

      expect(result).toEqual({
        sha: "newcommit123",
        htmlUrl: "https://github.com/owner/repo/commit/newcommit123",
      });

      const call = fetchMock.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.message).toBe("Update spec");
      expect(body.sha).toBe("oldsha");
      expect(body.branch).toBe("main");
      expect(atob(body.content)).toBe(content);
      expect(call[1].method).toBe("PUT");
    });

    it("throws conflict error on 409", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ message: "Conflict" }),
      });

      await expect(
        updateFileContent("o", "r", "f.yaml", "content", "sha", "msg", "main")
      ).rejects.toEqual(expect.objectContaining({ type: "conflict", status: 409 }));
    });

    it("handles UTF-8 content in base64 encoding", async () => {
      const content = '{"description":"Spécification API"}';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          commit: { sha: "commit1", html_url: "http://example.com" },
        }),
      });

      await updateFileContent("o", "r", "f.yaml", content, "sha", "msg", "main");

      const call = fetchMock.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(decodeURIComponent(escape(atob(body.content)))).toBe(content);
    });
  });

  // ── Error classification ───────────────────────────────────────────────────────

  describe("error classification", () => {
    it("classifies unknown status codes", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: "Internal Server Error" }),
      });

      await expect(getFileContent("o", "r", "f.yaml", "main")).rejects.toEqual(
        expect.objectContaining({ type: "unknown", status: 500, message: "Internal Server Error" })
      );
    });

    it("handles non-JSON error responses", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => { throw new Error("not JSON"); },
      });

      await expect(getFileContent("o", "r", "f.yaml", "main")).rejects.toEqual(
        expect.objectContaining({ type: "unknown", status: 502, message: "GitHub API error (502)" })
      );
    });
  });
});
