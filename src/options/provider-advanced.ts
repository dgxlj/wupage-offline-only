import type { ProviderConfig } from "../shared/types";
export function setupProviderTabs(container: HTMLElement, _provider: ProviderConfig): void {
  // Offline Bergamot has no API key, remote endpoint, custom prompt or request template.
  const panel = document.createElement("div");
  panel.className = "provider-tab-panel";
  panel.append(...container.childNodes);
  container.append(panel);
}
export function readRequestTemplate(_container: HTMLElement): undefined { return undefined; }
