import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SaveToolbar } from "../src/content/save-toolbar";

describe("SaveToolbar", () => {
  let toolbar: SaveToolbar;
  let createElementCalls: any[];
  let savedDocument: any;

  beforeEach(() => {
    toolbar = new SaveToolbar();
    createElementCalls = [];

    const createEl = (tag: string) => {
      const el: any = {
        tagName: tag.toUpperCase(),
        style: {},
        appendChild: vi.fn(),
        addEventListener: vi.fn(),
        remove: vi.fn(),
        setAttribute: vi.fn(),
        className: "",
        textContent: "",
        disabled: false,
        type: "",
        id: "",
      };
      createElementCalls.push(el);
      return el;
    };

    savedDocument = globalThis.document;

    globalThis.document = {
      createElement: vi.fn(createEl),
      getElementById: vi.fn().mockReturnValue(null),
      head: { appendChild: vi.fn() },
    } as any;
  });

  afterEach(() => {
    globalThis.document = savedDocument;
  });

  // Helper: mount and find the save button element
  function mountAndFindButton(): any {
    const parent = { insertBefore: vi.fn(), firstChild: null } as any;
    toolbar.mount(parent, vi.fn().mockResolvedValue({ success: true }));
    // Find the button: it's the element that registered a 'click' listener
    return createElementCalls.find(
      (el: any) => el.addEventListener.mock.calls.some(
        (call: any[]) => call[0] === "click"
      )
    );
  }

  // Helper: find the status text element
  function findStatusText(): any {
    return createElementCalls.find(
      (el: any) =>
        el.className.includes("apicurio-status-text") &&
        el.addEventListener.mock.calls.length === 0
    );
  }

  // ── mount ──────────────────────────────────────────────────────────────────

  describe("mount()", () => {
    it("creates a container, status text, and save button", () => {
      const parent = { insertBefore: vi.fn(), firstChild: null } as any;
      toolbar.mount(parent, vi.fn().mockResolvedValue({ success: true }));

      // injectStyles creates a <style>, then mount creates <div>, <span>, <button>
      expect(createElementCalls.length).toBeGreaterThanOrEqual(3);

      // Find the container (id set after creation)
      const container = createElementCalls.find((el: any) =>
        el.id === "apicurio-save-toolbar"
      );
      expect(container).toBeTruthy();
      expect(container.appendChild).toHaveBeenCalledTimes(2); // statusText + button

      expect(parent.insertBefore).toHaveBeenCalledWith(
        container,
        null
      );
    });
  });

  // ── setStatus ──────────────────────────────────────────────────────────────

  describe("setStatus()", () => {
    it("shows dirty state with enabled save button", () => {
      const button = mountAndFindButton();
      toolbar.setStatus("dirty");

      expect(button.disabled).toBe(false);
      expect(button.textContent).toBe("Save");
      expect(button.className).toContain("--primary");
    });

    it("shows saving state with disabled button", () => {
      const button = mountAndFindButton();
      toolbar.setStatus("saving");

      expect(button.disabled).toBe(true);
      expect(button.textContent).toBe("Saving...");
      expect(button.className).toContain("--saving");
    });

    it("shows success state with disabled button", () => {
      const button = mountAndFindButton();
      toolbar.setStatus("success");

      expect(button.disabled).toBe(true);
      expect(button.textContent).toBe("Saved");
      expect(button.className).toContain("--success");
    });

    it("shows error state with enabled retry button", () => {
      const button = mountAndFindButton();
      toolbar.setStatus("error", "Token expired");

      expect(button.disabled).toBe(false);
      expect(button.textContent).toBe("Retry");
      expect(button.className).toContain("--error");
    });

    it("shows 'Save failed' as default error message", () => {
      mountAndFindButton();
      toolbar.setStatus("error");

      const statusText = findStatusText();
      expect(statusText).toBeTruthy();
      expect(statusText.textContent).toBe("Save failed");
    });

    it("shows custom error message", () => {
      mountAndFindButton();
      toolbar.setStatus("error", "Network error");

      const statusText = findStatusText();
      expect(statusText.textContent).toBe("Network error");
    });

    it("resets to idle with disabled button", () => {
      const button = mountAndFindButton();
      toolbar.setStatus("dirty");
      toolbar.setStatus("idle");

      expect(button.disabled).toBe(true);
      expect(button.textContent).toBe("Save");
      expect(button.className).toBe("apicurio-save-btn");
    });
  });

  // ── destroy ────────────────────────────────────────────────────────────────

  describe("destroy()", () => {
    it("does not throw after mount", () => {
      const parent = { insertBefore: vi.fn(), firstChild: null } as any;
      toolbar.mount(parent, vi.fn().mockResolvedValue({ success: true }));
      expect(() => toolbar.destroy()).not.toThrow();
    });

    it("does not throw without mount", () => {
      expect(() => toolbar.destroy()).not.toThrow();
    });

    it("does not throw when called twice", () => {
      const parent = { insertBefore: vi.fn(), firstChild: null } as any;
      toolbar.mount(parent, vi.fn().mockResolvedValue({ success: true }));
      toolbar.destroy();
      expect(() => toolbar.destroy()).not.toThrow();
    });
  });
});
