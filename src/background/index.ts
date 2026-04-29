import browser from "webextension-polyfill";
import {
  setToken,
  clearToken,
  getAuthStatus,
  getFileContent,
  updateFileContent,
} from "./github-api";
import type { AuthStatus, FileContent, CommitResult, GitHubError } from "./github-api";

// ── Message types shared with content scripts ──────────────────────────────

type ExtensionMessage =
  | { type: "URL_CHANGED"; url: string }
  | { type: "SETTINGS_UPDATED" }
  | { type: "GET_SETTINGS" }
  | { type: "github-setToken"; token: string }
  | { type: "github-clearToken" }
  | { type: "github-getAuthStatus" }
  | { type: "github-getFile"; owner: string; repo: string; path: string; branch: string }
  | { type: "github-updateFile"; owner: string; repo: string; path: string; content: string; sha: string; message: string; branch: string };

// ── URL filters ────────────────────────────────────────────────────────────

const URL_FILTERS: browser.Events.UrlFilter[] = [
  { hostSuffix: "github.com" },
  { hostSuffix: "gitlab.com" },
];

// ── Navigation helpers ─────────────────────────────────────────────────────

function notifyUrlChange(tabId: number, url: string): void {
  const message: ExtensionMessage = { type: "URL_CHANGED", url };
  browser.tabs.sendMessage(tabId, message).catch(() => {
    // Content script may not be injected yet (e.g. pre-rendered tab,
    // tab navigated away, or extension context invalidated). Silently
    // ignore — the content script will receive the next navigation event.
  });
}

// SPA-style pushState / replaceState navigation
browser.webNavigation.onHistoryStateUpdated.addListener(
  (details) => {
    if (details.frameId !== 0) return; // only top-level frames
    notifyUrlChange(details.tabId, details.url);
  },
  { url: URL_FILTERS }
);

// Initial full page loads
browser.webNavigation.onCompleted.addListener(
  (details) => {
    if (details.frameId !== 0) return;
    notifyUrlChange(details.tabId, details.url);
  },
  { url: URL_FILTERS }
);

// ── Settings broadcasting ──────────────────────────────────────────────────

/** Minimum interval (ms) between consecutive SETTINGS_UPDATED broadcasts. */
const DEBOUNCE_MS = 300;

let broadcastTimer: ReturnType<typeof setTimeout> | null = null;

async function broadcastSettingsUpdate(): Promise<void> {
  const tabs = await browser.tabs.query({
    url: ["*://github.com/*", "*://gitlab.com/*"],
  });

  const message: ExtensionMessage = { type: "SETTINGS_UPDATED" };

  await Promise.all(
    tabs.map((tab) => {
      if (tab.id == null) return Promise.resolve();
      return browser.tabs.sendMessage(tab.id, message).catch(() => {
        // Tab may have been closed or content script not yet ready.
      });
    })
  );
}

function scheduleSettingsBroadcast(): void {
  if (broadcastTimer !== null) {
    clearTimeout(broadcastTimer);
  }
  broadcastTimer = setTimeout(() => {
    broadcastTimer = null;
    void broadcastSettingsUpdate();
  }, DEBOUNCE_MS);
}

browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") return;
  // Only react when at least one stored key actually changed.
  const hasRealChange = Object.values(changes).some(
    (change) => change.oldValue !== change.newValue
  );
  if (!hasRealChange) return;

  scheduleSettingsBroadcast();
});

// ── Runtime message handler ────────────────────────────────────────────────

browser.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: browser.Runtime.MessageSender
  ): Promise<unknown> | undefined => {
    if (
      typeof message !== "object" ||
      message === null ||
      !("type" in message)
    ) {
      return undefined;
    }

    const msg = message as { type: string; [key: string]: unknown };

    // ── Existing handlers ──────────────────────────────────────────────────

    if (msg.type === "GET_SETTINGS") {
      return browser.storage.sync.get(null);
    }

    // ── GitHub API handlers ────────────────────────────────────────────────

    if (msg.type === "github-setToken") {
      return setToken(msg.token as string).then(() => ({ success: true }));
    }

    if (msg.type === "github-clearToken") {
      return clearToken().then(() => ({ success: true }));
    }

    if (msg.type === "github-getAuthStatus") {
      return getAuthStatus()
        .then((data) => ({ success: true as const, data }))
        .catch((err: GitHubError) => ({ success: false as const, error: err }));
    }

    if (msg.type === "github-getFile") {
      return getFileContent(
        msg.owner as string,
        msg.repo as string,
        msg.path as string,
        msg.branch as string
      )
        .then((data) => ({ success: true as const, data }))
        .catch((err: GitHubError) => ({ success: false as const, error: err }));
    }

    if (msg.type === "github-updateFile") {
      return updateFileContent(
        msg.owner as string,
        msg.repo as string,
        msg.path as string,
        msg.content as string,
        msg.sha as string,
        msg.message as string,
        msg.branch as string
      )
        .then((data) => ({ success: true as const, data }))
        .catch((err: GitHubError) => ({ success: false as const, error: err }));
    }

    return undefined;
  }
);
