import { SettingsManager } from "../core/settings-manager";

async function init() {
  const settings = await SettingsManager.getAll();

  const autoRender = document.getElementById("autoRender") as HTMLInputElement;
  const githubEnabled = document.getElementById("githubEnabled") as HTMLInputElement;
  const gitlabEnabled = document.getElementById("gitlabEnabled") as HTMLInputElement;
  const theme = document.getElementById("theme") as HTMLSelectElement;

  autoRender.checked = settings.autoRender;
  githubEnabled.checked = settings.githubEnabled;
  gitlabEnabled.checked = settings.gitlabEnabled;
  theme.value = settings.theme;

  autoRender.addEventListener("change", () => {
    SettingsManager.set("autoRender", autoRender.checked);
  });
  githubEnabled.addEventListener("change", () => {
    SettingsManager.set("githubEnabled", githubEnabled.checked);
  });
  gitlabEnabled.addEventListener("change", () => {
    SettingsManager.set("gitlabEnabled", gitlabEnabled.checked);
  });
  theme.addEventListener("change", () => {
    SettingsManager.set("theme", theme.value as "light" | "dark" | "auto");
  });
}

document.addEventListener("DOMContentLoaded", init);
