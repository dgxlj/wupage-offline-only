import type { ProviderConfig, TranslatorProvider } from "../shared/types";
import { translateLocally } from "./local";

/** This edition has exactly one translation provider: local Bergamot. */
export function createProvider(config: ProviderConfig): TranslatorProvider {
  if (config.type !== "firefox-local") throw new Error("Only the offline Bergamot translator is supported.");
  return {
    id: config.id,
    label: config.label,
    validateConfig: () => ({ ok: true }),
    translateBatch: translateLocally
  };
}
