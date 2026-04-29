export type SaveStatus = "idle" | "dirty" | "saving" | "success" | "error";

export interface SaveResult {
  success: boolean;
  commitUrl?: string;
  error?: string;
}

export class SaveToolbar {
  private static readonly TOOLBAR_ID = "apicurio-save-toolbar";
  private static readonly STYLE_ID = "apicurio-save-toolbar-style";

  private container: HTMLElement | null = null;
  private saveButton: HTMLButtonElement | null = null;
  private statusText: HTMLElement | null = null;
  private status: SaveStatus = "idle";
  private onSaveCallback: (() => Promise<SaveResult>) | null = null;
  private successTimer: ReturnType<typeof setTimeout> | null = null;

  mount(parent: HTMLElement, onSave: () => Promise<SaveResult>): void {
    this.onSaveCallback = onSave;
    this.injectStyles();

    this.container = document.createElement("div");
    this.container.id = SaveToolbar.TOOLBAR_ID;

    this.statusText = document.createElement("span");
    this.statusText.className = "apicurio-status-text";
    this.container.appendChild(this.statusText);

    this.saveButton = document.createElement("button");
    this.saveButton.type = "button";
    this.saveButton.className = "apicurio-save-btn";
    this.saveButton.textContent = "Save";
    this.saveButton.disabled = true;
    this.saveButton.addEventListener("click", () => this.handleSave());
    this.container.appendChild(this.saveButton);

    parent.insertBefore(this.container, parent.firstChild);
    this.updateUI();
  }

  setStatus(status: SaveStatus, errorMessage?: string): void {
    this.status = status;
    this.updateUI(errorMessage);
  }

  destroy(): void {
    if (this.successTimer !== null) {
      clearTimeout(this.successTimer);
      this.successTimer = null;
    }
    this.container?.remove();
    document.getElementById(SaveToolbar.STYLE_ID)?.remove();
    this.container = null;
    this.saveButton = null;
    this.statusText = null;
    this.onSaveCallback = null;
  }

  private async handleSave(): Promise<void> {
    if (!this.onSaveCallback || this.status === "saving") return;

    this.setStatus("saving");
    try {
      const result = await this.onSaveCallback();
      if (result.success) {
        this.setStatus("success");
        this.successTimer = setTimeout(() => {
          this.successTimer = null;
          if (this.status === "success") this.setStatus("idle");
        }, 3000);
      } else {
        this.setStatus("error", result.error);
      }
    } catch (err) {
      this.setStatus("error", String(err));
    }
  }

  private updateUI(errorMessage?: string): void {
    if (!this.saveButton || !this.statusText) return;

    switch (this.status) {
      case "idle":
        this.saveButton.disabled = true;
        this.saveButton.textContent = "Save";
        this.saveButton.className = "apicurio-save-btn";
        this.statusText.textContent = "";
        this.statusText.className = "apicurio-status-text";
        break;
      case "dirty":
        this.saveButton.disabled = false;
        this.saveButton.textContent = "Save";
        this.saveButton.className = "apicurio-save-btn apicurio-save-btn--primary";
        this.statusText.textContent = "Unsaved changes";
        this.statusText.className = "apicurio-status-text apicurio-status-text--dirty";
        break;
      case "saving":
        this.saveButton.disabled = true;
        this.saveButton.textContent = "Saving...";
        this.saveButton.className = "apicurio-save-btn apicurio-save-btn--saving";
        this.statusText.textContent = "";
        this.statusText.className = "apicurio-status-text";
        break;
      case "success":
        this.saveButton.disabled = true;
        this.saveButton.textContent = "Saved";
        this.saveButton.className = "apicurio-save-btn apicurio-save-btn--success";
        this.statusText.textContent = "";
        this.statusText.className = "apicurio-status-text";
        break;
      case "error":
        this.saveButton.disabled = false;
        this.saveButton.textContent = "Retry";
        this.saveButton.className = "apicurio-save-btn apicurio-save-btn--error";
        this.statusText.textContent = errorMessage ?? "Save failed";
        this.statusText.className = "apicurio-status-text apicurio-status-text--error";
        break;
    }
  }

  private injectStyles(): void {
    if (document.getElementById(SaveToolbar.STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = SaveToolbar.STYLE_ID;
    style.textContent = `
      #apicurio-save-toolbar {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        padding: 8px 12px;
        background: var(--bgColor-default, #fff);
        border-bottom: 1px solid var(--borderColor-default, #d0d7de);
        border-radius: 6px 6px 0 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        font-size: 13px;
        margin-bottom: 0;
      }
      .apicurio-status-text {
        font-size: 12px;
        color: var(--fgColor-muted, #656d76);
      }
      .apicurio-status-text--dirty {
        color: var(--fgColor-attention, #9a6700);
      }
      .apicurio-status-text--error {
        color: var(--fgColor-danger, #cf222e);
      }
      .apicurio-save-btn {
        padding: 4px 16px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid var(--borderColor-default, #d0d7de);
        background: var(--bgColor-default, #f6f8fa);
        color: var(--fgColor-muted, #656d76);
        transition: all 0.15s ease;
      }
      .apicurio-save-btn:disabled {
        cursor: default;
        opacity: 0.6;
      }
      .apicurio-save-btn--primary {
        background: var(--bgColor-success-emphasis, #1a7f37);
        color: #fff;
        border-color: var(--bgColor-success-emphasis, #1a7f37);
      }
      .apicurio-save-btn--primary:hover:not(:disabled) {
        background: var(--bgColor-success-emphasis, #0e5c24);
      }
      .apicurio-save-btn--saving {
        background: var(--bgColor-accent-emphasis, #0969da);
        color: #fff;
        border-color: var(--bgColor-accent-emphasis, #0969da);
        opacity: 0.8;
      }
      .apicurio-save-btn--success {
        background: var(--bgColor-success-emphasis, #1a7f37);
        color: #fff;
        border-color: var(--bgColor-success-emphasis, #1a7f37);
      }
      .apicurio-save-btn--error {
        background: var(--bgColor-danger-emphasis, #cf222e);
        color: #fff;
        border-color: var(--bgColor-danger-emphasis, #cf222e);
      }
      .apicurio-save-btn--error:hover:not(:disabled) {
        background: var(--bgColor-danger-emphasis, #a40e26);
      }
      /* Dark mode support via GitHub's CSS variables */
      @media (prefers-color-scheme: dark) {
        .apicurio-save-btn {
          background: var(--bgColor-default, #21262d);
          color: var(--fgColor-muted, #8b949e);
          border-color: var(--borderColor-default, #30363d);
        }
      }
    `;
    document.head.appendChild(style);
  }
}
