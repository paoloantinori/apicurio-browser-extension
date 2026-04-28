import browser from "webextension-polyfill";

export interface ExtensionSettings {
  autoRender: boolean;
  theme: "light" | "dark" | "auto";
  githubEnabled: boolean;
  gitlabEnabled: boolean;
}

const DEFAULTS: Readonly<ExtensionSettings> = {
  autoRender: true,
  theme: "auto",
  githubEnabled: true,
  gitlabEnabled: true,
};

export class SettingsManager {
  static getDefaults(): ExtensionSettings {
    return { ...DEFAULTS };
  }

  static async getAll(): Promise<ExtensionSettings> {
    const stored = await browser.storage.sync.get(null);
    return { ...DEFAULTS, ...stored };
  }

  static async get<K extends keyof ExtensionSettings>(
    key: K
  ): Promise<ExtensionSettings[K]> {
    const result = await browser.storage.sync.get(key);
    return result[key] as ExtensionSettings[K] ?? DEFAULTS[key];
  }

  static async set<K extends keyof ExtensionSettings>(
    key: K,
    value: ExtensionSettings[K]
  ): Promise<void> {
    await browser.storage.sync.set({ [key]: value });
  }

  static onChange(
    callback: (settings: ExtensionSettings) => void
  ): () => void {
    const listener = (
      changes: { [key: string]: browser.Storage.StorageChange },
      areaName: string
    ) => {
      if (areaName !== "sync") {
        return;
      }
      SettingsManager.getAll().then(callback);
    };

    browser.storage.onChanged.addListener(listener);
    return () => {
      browser.storage.onChanged.removeListener(listener);
    };
  }
}
