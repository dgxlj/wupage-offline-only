import { t } from "./i18n";
import type { ExtensionSettings } from "./types";
import { DEFAULT_SELECTION_TRANSLATION } from "./dictionary";
import { DEFAULT_APPEARANCE } from "./appearance";
import { DEFAULT_SHORTCUTS, DEFAULT_SHORTCUT_ENABLED } from "./shortcuts";
import { DEFAULT_LOCAL_SHORTCUTS } from "./local-shortcuts";
import { ELEMENT_EXCLUSION_DEFAULTS_VERSION, normalizeElementExclusions } from "./element-exclusions";

export const DEFAULT_SETTINGS: ExtensionSettings = {
  elementExclusions: normalizeElementExclusions(undefined),
  elementInclusions: [],
  elementExclusionDefaultsVersion: ELEMENT_EXCLUSION_DEFAULTS_VERSION,
  shortcuts: { ...DEFAULT_SHORTCUTS },
  localShortcuts: { ...DEFAULT_LOCAL_SHORTCUTS },
  shortcutEnabled: { ...DEFAULT_SHORTCUT_ENABLED },
  appearance: { ...DEFAULT_APPEARANCE, customSchemes: [] },
  selectionTranslation: { ...DEFAULT_SELECTION_TRANSLATION },
  autoTranslation: { enabled: false, nonTargetLanguage: false, presetSites: [], customSites: [] },
  frameTranslation: { enabled: true, excludeMatches: [] },
  targetLang: "zh-CN",
  sourceLang: "auto",
  activeProviderId: "firefox-local",
  chunkSize: 1200,
  concurrency: 5,
  pdfTranslationPageRadius: 5,
  cacheEnabled: true,
  statisticsEnabled: false,
  floatingBallEnabled: true,
  floatingBallExcludedSites: [],
  contextMenuTranslationEnabled: false,
  imageTranslationEnabled: false,
  imageTranslationContextMenuEnabled: true,
  imageTranslationFloatingEnabled: true,
  translateCodeComments: true,
  translationDisplayMode: "bilingual",
  providers: [{
    type: "firefox-local", id: "firefox-local",
    get label() { return t("firefoxLocalTranslationExperimental"); },
    enabled: true, performanceMode: "custom", chunkSize: 800, concurrency: 1
  }]
};

export const SETTINGS_KEY = "wupage.settings";
export const CACHE_PREFIX = "wupage.cache.";
export const BUILT_IN_PROVIDER_IDS = new Set(
  DEFAULT_SETTINGS.providers.map((provider) => provider.id)
);
