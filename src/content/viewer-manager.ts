import browser from "webextension-polyfill";
import yaml from "js-yaml";
import { ISiteAdapter } from "../adapters/types";
import { ApicurioWrapper, ApicurioSpec, WrapperContext } from "../core/apicurio-wrapper";
import type { Platform } from "../core/ref-resolver";

/**
 * Manages DOM manipulation for switching between the native code view
 * and the embedded Apicurio viewer iframe.
 *
 * Hides/shows the platform's code container and inserts/removes the
 * Apicurio viewer container in its place.
 */
export class ViewerManager {
  private wrapper: ApicurioWrapper | null = null;
  private viewerContainer: HTMLElement | null = null;
  private isActive: boolean = false;

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

    // Create viewer container
    this.viewerContainer = document.createElement("div");
    this.viewerContainer.style.width = "100%";
    this.viewerContainer.style.minHeight = "500px";

    // Insert after the hidden code container
    codeContainer.parentNode?.insertBefore(
      this.viewerContainer,
      codeContainer.nextSibling
    );

    // Initialise Apicurio wrapper with repo context for external ref resolution
    const context: WrapperContext = {
      platform: this.platform,
      repoFilePath: this.adapter.getRepoFilePath(),
    };
    this.wrapper = new ApicurioWrapper(this.viewerContainer, context);
    this.wrapper.init(browser.runtime.getURL("viewer/index.html"));

    const spec: ApicurioSpec = {
      type: specType,
      value: this.toJsonString(specContent),
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

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private restoreCodeContainer(): void {
    const codeContainer = this.adapter.getCodeContainer();
    if (codeContainer) {
      codeContainer.style.display = "";
    }
    this.isActive = false;
  }

  private toJsonString(content: string): string {
    try {
      JSON.parse(content);
      return content;
    } catch {
      return JSON.stringify(yaml.load(content));
    }
  }

  private removeViewer(): void {
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
