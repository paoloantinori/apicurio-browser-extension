import browser from "webextension-polyfill";
import { SettingsManager } from "../core/settings-manager";

async function init() {
  const settings = await SettingsManager.getAll();

  // Existing settings bindings
  const autoRender = document.getElementById("autoRender") as HTMLInputElement;
  const githubEnabled = document.getElementById("githubEnabled") as HTMLInputElement;
  const gitlabEnabled = document.getElementById("gitlabEnabled") as HTMLInputElement;
  const theme = document.getElementById("theme") as HTMLSelectElement;

  autoRender.checked = settings.autoRender;
  githubEnabled.checked = settings.githubEnabled;
  gitlabEnabled.checked = settings.gitlabEnabled;
  theme.value = settings.theme;

  autoRender.addEventListener("change", () => SettingsManager.set("autoRender", autoRender.checked));
  githubEnabled.addEventListener("change", () => SettingsManager.set("githubEnabled", githubEnabled.checked));
  gitlabEnabled.addEventListener("change", () => SettingsManager.set("gitlabEnabled", gitlabEnabled.checked));
  theme.addEventListener("change", () => SettingsManager.set("theme", theme.value as "light" | "dark" | "auto"));

  // ── Token management ──────────────────────────────────────────────────────────
  const tokenInput = document.getElementById("githubToken") as HTMLInputElement;
  const toggleVisibility = document.getElementById("toggleTokenVisibility") as HTMLButtonElement;
  const saveTokenBtn = document.getElementById("saveToken") as HTMLButtonElement;
  const clearTokenBtn = document.getElementById("clearToken") as HTMLButtonElement;
  const authStatus = document.getElementById("authStatus") as HTMLElement;
  const statusDot = authStatus?.querySelector(".status-dot") as HTMLElement;
  const statusText = authStatus?.querySelector(".status-text") as HTMLElement;

  async function refreshAuthStatus(): Promise<void> {
    const response: any = await browser.runtime.sendMessage({ type: "github-getAuthStatus" });
    if (response?.success && response.data?.authenticated) {
      statusDot.className = "status-dot connected";
      statusText.textContent = `Connected as @${response.data.username}`;
      tokenInput.value = "••••••••";
      tokenInput.disabled = true;
    } else {
      statusDot.className = "status-dot";
      statusText.textContent = "Not configured";
      tokenInput.value = "";
      tokenInput.disabled = false;
    }
  }

  // Toggle token visibility
  toggleVisibility.addEventListener("click", () => {
    if (tokenInput.type === "password") {
      tokenInput.type = "text";
      toggleVisibility.textContent = "🔒";
      toggleVisibility.setAttribute("aria-label", "Hide token");
    } else {
      tokenInput.type = "password";
      toggleVisibility.textContent = "👁";
      toggleVisibility.setAttribute("aria-label", "Show token");
    }
  });

  // Save token
  saveTokenBtn.addEventListener("click", async () => {
    const token = tokenInput.value.trim();
    if (!token) return;

    saveTokenBtn.disabled = true;
    saveTokenBtn.textContent = "Saving...";

    const response: any = await browser.runtime.sendMessage({
      type: "github-setToken",
      token,
    });

    if (response?.success) {
      await refreshAuthStatus();
    } else {
      statusDot.className = "status-dot error";
      statusText.textContent = "Failed to save token";
    }

    saveTokenBtn.disabled = false;
    saveTokenBtn.textContent = "Save";
  });

  // Clear token
  clearTokenBtn.addEventListener("click", async () => {
    await browser.runtime.sendMessage({ type: "github-clearToken" });
    tokenInput.value = "";
    tokenInput.disabled = false;
    tokenInput.type = "password";
    await refreshAuthStatus();
  });

  // Enable input when focused (allows re-entering token)
  tokenInput.addEventListener("focus", () => {
    if (tokenInput.disabled) {
      tokenInput.value = "";
      tokenInput.disabled = false;
    }
  });

  await refreshAuthStatus();
}

document.addEventListener("DOMContentLoaded", init);
