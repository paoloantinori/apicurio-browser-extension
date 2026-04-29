import browser from "webextension-polyfill";
import { GitHubAdapter } from "../adapters/github";
import { GitLabAdapter } from "../adapters/gitlab";
import { type ISiteAdapter } from "../adapters/types";
import { ApicurioSpec } from "../core/apicurio-wrapper";
import { SettingsManager } from "../core/settings-manager";
import { SpecValidator } from "../core/spec-validator";
import { ToggleUI } from "./toggle-ui";
import { ViewerManager } from "./viewer-manager";

type ControllerState = "idle" | "detected" | "active";

const PLATFORM_MAP: Record<string, new () => ISiteAdapter> = {
  "github.com": GitHubAdapter,
  "gitlab.com": GitLabAdapter,
};

function detectPlatform(): string | null {
  const host = window.location.hostname;
  for (const domain of Object.keys(PLATFORM_MAP)) {
    if (host === domain || host.endsWith("." + domain)) {
      return domain;
    }
  }
  return null;
}

class ContentController {
  private adapter: ISiteAdapter;
  private platform: string;
  private state: ControllerState = "idle";
  private toggleUI = new ToggleUI();
  private viewerManager: ViewerManager;
  private currentSpec: string | null = null;

  constructor(adapter: ISiteAdapter, platform: string) {
    this.adapter = adapter;
    this.platform = platform;
    this.viewerManager = new ViewerManager(adapter, platform.split(".")[0] as "github" | "gitlab");
  }

  async runPipeline(): Promise<void> {
    this.cleanup();

    const settings = await SettingsManager.getAll();

    const platformKey = `${this.platform.split(".")[0]}Enabled` as
      | "githubEnabled"
      | "gitlabEnabled";
    if (!settings[platformKey]) return;

    if (!this.adapter.isFileView()) return;

    const filename = this.adapter.getFileName();
    if (!filename || !SpecValidator.isCandidateFile(filename)) return;

    const ext = this.adapter.getFileExtension();
    if (!ext) return;

    const content = this.adapter.getFileContent();
    if (!content) return;

    const result = SpecValidator.quickValidate(content);
    if (!result.valid) return;

    this.currentSpec = content;
    this.state = "detected";

    const toolbar = this.adapter.getToolbarArea();
    if (toolbar) {
      this.toggleUI.mount(toolbar, (active) => {
        if (active) {
          this.activateViewer();
        } else {
          this.deactivateViewer();
        }
      });
    }

    if (settings.autoRender) {
      await this.activateViewer();
    }
  }

  private async activateViewer(): Promise<void> {
    if (!this.currentSpec || this.state === "active") return;
    this.state = "active";
    this.toggleUI.setActive(true);
    await this.viewerManager.showViewer(this.currentSpec);
  }

  private deactivateViewer(): void {
    if (this.state !== "active") return;
    this.state = "detected";
    this.toggleUI.setActive(false);
    this.viewerManager.showSource();
  }

  cleanup(): void {
    if (this.state === "idle") return;
    this.viewerManager.cleanup();
    this.toggleUI.destroy();
    this.currentSpec = null;
    this.state = "idle";
  }
}

async function main() {
  const platform = detectPlatform();
  if (!platform) return;

  const AdapterClass = PLATFORM_MAP[platform];
  const adapter = new AdapterClass();
  const controller = new ContentController(adapter, platform);

  // Initial detection
  await controller.runPipeline();

  // Listen for SPA navigation from background script
  browser.runtime.onMessage.addListener((message: unknown) => {
    if (
      typeof message === "object" &&
      message !== null &&
      "type" in message
    ) {
      const msg = message as { type: string };
      if (msg.type === "URL_CHANGED") {
        void controller.runPipeline();
      } else if (msg.type === "SETTINGS_UPDATED") {
        void controller.runPipeline();
      }
    }
  });

  // Client-side navigation detection as backup
  adapter.onNavigationChange(() => {
    void controller.runPipeline();
  });
}

void main();
