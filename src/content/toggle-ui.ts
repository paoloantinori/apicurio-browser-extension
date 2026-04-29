/**
 * Tab injection UI that adds an "Apicurio" tab alongside native Code/Blame tabs.
 *
 * On GitHub, injects a <li> into the SegmentedControl <ul>. A MutationObserver
 * enforces visual state against React re-renders that would restore native tab
 * attributes. On GitLab, injects a styled button into the file-actions toolbar.
 */

export class ToggleUI {
  private static readonly ACTIVE_CLASS = "apicurio-active";
  private static readonly STYLE_ID = "apicurio-tab-override";

  private tabItem: HTMLElement | null = null;
  private nativeTabCleanup: (() => void) | null = null;
  private observer: MutationObserver | null = null;
  private active: boolean = false;
  private guarding: boolean = false;
  private onClickCallback: ((active: boolean) => void) | null = null;

  /**
   * Injects an "Apicurio" tab into the platform's tab/navigation container.
   */
  mount(tabContainer: HTMLElement, callback: (active: boolean) => void): void {
    this.onClickCallback = callback;

    if (tabContainer.tagName === "UL") {
      this.mountAsSegmentedTab(tabContainer);
    } else {
      this.mountAsButton(tabContainer);
    }
  }

  setActive(isActive: boolean): void {
    this.active = isActive;
    this.applyVisualState();
  }

  destroy(): void {
    this.stopObserver();
    this.removeOverrideStyle();
    this.tabItem?.parentElement?.classList.remove(ToggleUI.ACTIVE_CLASS);
    if (this.nativeTabCleanup) {
      this.nativeTabCleanup();
      this.nativeTabCleanup = null;
    }
    if (this.tabItem && this.tabItem.parentNode) {
      this.tabItem.parentNode.removeChild(this.tabItem);
    }
    this.tabItem = null;
    this.onClickCallback = null;
  }

  // ---------------------------------------------------------------------------
  // GitHub: SegmentedControl tab injection
  // ---------------------------------------------------------------------------

  private mountAsSegmentedTab(tabList: HTMLElement): void {
    // Copy classes from the first existing tab item for visual consistency
    const existingItem = tabList.querySelector("li");
    const itemClass = existingItem?.className ?? "";
    const existingButton = existingItem?.querySelector("button");
    const buttonClass = existingButton?.className ?? "";

    // Create the <li> wrapper
    const li = document.createElement("li");
    li.className = itemClass;
    li.removeAttribute("data-selected");

    // Create the <button>
    const btn = document.createElement("button");
    btn.className = buttonClass;
    btn.setAttribute("aria-current", "false");
    btn.type = "button";

    // Build inner structure matching GitHub's pattern
    const contentSpan = document.createElement("span");
    const contentClass = existingButton?.querySelector("span")?.className ?? "";
    contentSpan.className = contentClass;

    const textDiv = document.createElement("div");
    const textClass =
      existingButton?.querySelector("span > div")?.className ?? "";
    textDiv.className = textClass;
    textDiv.setAttribute("data-text", "Apicurio");
    textDiv.textContent = "Apicurio";

    contentSpan.appendChild(textDiv);
    btn.appendChild(contentSpan);
    li.appendChild(btn);
    tabList.appendChild(li);

    this.tabItem = li;

    // Click on our tab → activate
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!this.active) {
        this.active = true;
        this.applyVisualState();
        this.onClickCallback?.(true);
      }
    });

    // Click on native Code/Blame tabs → deactivate
    const nativeClickHandler = () => {
      if (this.active) {
        this.active = false;
        this.applyVisualState();
        this.onClickCallback?.(false);
      }
    };
    tabList.querySelectorAll("li").forEach((item) => {
      if (item !== li) {
        item.addEventListener("click", nativeClickHandler);
      }
    });

    this.nativeTabCleanup = () => {
      tabList.querySelectorAll("li").forEach((item) => {
        if (item !== li) {
          item.removeEventListener("click", nativeClickHandler);
        }
      });
    };
  }

  /**
   * Apply visual state to all tabs. When active, our tab is selected and
   * native tabs are deselected via CSS overrides (!important beats React).
   */
  private applyVisualState(): void {
    if (!this.tabItem) return;
    this.stopObserver();

    const parent = this.tabItem.parentElement;
    const siblings = parent?.querySelectorAll("li");

    if (this.active) {
      this.selectTab(this.tabItem);
      siblings?.forEach((s) => {
        if (s !== this.tabItem) this.deselectTab(s);
      });
      parent?.classList.add(ToggleUI.ACTIVE_CLASS);
      this.injectOverrideStyle();
      this.startObserver();
    } else {
      parent?.classList.remove(ToggleUI.ACTIVE_CLASS);
      this.removeOverrideStyle();
      this.deselectTab(this.tabItem);
      siblings?.forEach((s) => {
        if (s !== this.tabItem) this.selectTab(s);
      });
    }
  }

  /**
   * Inject a <style> element that forces native tabs to look inactive
   * and our tab to look active, regardless of what React sets.
   * CSS !important always wins over inline styles.
   */
  private injectOverrideStyle(): void {
    if (document.getElementById(ToggleUI.STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = ToggleUI.STYLE_ID;
    const cls = ToggleUI.ACTIVE_CLASS;
    style.textContent = `
      /* Force native tabs inactive when Apicurio is active */
      ul.${cls} > li:not(:last-child) > button {
        background-color: transparent !important;
        color: var(--fgColor-muted, #656d76) !important;
        --separator-color: var(--borderColor-default, #d0d7de) !important;
      }
      /* Force our tab active */
      ul.${cls} > li:last-child > button {
        background-color: var(--control-transparent-bgColor-selected, rgba(175,184,193,0.2)) !important;
        color: var(--fgColor-default, #1f2328) !important;
        font-weight: 600 !important;
        --separator-color: transparent !important;
      }
    `;
    document.head.appendChild(style);
  }

  private removeOverrideStyle(): void {
    document.getElementById(ToggleUI.STYLE_ID)?.remove();
  }

  private selectTab(li: Element): void {
    li.setAttribute("data-selected", "");
    const btn = li.querySelector("button");
    if (btn) {
      btn.setAttribute("aria-current", "true");
    }
  }

  private deselectTab(li: Element): void {
    li.removeAttribute("data-selected");
    const btn = li.querySelector("button");
    if (btn) {
      btn.setAttribute("aria-current", "false");
    }
  }

  /**
   * Watch for React re-renders that restore native tab attributes and
   * immediately revert them to keep our tab visually selected.
   */
  private startObserver(): void {
    const parent = this.tabItem?.parentElement;
    if (!parent) return;

    this.observer = new MutationObserver(() => {
      if (!this.active || !this.tabItem || this.guarding) return;
      this.guarding = true;
      try {
        const siblings = parent.querySelectorAll("li");
        siblings.forEach((s) => {
          if (s !== this.tabItem && s.hasAttribute("data-selected")) {
            this.deselectTab(s);
          }
        });
      } finally {
        this.guarding = false;
      }
    });

    this.observer.observe(parent, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-selected", "aria-current"],
    });
  }

  private stopObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  // ---------------------------------------------------------------------------
  // GitLab: styled button fallback
  // ---------------------------------------------------------------------------

  private mountAsButton(toolbar: HTMLElement): void {
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });

    const button = document.createElement("button");
    button.setAttribute("aria-label", "Toggle API viewer");
    button.setAttribute("aria-pressed", "false");
    button.textContent = "Apicurio";

    const style = document.createElement("style");
    style.textContent = `
      button {
        padding: 4px 12px;
        border-radius: 4px;
        font-size: 13px;
        cursor: pointer;
        border: 1px solid #d0d7de;
        background: white;
        color: #24292f;
        margin-left: 8px;
      }
      button.active {
        border: 1px solid #0969da;
        background: #0969da;
        color: white;
      }
      button:focus-visible {
        outline: 2px solid #0969da;
        outline-offset: 2px;
      }
    `;

    button.addEventListener("click", () => {
      this.active = !this.active;
      button.classList.toggle("active", this.active);
      button.setAttribute("aria-pressed", String(this.active));
      button.textContent = this.active ? "Show Source" : "Apicurio";
      this.onClickCallback?.(this.active);
    });

    shadow.appendChild(style);
    shadow.appendChild(button);
    toolbar.appendChild(host);

    this.tabItem = host;
  }
}
