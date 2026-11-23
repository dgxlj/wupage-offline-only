import { INTERFACE_LANGUAGE_KEY, type InterfaceLanguage } from "./i18n";
import { DEFAULT_SETTINGS, SETTINGS_KEY } from "./defaults";
import { normalizeAutoTranslation, normalizeExcludedSites } from "./auto-translation";
import { normalizeSelectionTranslation } from "./dictionary";
import { normalizeAppearance } from "./appearance";
import { normalizeShortcutEnabled, normalizeShortcuts } from "./shortcuts";
import { normalizeLocalShortcuts } from "./local-shortcuts";
import { normalizeVideoTranslation } from "./video";
import type { ExtensionSettings } from "./types";
import { normalizeFrameTranslation } from "./frame-session";
import { ELEMENT_EXCLUSION_DEFAULTS_VERSION, migrateElementExclusionDefaults, normalizeElementInclusions } from "./element-exclusions";

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(result[SETTINGS_KEY]);
}

let pendingWrite: Promise<unknown> = Promise.resolve();

/** Resolve updates against the latest value inside one shared write queue. */
export function saveSettings(
  update: ExtensionSettings | ((latest: ExtensionSettings) => ExtensionSettings | Promise<ExtensionSettings>),
  interfaceLanguage?: InterfaceLanguage
): Promise<ExtensionSettings> {
  const write = pendingWrite.catch(() => undefined).then(async () => {
    const settings = normalizeSettings(typeof update === "function" ? await update(await getSettings()) : update);
    await chrome.storage.local.set({
      [SETTINGS_KEY]: settings,
      ...(interfaceLanguage === undefined ? {} : { [INTERFACE_LANGUAGE_KEY]: interfaceLanguage })
    });
    return settings;
  });
  pendingWrite = write;
  return write;
}

/** Migrate old WuPage settings into an offline-only, credential-free configuration. */
export function normalizeSettings(value: unknown): ExtensionSettings {
  const input = isRecord(value) ? value : {};
  // Exclude obsolete secret-bearing fields before spreading user preferences.
  const { providers: _unusedProviders, activeProviderId: _unusedProviderId,
    ocr: _unusedOcr, ...preferences } = input;
  void _unusedProviders; void _unusedProviderId; void _unusedOcr;
  const chunkSize = clampNumber(preferences.chunkSize, 200, 4000, DEFAULT_SETTINGS.chunkSize);
  const concurrency = clampNumber(preferences.concurrency, 1, 8, DEFAULT_SETTINGS.concurrency);
  return {
    ...DEFAULT_SETTINGS,
    ...preferences,
    videoTranslation: { ...normalizeVideoTranslation(preferences.videoTranslation), enabled: false },
    providers: DEFAULT_SETTINGS.providers.map(p => ({ ...p, enabled: true })),
    activeProviderId: "firefox-local",
    ocr: { mode: "builtin", endpoint: "", model: "", apiKey: "", modelRevision: "1" },
    elementExclusions: migrateElementExclusionDefaults(preferences.elementExclusions, preferences.elementExclusionDefaultsVersion),
    elementInclusions: normalizeElementInclusions(preferences.elementInclusions),
    elementExclusionDefaultsVersion: ELEMENT_EXCLUSION_DEFAULTS_VERSION,
    shortcuts: normalizeShortcuts(preferences.shortcuts),
    localShortcuts: normalizeLocalShortcuts(preferences.localShortcuts),
    shortcutEnabled: normalizeShortcutEnabled(preferences.shortcutEnabled, preferences.shortcuts, preferences.localShortcuts),
    appearance: normalizeAppearance(preferences.appearance),
    autoTranslation: normalizeAutoTranslation(preferences.autoTranslation),
    floatingBallExcludedSites: normalizeExcludedSites(preferences.floatingBallExcludedSites),
    frameTranslation: normalizeFrameTranslation(preferences.frameTranslation),
    selectionTranslation: normalizeSelectionTranslation(preferences.selectionTranslation),
    targetLang: readString(preferences.targetLang, DEFAULT_SETTINGS.targetLang),
    sourceLang: readString(preferences.sourceLang, DEFAULT_SETTINGS.sourceLang),
    chunkSize, concurrency,
    pdfTranslationPageRadius: preferences.pdfTranslationPageRadius === null ? null
      : clampNumber(preferences.pdfTranslationPageRadius, 0, 1000, DEFAULT_SETTINGS.pdfTranslationPageRadius!),
    cacheEnabled: typeof preferences.cacheEnabled === "boolean" ? preferences.cacheEnabled : DEFAULT_SETTINGS.cacheEnabled,
    floatingBallEnabled: typeof preferences.floatingBallEnabled === "boolean" ? preferences.floatingBallEnabled : DEFAULT_SETTINGS.floatingBallEnabled,
    translateCodeComments: typeof preferences.translateCodeComments === "boolean" ? preferences.translateCodeComments : DEFAULT_SETTINGS.translateCodeComments,
    imageTranslationEnabled: preferences.imageTranslationEnabled === true,
    imageTranslationContextMenuEnabled: preferences.imageTranslationContextMenuEnabled !== false,
    imageTranslationFloatingEnabled: preferences.imageTranslationFloatingEnabled !== false,
    statisticsEnabled: preferences.statisticsEnabled === true,
    contextMenuTranslationEnabled: preferences.contextMenuTranslationEnabled === true,
    translationDisplayMode: isTranslationDisplayMode(preferences.translationDisplayMode)
      ? preferences.translationDisplayMode : DEFAULT_SETTINGS.translationDisplayMode
  };
}

function isTranslationDisplayMode(value: unknown): value is ExtensionSettings["translationDisplayMode"] {
  return value === "replace" || value === "bilingual" || value === "bilingual-accent";
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
