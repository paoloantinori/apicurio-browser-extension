/**
 * Toggle button injected via Shadow DOM for CSS isolation.
 *
 * Provides a "Show API View" / "Show Source" toggle that signals the
 * content script controller to switch between the native code view
 * and the Apicurio viewer.
 */
export class ToggleUI {
  private host: HTMLDivElement | null = null;
  private button: HTMLButtonElement | null = null;
  private active: boolean = false;
  private onClickCallback: ((active: boolean) => void) | null = null;

  /**
   * Creates and mounts the toggle button inside the toolbar element.
   * The button is wrapped in a Shadow DOM host to prevent style leakage.
   */
  mount(toolbar: HTMLElement, callback: (active: boolean) => void): void {
    this.onClickCallback = callback;

    this.host = document.createElement("div");
    const shadow = this.host.attachShadow({ mode: "open" });

    this.button = document.createElement("button");
    this.button.setAttribute("aria-label", "Toggle API viewer");
    this.button.setAttribute("aria-pressed", "false");
    this.applyInactiveStyles();

    this.button.addEventListener("click", () => {
      this.active = !this.active;
      this.updateVisualState();
      this.onClickCallback?.(this.active);
    });

    // Focus ring via outline (works across browsers without outline:none reset)
    const style = document.createElement("style");
    style.textContent = `
      button:focus-visible {
        outline: 2px solid #0969da;
        outline-offset: 2px;
      }
    `;

    shadow.appendChild(style);
    shadow.appendChild(this.button);
    toolbar.appendChild(this.host);
  }

  /** Programmatically set the active state (e.g. after external toggle). */
  setActive(isActive: boolean): void {
    this.active = isActive;
    this.updateVisualState();
  }

  /** Remove the host element from the DOM. */
  destroy(): void {
    if (this.host && this.host.parentNode) {
      this.host.parentNode.removeChild(this.host);
    }
    this.host = null;
    this.button = null;
    this.onClickCallback = null;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private static BASE_STYLE: Record<string, string> = {
    padding: "4px 12px",
    borderRadius: "4px",
    fontSize: "13px",
    cursor: "pointer",
  };

  private updateVisualState(): void {
    if (!this.button) return;

    this.button.setAttribute("aria-pressed", String(this.active));
    Object.assign(this.button.style, ToggleUI.BASE_STYLE);

    if (this.active) {
      this.button.textContent = "Show Source";
      Object.assign(this.button.style, {
        border: "1px solid #0969da",
        background: "#0969da",
        color: "white",
      });
    } else {
      this.button.textContent = "Show API View";
      Object.assign(this.button.style, {
        border: "1px solid #d0d7de",
        background: "white",
        color: "#24292f",
      });
    }
  }

  private applyInactiveStyles(): void {
    if (!this.button) return;
    Object.assign(this.button.style, ToggleUI.BASE_STYLE, {
      border: "1px solid #d0d7de",
      background: "white",
      color: "#24292f",
    });
  }

  private applyActiveStyles(): void {
    if (!this.button) return;
    Object.assign(this.button.style, ToggleUI.BASE_STYLE, {
      border: "1px solid #0969da",
      background: "#0969da",
      color: "white",
    });
  }
}
