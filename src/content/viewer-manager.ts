import browser from "webextension-polyfill";
import { ISiteAdapter } from "../adapters/types";
import { ApicurioWrapper, ApicurioSpec } from "../core/apicurio-wrapper";

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

  constructor(private adapter: ISiteAdapter) {}

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

    // Initialise Apicurio wrapper
    this.wrapper = new ApicurioWrapper(this.viewerContainer);
    this.wrapper.init(browser.runtime.getURL("viewer/index.html"));

    const spec: ApicurioSpec = { type: specType, value: specContent };
    this.wrapper.loadSpec(spec);

    this.isActive = true;
  }

  /** Remove the viewer and restore the native code container. */
  showSource(): void {
    this.removeViewer();

    const codeContainer = this.adapter.getCodeContainer();
    if (codeContainer) {
      codeContainer.style.display = "";
    }

    this.isActive = false;
  }

  /**
   * Toggle between viewer and source view.
   * Returns the new active state (`true` = viewer visible).
   */
  toggle(specContent: string): boolean {
    if (this.isActive) {
      this.showSource();
    } else {
      // Fire-and-forget: callers that need to await should use showViewer() directly
      void this.showViewer(specContent);
    }
    return !this.isActive;
  }

  /** Full teardown: destroy wrapper, remove viewer, restore source. */
  cleanup(): void {
    this.removeViewer();

    const codeContainer = this.adapter.getCodeContainer();
    if (codeContainer) {
      codeContainer.style.display = "";
    }

    this.isActive = false;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

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
