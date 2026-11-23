import { initializeInterfaceLanguage, t, watchInterfaceLanguage } from "../shared/i18n";
import { getSettings, saveSettings } from "../shared/settings";
import { DEFAULT_SETTINGS } from "../shared/defaults";
import { mergeSettingsChanges } from "../shared/settings-changes";
import { importSettingsBackup } from "./settings-backup";
import { clearStatistics, getStatistics, initStatistics, statisticsPageKey } from "./statistics";
import type { RuntimeRequest, RuntimeResponse } from "../shared/types";
import { createProvider } from "./providers";
import { loadImageData, translateImageWithSettings } from "./image-translation";
import { getTranslationDebugSnapshot, translateWithSettings } from "./translation";
import { clearTranslationCache, currentCacheGeneration, initTranslationCache } from "./translation-cache";
import { getOcrStatus, requestOcr } from "./ocr";
import { initOcrService, ocrRevision } from "./ocr-service";
import { normalizeOcrSettings, ocrSettingsIdentity } from "../shared/ocr-service";
import { initImageContextMenu, refreshImageContextMenu } from "./image-context-menu";
import { initPageContextMenu, refreshPageContextMenu } from "./page-context-menu";
import { requestLocal } from "./local";

import { runtimeErrorResponse } from "../shared/errors";
import { frameSessions } from "./frame-sessions";
import type { FrameSessionRequest } from "../shared/frame-session";
import { readParagraphMode } from "../shared/paragraph-mode";
import { saveParagraphMode } from "./paragraph-mode";

import { installPdfTranslation } from "./pdf-translation";
import { installPdfNavigation } from "./pdf-navigation";

installPdfNavigation();
installPdfTranslation(async (request, sender, signal) => {
  const cacheGeneration = currentCacheGeneration();
  await initializeInterfaceLanguage();
  return translateWithSettings(await getSettings(), request, { signal, statisticsPageKey: statisticsPageKey(sender), cacheGeneration });
});

chrome.runtime.onMessage.addListener((request: RuntimeRequest, sender, sendResponse) => {
  if ("target" in request) return;
  handleMessage(request, sender)
    .then((data): RuntimeResponse => ({ ok: true, data }))
    .catch(runtimeErrorResponse)
    .then(sendResponse);

  return true;
});

try { frameSessions.install(); }
catch (error) { console.warn("WuPage frame integration:", error); }
initStatistics();
initTranslationCache();
initOcrService();
// Permanently strip credentials and previously configured network translators from existing settings.
void saveSettings(latest => latest).catch(error => console.warn("Offline settings migration:", error));

// Auxiliary browser integrations must not prevent settings and translation
// messages from being handled when a Chromium fork lacks one of these APIs.
try {
  initImageContextMenu();
} catch (error: unknown) {
  console.warn("WuPage image menu:", error);
}
try {
  initPageContextMenu();
} catch (error: unknown) {
  console.warn("WuPage page menu:", error);
}
watchInterfaceLanguage(() => {
  void refreshImageContextMenu().catch(error => console.warn("WuPage image menu:", error));
  void refreshPageContextMenu().catch(error => console.warn("WuPage page menu:", error));
});

async function handleMessage(request: RuntimeRequest, sender: chrome.runtime.MessageSender): Promise<unknown> {
  const cacheGeneration = currentCacheGeneration();
  await initializeInterfaceLanguage();
  if (isFrameRequest(request)) return frameSessions.handle(request, sender);
  switch (request.type) {
    case "GET_PARAGRAPH_MODE":
      return { enabled: await readParagraphMode() };
    case "SET_PARAGRAPH_MODE":
      return saveParagraphMode(request.enabled);
    case "PAGE_TRANSLATION_STATE_CHANGED":
      await refreshPageContextMenu(sender);
      return null;
    case "VIDEO_FRAME_STATUS":
    case "CAPTURE_VIDEO_FRAME":
    case "TRANSLATE_VIDEO_SUBTITLES":
    case "CANCEL_VIDEO_SUBTITLES":
    case "OPEN_VIDEO_SUBTITLES":
      throw new Error("Online subtitle sources were removed from this edition.");
    case "LOOKUP_DICTIONARY":
    case "PLAY_DICTIONARY_AUDIO":
    case "STOP_DICTIONARY_AUDIO":
    case "GET_DOUBAO_STATUS":
    case "CHECK_DOUBAO":
      throw new Error("Online dictionaries and translation providers are removed from this edition.");
    case "GET_LOCAL_MODEL_STATUS":
      return requestLocal("status");
    case "INSTALL_LOCAL_MODEL":
      return requestLocal("install", request.modelId);
    case "CANCEL_LOCAL_MODEL_DOWNLOAD":
      return requestLocal("cancel");
    case "REMOVE_LOCAL_MODEL":
      return requestLocal("remove", request.modelId);
    case "OPEN_OPTIONS_PAGE":
      if (request.section === "ocr") await chrome.tabs.create({ url: chrome.runtime.getURL("options.html#ocrServiceSettings") });
      else await chrome.runtime.openOptionsPage();
      return null;
    case "OPEN_EMBEDDED_PDF": {
      const source = new URL(request.url);
      if (!["http:", "https:"].includes(source.protocol)) throw new Error(t("unsupportedPdfAddress"));
      const target = new URL(chrome.runtime.getURL("pdf.html"));
      target.searchParams.set("url", source.href); target.searchParams.set("translate", "1");
      await chrome.tabs.create({ url: target.href }); return { opened: true };
    }
    case "GET_SETTINGS": {
      let settings = await getSettings();
      if (settings.imageTranslationEnabled) {
        // OCR cache availability must not take down page translation/settings.
        // Only a successful check can establish that a model is missing.
        let installed: string | undefined;
        const checkedIdentity = ocrSettingsIdentity(settings.ocr);
        try { installed = await ocrRevision(settings); }
        catch { return getSettings(); }
        // Model checks may finish after another page has saved new settings.
        // Return that version and only change its image toggle when needed.
        settings = await getSettings();
        if (!installed && settings.imageTranslationEnabled && checkedIdentity === ocrSettingsIdentity(settings.ocr)) {
          settings = await saveSettings(latest => checkedIdentity === ocrSettingsIdentity(latest.ocr)
            ? { ...latest, imageTranslationEnabled: false } : latest);
        }
      }
      return settings;
    }
    case "IMPORT_SETTINGS":
      return importSettingsBackup(request.backup);
    case "RESET_SETTINGS":
      return saveSettings(structuredClone(DEFAULT_SETTINGS), "browser");
    case "SAVE_SETTINGS":
      // Checking a new opt-in is required. An unavailable optional cache must
      // not prevent changing languages or services while OCR is already on.
      await saveSettings(async latest => {
        const next = request.previousSettings
          ? mergeSettingsChanges(latest, request.settings, request.previousSettings) : request.settings;
        if (next.imageTranslationEnabled && (!latest.imageTranslationEnabled || ocrSettingsIdentity(next.ocr) !== ocrSettingsIdentity(latest.ocr))
          && !await ocrRevision(next)) throw new Error(t("useTheWrenchBesideImageTranslationToInstall"));
        return next;
      }, request.interfaceLanguage);
      return null;
    case "GET_OCR_STATUS":
      return request.builtin ? requestOcr("status") : getOcrStatus(await getSettings());
    case "TEST_OCR_SERVICE":
    case "CANCEL_OCR_TEST":
      throw new Error("Remote OCR services are removed from this edition.");
    case "INSTALL_OCR":
      return requestOcr("install");
    case "REMOVE_OCR": {
      const result = await requestOcr("remove");
      await saveSettings(latest => normalizeOcrSettings(latest.ocr).mode === "http" ? latest : { ...latest, imageTranslationEnabled: false });
      return result;
    }
    case "TRANSLATE_BATCH": {
      const settings = await getSettings();
      return frameSessions.translate(request, sender, signal => translateWithSettings(settings, request, { signal, statisticsPageKey: statisticsPageKey(sender), cacheGeneration }));
    }
    case "LOAD_IMAGE": {
      const settings = await getSettings();
      if (!settings.imageTranslationEnabled) throw new Error(t("enableImageTranslationFirst"));
      return loadImageData(request.url);
    }
    case "TRANSLATE_IMAGE":
      return translateImageWithSettings(await getSettings(), request, statisticsPageKey(sender), cacheGeneration);
    case "GET_STATISTICS":
      return getStatistics();
    case "CLEAR_STATISTICS":
      return clearStatistics();
    case "GET_TRANSLATION_DEBUG":
      return { ...getTranslationDebugSnapshot(),
        ...(sender.tab?.id !== undefined ? { frames: await frameSessions.diagnostics(sender.tab.id) } : {}) };
    case "CLEAR_CACHE":
      return clearTranslationCache();
    case "TEST_PROVIDER": {
      const settings = await getSettings();
      const providerConfig = settings.providers.find(
        (provider) => provider.id === (request.providerId ?? settings.activeProviderId)
      );
      if (!providerConfig) throw new Error(t("providerNotFound"));
      // An explicit settings test can validate a service before it is enabled.
      const provider = createProvider(providerConfig);
      const validation = provider.validateConfig();
      if (!validation.ok) throw new Error(validation.message);
      const [translation] = await provider.translateBatch({
        texts: ["Hello world"],
        sourceLang: "en",
        targetLang: settings.targetLang
      });
      return { translation };
    }
    case "TRANSLATE_PAGE":
    case "EXECUTE_TRANSLATION_SHORTCUT":
    case "START_TOUCH_PARAGRAPH":
    case "TRANSLATE_CONTEXT_IMAGE":
    case "CLEAR_TRANSLATION":
    case "GET_TRANSLATION_STATE":
    case "GET_FLOATING_BALL":
    case "SET_FLOATING_BALL":
    case "OPEN_TRANSLATION_DEBUG":
      throw new Error(`${request.type} must be sent to the active tab.`);
    default:
      return assertNever(request);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled message: ${JSON.stringify(value)}`);
}

function isFrameRequest(request: RuntimeRequest): request is FrameSessionRequest {
  return request.type.startsWith("FRAME_");
}
