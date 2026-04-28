import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApicurioWrapper } from "../src/core/apicurio-wrapper";

describe("ApicurioWrapper", () => {
  let wrapper: ApicurioWrapper;
  let mockContainer: { appendChild: ReturnType<typeof vi.fn>; removeChild: ReturnType<typeof vi.fn> };
  let mockIframe: any;
  let savedDocument: any;
  let savedWindow: any;
  let createElementMock: ReturnType<typeof vi.fn>;
  let windowAddEventListenerMock: ReturnType<typeof vi.fn>;
  let windowRemoveEventListenerMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockContainer = {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    };

    mockIframe = {
      style: {},
      src: "",
      contentWindow: { postMessage: vi.fn() },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      parentNode: mockContainer,
    };

    createElementMock = vi.fn().mockReturnValue(mockIframe);
    windowAddEventListenerMock = vi.fn();
    windowRemoveEventListenerMock = vi.fn();

    savedDocument = globalThis.document;
    savedWindow = globalThis.window;

    globalThis.document = { createElement: createElementMock } as any;
    globalThis.window = {
      addEventListener: windowAddEventListenerMock,
      removeEventListener: windowRemoveEventListenerMock,
    } as any;

    wrapper = new ApicurioWrapper(mockContainer as any);
  });

  afterEach(() => {
    wrapper.destroy();
    globalThis.document = savedDocument;
    globalThis.window = savedWindow;
  });

  // ---- init ----

  describe("init()", () => {
    it("creates an iframe and appends it to the container", () => {
      wrapper.init("https://viewer.example.com");

      expect(createElementMock).toHaveBeenCalledWith("iframe");
      expect(mockContainer.appendChild).toHaveBeenCalledWith(mockIframe);
      expect(mockIframe.src).toBe("https://viewer.example.com");
      expect(mockIframe.style.width).toBe("100%");
      expect(mockIframe.style.height).toBe("100%");
      expect(mockIframe.style.border).toBe("none");
    });

    it("registers a message event listener on window", () => {
      wrapper.init("https://viewer.example.com");

      expect(windowAddEventListenerMock).toHaveBeenCalledWith("message", expect.any(Function));
    });

    it("throws if called twice", () => {
      wrapper.init("https://viewer.example.com");
      expect(() => wrapper.init("https://viewer.example.com")).toThrow(
        "ApicurioWrapper has already been initialized"
      );
    });
  });

  // ---- loadSpec ----

  describe("loadSpec()", () => {
    it("throws if init() has not been called", () => {
      expect(() =>
        wrapper.loadSpec({ type: "OPENAPI", value: "{}" })
      ).toThrow("ApicurioWrapper has not been initialized. Call init() first.");
    });

    it("posts editing info via postMessage when iframe is ready", () => {
      wrapper.init("https://viewer.example.com");

      // Simulate iframe load event -> marks ready
      const loadHandler = mockIframe.addEventListener.mock.calls.find(
        (call: any[]) => call[0] === "load"
      )?.[1] as Function;
      loadHandler();

      const spec = { type: "OPENAPI" as const, value: '{"openapi":"3.0.0"}' };
      wrapper.loadSpec(spec);

      expect(mockIframe.contentWindow.postMessage).toHaveBeenCalledWith(
        {
          type: "apicurio-editingInfo",
          data: {
            content: spec,
            features: { allowImports: false, allowCustomValidations: false },
          },
        },
        "*"
      );
    });

    it("queues spec if iframe is not ready yet, sends on load", () => {
      wrapper.init("https://viewer.example.com");

      // Load spec before iframe is ready
      const spec = { type: "OPENAPI" as const, value: '{"openapi":"3.0.0"}' };
      wrapper.loadSpec(spec);

      // Not posted yet since iframe not ready
      expect(mockIframe.contentWindow.postMessage).not.toHaveBeenCalled();

      // Simulate iframe load -> should flush pending spec
      const loadHandler = mockIframe.addEventListener.mock.calls.find(
        (call: any[]) => call[0] === "load"
      )?.[1] as Function;
      loadHandler();

      expect(mockIframe.contentWindow.postMessage).toHaveBeenCalledWith(
        {
          type: "apicurio-editingInfo",
          data: {
            content: spec,
            features: { allowImports: false, allowCustomValidations: false },
          },
        },
        "*"
      );
    });

    it("merges partial features with defaults", () => {
      wrapper.init("https://viewer.example.com");

      const loadHandler = mockIframe.addEventListener.mock.calls.find(
        (call: any[]) => call[0] === "load"
      )?.[1] as Function;
      loadHandler();

      const spec = { type: "OPENAPI" as const, value: "{}" };
      wrapper.loadSpec(spec, { allowImports: true });

      expect(mockIframe.contentWindow.postMessage).toHaveBeenCalledWith(
        {
          type: "apicurio-editingInfo",
          data: {
            content: spec,
            features: { allowImports: true, allowCustomValidations: false },
          },
        },
        "*"
      );
    });
  });

  // ---- onChange ----

  describe("onChange()", () => {
    it("fires callback when apicurio_onChange message is received", () => {
      wrapper.init("https://viewer.example.com");

      const callback = vi.fn();
      wrapper.onChange(callback);

      // Get the message handler registered on window
      const messageHandler = windowAddEventListenerMock.mock.calls.find(
        (call: any[]) => call[0] === "message"
      )?.[1] as Function;

      // Simulate a message event
      messageHandler({
        data: {
          type: "apicurio_onChange",
          data: {
            content: {
              type: "OPENAPI",
              value: '{"openapi":"3.0.0"}',
            },
          },
        },
      });

      expect(callback).toHaveBeenCalledWith({
        type: "OPENAPI",
        value: '{"openapi":"3.0.0"}',
      });
    });

    it("ignores messages with wrong type", () => {
      wrapper.init("https://viewer.example.com");

      const callback = vi.fn();
      wrapper.onChange(callback);

      const messageHandler = windowAddEventListenerMock.mock.calls.find(
        (call: any[]) => call[0] === "message"
      )?.[1] as Function;

      messageHandler({
        data: { type: "something_else" },
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it("ignores messages with null data", () => {
      wrapper.init("https://viewer.example.com");

      const callback = vi.fn();
      wrapper.onChange(callback);

      const messageHandler = windowAddEventListenerMock.mock.calls.find(
        (call: any[]) => call[0] === "message"
      )?.[1] as Function;

      messageHandler({ data: null });

      expect(callback).not.toHaveBeenCalled();
    });

    it("stringifies non-string value in onChange payload", () => {
      wrapper.init("https://viewer.example.com");

      const callback = vi.fn();
      wrapper.onChange(callback);

      const messageHandler = windowAddEventListenerMock.mock.calls.find(
        (call: any[]) => call[0] === "message"
      )?.[1] as Function;

      const objValue = { openapi: "3.0.0" };
      messageHandler({
        data: {
          type: "apicurio_onChange",
          data: {
            content: {
              type: "OPENAPI",
              value: objValue,
            },
          },
        },
      });

      expect(callback).toHaveBeenCalledWith({
        type: "OPENAPI",
        value: JSON.stringify(objValue),
      });
    });
  });

  // ---- destroy ----

  describe("destroy()", () => {
    it("removes the message event listener from window", () => {
      wrapper.init("https://viewer.example.com");

      const messageHandler = windowAddEventListenerMock.mock.calls.find(
        (call: any[]) => call[0] === "message"
      )?.[1];

      wrapper.destroy();

      expect(windowRemoveEventListenerMock).toHaveBeenCalledWith("message", messageHandler);
    });

    it("removes the iframe from its parent", () => {
      wrapper.init("https://viewer.example.com");

      wrapper.destroy();

      expect(mockContainer.removeChild).toHaveBeenCalledWith(mockIframe);
    });

    it("does not call removeChild if iframe has no parent", () => {
      wrapper.init("https://viewer.example.com");
      mockIframe.parentNode = null;

      // Should not throw
      wrapper.destroy();
      expect(mockContainer.removeChild).not.toHaveBeenCalled();
    });

    it("clears change callbacks so onChange no longer fires", () => {
      wrapper.init("https://viewer.example.com");

      const callback = vi.fn();
      wrapper.onChange(callback);

      wrapper.destroy();

      // Callback was never called since no messages were sent
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
