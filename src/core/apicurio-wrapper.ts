import type { RepoFilePath } from "../adapters/types";
import { resolveExternalRef, type Platform } from "./ref-resolver";

export interface ApicurioSpec {
  type: "OPENAPI" | "ASYNCAPI";
  value: string;
}

export interface EditingFeatures {
  allowImports: boolean;
  allowCustomValidations: boolean;
}

export interface EditingInfo {
  content: ApicurioSpec;
  features: EditingFeatures;
}

export interface WrapperContext {
  platform: Platform;
  repoFilePath: RepoFilePath | null;
}

const DEFAULT_FEATURES: EditingFeatures = {
  allowImports: false,
  allowCustomValidations: false,
};

export class ApicurioWrapper {
  private iframe: HTMLIFrameElement | null = null;
  private container: HTMLElement;
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private changeCallbacks: Array<(spec: ApicurioSpec) => void> = [];
  private ready: boolean = false;
  private pendingSpec: {
    spec: ApicurioSpec;
    features: EditingFeatures;
  } | null = null;
  private context: WrapperContext | null;

  constructor(container: HTMLElement, context?: WrapperContext) {
    this.container = container;
    this.context = context ?? null;
  }

  init(viewerUrl: string): void {
    if (this.iframe) {
      throw new Error("ApicurioWrapper has already been initialized");
    }

    this.iframe = document.createElement("iframe");
    this.iframe.src = viewerUrl;
    this.iframe.style.width = "100%";
    this.iframe.style.height = "100%";
    this.iframe.style.border = "none";

    this.messageHandler = (event: MessageEvent) => {
      this.handleMessage(event);
    };
    window.addEventListener("message", this.messageHandler);

    this.iframe.addEventListener("load", () => {
      this.ready = true;
      if (this.pendingSpec) {
        this.postEditingInfo(this.pendingSpec.spec, this.pendingSpec.features);
        this.pendingSpec = null;
      }
    });

    this.container.appendChild(this.iframe);
  }

  loadSpec(
    spec: ApicurioSpec,
    features?: Partial<EditingFeatures>
  ): void {
    const resolvedFeatures: EditingFeatures = {
      ...DEFAULT_FEATURES,
      ...features,
    };

    if (!this.iframe) {
      throw new Error("ApicurioWrapper has not been initialized. Call init() first.");
    }

    if (this.ready) {
      this.postEditingInfo(spec, resolvedFeatures);
    } else {
      this.pendingSpec = { spec, features: resolvedFeatures };
    }
  }

  onChange(callback: (spec: ApicurioSpec) => void): void {
    this.changeCallbacks.push(callback);
  }

  destroy(): void {
    if (this.messageHandler) {
      window.removeEventListener("message", this.messageHandler);
      this.messageHandler = null;
    }

    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
    }
    this.iframe = null;

    this.changeCallbacks = [];
    this.ready = false;
    this.pendingSpec = null;
  }

  private postEditingInfo(spec: ApicurioSpec, features: EditingFeatures): void {
    if (!this.iframe?.contentWindow) {
      return;
    }

    const editingInfo = {
      content: spec,
      features,
      openapi: { vendorExtensions: [] },
    };

    this.iframe.contentWindow.postMessage(
      {
        type: "apicurio-editingInfo",
        data: editingInfo,
      },
      "*"
    );
  }

  private handleMessage(event: MessageEvent): void {
    if (typeof event.data !== "object" || event.data === null) {
      return;
    }

    if (event.data.type === "apicurio_fetchContent" && event.data.data) {
      this.handleFetchContent(event.data.data);
      return;
    }

    if (event.data.type !== "apicurio_onChange") {
      return;
    }

    const content = event.data?.data?.content;
    if (!content) {
      return;
    }

    const spec: ApicurioSpec = {
      type: content.type,
      value: typeof content.value === "string"
        ? content.value
        : JSON.stringify(content.value),
    };

    for (const callback of this.changeCallbacks) {
      callback(spec);
    }
  }

  private async handleFetchContent(data: { requestId: string; externalReference: string }): Promise<void> {
    if (!this.iframe?.contentWindow) return;

    const { requestId, externalReference } = data;

    if (!this.context?.repoFilePath) {
      this.iframe.contentWindow.postMessage({
        type: "apicurio_fetchContentError",
        data: { requestId, error: "No repository context available" },
      }, "*");
      return;
    }

    try {
      const rawUrl = resolveExternalRef(
        externalReference,
        this.context.repoFilePath,
        this.context.platform
      );

      const response = await fetch(rawUrl, { signal: AbortSignal.timeout(10000) });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();

      this.iframe.contentWindow.postMessage({
        type: "apicurio_fetchContentResponse",
        data: { requestId, content },
      }, "*");
    } catch (err) {
      this.iframe.contentWindow.postMessage({
        type: "apicurio_fetchContentError",
        data: { requestId, error: String(err) },
      }, "*");
    }
  }
}
