import browser from "webextension-polyfill";
import yaml from "js-yaml";
import { ISiteAdapter, type RepoFilePath } from "../adapters/types";
import { ApicurioWrapper, ApicurioSpec, WrapperContext } from "../core/apicurio-wrapper";
import type { Platform } from "../core/ref-resolver";
import { SaveToolbar, type SaveResult, type SaveStatus } from "./save-toolbar";

/**
 * Manages DOM manipulation for switching between the native code view
 * and the embedded Apicurio viewer iframe.
 *
 * Hides/shows the platform's code container and inserts/removes the
 * Apicurio viewer container in its place.  Also provides write-back
 * support: edits made in Apicurio can be committed back to the
 * repository via the background script's GitHub API helpers.
 */
export class ViewerManager {
  private wrapper: ApicurioWrapper | null = null;
  private viewerContainer: HTMLElement | null = null;
  private isActive: boolean = false;
  private disabledParent: HTMLElement | null = null;
  private hiddenSiblings: HTMLElement[] = [];

  // Write-back state
  private saveToolbar: SaveToolbar | null = null;
  private latestSpec: ApicurioSpec | null = null;
  private originalWasYaml: boolean = false;
  private dirty: boolean = false;
  private fileSha: string | null = null;
  private repoInfo: RepoFilePath | null = null;

  constructor(private adapter: ISiteAdapter, private platform: Platform) {}

  /**
   * Hide the native code container and display the Apicurio viewer
   * loaded with the provided spec content.
   */
  async showViewer(
    specContent: string,
    specType: "OPENAPI" | "ASYNCAPI" = "OPENAPI"
  ): Promise<void> {
    // Prevent duplicate iframes on rapid toggles
    if (this.isActive) return;

    const codeContainer = this.adapter.getCodeContainer();
    if (!codeContainer) return;

    // Hide native code view
    codeContainer.style.display = "none";

    // Hide sibling elements (line number gutters, etc.) that are outside
    // the code container. GitHub renders line numbers in a separate <div>
    // sibling of .react-code-lines.
    const parent = codeContainer.parentElement;
    if (parent instanceof HTMLElement) {
      for (const child of Array.from(parent.children)) {
        if (
          child !== codeContainer &&
          child instanceof HTMLElement &&
          !child.hasAttribute("data-apicurio-viewer")
        ) {
          if (child.style.display !== "none") {
            child.style.display = "none";
            this.hiddenSiblings.push(child);
          }
        }
      }

      // Disable pointer events on the parent container so sibling elements
      // (line number gutters, overlays, copy buttons) can't intercept mouse
      // events over the viewer. The viewer re-enables pointer-events for itself.
      parent.style.pointerEvents = "none";
      this.disabledParent = parent;
    }

    // Create viewer container
    this.viewerContainer = document.createElement("div");
    this.viewerContainer.setAttribute("data-apicurio-viewer", "");
    this.viewerContainer.style.width = "100%";
    this.viewerContainer.style.minHeight = "500px";
    this.viewerContainer.style.position = "relative";
    this.viewerContainer.style.zIndex = "10";
    this.viewerContainer.style.pointerEvents = "auto";

    // Insert after the hidden code container
    codeContainer.parentNode?.insertBefore(
      this.viewerContainer,
      codeContainer.nextSibling
    );

    // Determine original format and convert to JSON in a single pass
    let jsonContent: string;
    try {
      JSON.parse(specContent);
      jsonContent = specContent;
      this.originalWasYaml = false;
    } catch {
      jsonContent = JSON.stringify(yaml.load(specContent));
      this.originalWasYaml = true;
    }

    // Cache repo info for save operations
    this.repoInfo = this.adapter.getRepoFilePath();

    // Initialize save toolbar
    this.saveToolbar = new SaveToolbar();
    this.saveToolbar.mount(this.viewerContainer, () => this.save());

    // Initialize Apicurio wrapper with repo context for external ref resolution
    const context: WrapperContext = {
      platform: this.platform,
      repoFilePath: this.repoInfo,
    };
    this.wrapper = new ApicurioWrapper(this.viewerContainer, context);
    this.wrapper.init(browser.runtime.getURL("viewer/index.html"));

    // Subscribe to changes
    this.wrapper.onChange((spec: ApicurioSpec) => {
      this.latestSpec = spec;
      this.dirty = true;
      this.saveToolbar?.setStatus("dirty");
    });

    const spec: ApicurioSpec = {
      type: specType,
      value: jsonContent,
    };
    this.wrapper.loadSpec(spec);

    this.isActive = true;
  }

  /** Remove the viewer and restore the native code container. */
  showSource(): void {
    this.removeViewer();
    this.restoreCodeContainer();
  }

  /** Full teardown: destroy wrapper, remove viewer, restore source. */
  cleanup(): void {
    this.showSource();
  }

  isDirty(): boolean {
    return this.dirty;
  }

  // ---------------------------------------------------------------------------
  // Write-back helpers
  // ---------------------------------------------------------------------------

  private async save(): Promise<SaveResult> {
    if (!this.latestSpec) return { success: false, error: "No changes to save" };

    const repoInfo = this.repoInfo;
    if (!repoInfo) return { success: false, error: "Could not determine repository path" };

    // Convert back to original format
    const content = this.toOriginalFormat(this.latestSpec.value);

    try {
      // Get current file SHA if we don't have it
      if (!this.fileSha) {
        const fileResponse: any = await browser.runtime.sendMessage({
          type: "github-getFile",
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          path: repoInfo.filePath,
          branch: repoInfo.branch,
        });
        if (!fileResponse?.success) {
          return {
            success: false,
            error: fileResponse?.error?.message ?? "Failed to read file from GitHub",
          };
        }
        this.fileSha = fileResponse.data.sha;
      }

      // Update file
      const fileName = repoInfo.filePath.split("/").pop() ?? repoInfo.filePath;
      const response: any = await browser.runtime.sendMessage({
        type: "github-updateFile",
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        path: repoInfo.filePath,
        branch: repoInfo.branch,
        content,
        sha: this.fileSha,
        message: `Update ${fileName} via Apicurio`,
      });

      if (response?.success) {
        this.fileSha = response.data.sha;
        this.dirty = false;
        return { success: true, commitUrl: response.data.htmlUrl };
      }

      // SHA conflict - reset SHA so next attempt re-fetches
      if (response?.error?.type === "conflict") {
        this.fileSha = null;
      }

      return {
        success: false,
        error: response?.error?.message ?? "Failed to save file",
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  private toOriginalFormat(jsonString: string): string {
    if (!this.originalWasYaml) return jsonString;
    try {
      const obj = JSON.parse(jsonString);
      return yaml.dump(obj, { lineWidth: 120, noRefs: true });
    } catch {
      return jsonString;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private restoreCodeContainer(): void {
    const codeContainer = this.adapter.getCodeContainer();
    if (codeContainer) {
      codeContainer.style.display = "";
    }
    for (const el of this.hiddenSiblings) {
      el.style.display = "";
    }
    this.hiddenSiblings = [];
    if (this.disabledParent) {
      this.disabledParent.style.pointerEvents = "";
      this.disabledParent = null;
    }
    this.isActive = false;
    this.dirty = false;
    this.latestSpec = null;
    this.fileSha = null;
    this.repoInfo = null;
  }

  private removeViewer(): void {
    this.saveToolbar?.destroy();
    this.saveToolbar = null;

    if (this.wrapper) {
      this.wrapper.destroy();
      this.wrapper = null;
    }

    if (this.viewerContainer && this.viewerContainer.parentNode) {
      this.viewerContainer.parentNode.removeChild(this.viewerContainer);
    }
    this.viewerContainer = null;
  }
}
