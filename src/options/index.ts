import { getInterfaceLanguage, initializeInterfaceLanguage, localizeDocument, t, htmlMessage, type InterfaceLanguage } from "../shared/i18n";
import { BUILT_IN_PROVIDER_IDS, DEFAULT_SETTINGS } from "../shared/defaults";
import { normalizeFrameTranslation } from "../shared/frame-session";
import { SOURCE_LANGUAGES, TARGET_LANGUAGES } from "../shared/languages";
import { TRANSLATION_DISPLAY_MODES } from "../shared/display-modes";
import { sendRuntimeMessage } from "../shared/messaging";
import type { ExtensionSettings, ProviderConfig, TranslationApiOptions } from "../shared/types";
import { supportsServiceMode } from "../shared/translation-service";
import "./styles.css";
import { setImageTranslationToggle } from "../shared/ocr-control";
import { setupOcrSettings } from "./ocr-service";
import { DEFAULT_OCR_SETTINGS } from "../shared/ocr-service";
import { setupLocalModelControl } from "../local/control";
import { ensureProviderIconStyles, providerIconMarkup } from "../shared/provider-icons";
import { setupAutoTranslationControls } from "./auto-translation";
import { setupExcludedSites } from "./excluded-sites";
import { setupElementRuleControls } from "./element-exclusions";
import { renderProviderUsage, updateProviderScheduling } from "./provider-usage";
import { setupSettingsNavigation } from "./navigation";
import { setupStatisticsControls } from "./statistics";
import { setupShortcutSettings } from "./shortcuts";
import { setupAppearanceControls } from "./appearance";
import "../shared/appearance.css";
import { normalizeSelectionTranslation, type DictionaryProvider, type SelectionTriggerStyle } from "../shared/dictionary";
import { RequestTemplateError, supportsRequestTemplate, validateRequestTemplate } from "../shared/request-template";
import { readRequestTemplate, setupProviderTabs } from "./provider-advanced";
import { syncDoubaoTargetControls } from "../shared/doubao-ui";
import { renderUiIcons } from "../shared/ui-icons";
import { setupSettingsBackupControls } from "./settings-backup";
import { setupSettingsResetControls } from "./reset-settings";
import { ACTION_STATUS_DURATION, setupSettingsActionFeedback } from "./action-feedback";
import { defaultProviderPerformance, restoreProviderParameters } from "./provider-defaults";

await initializeInterfaceLanguage();
localizeDocument(document);
renderUiIcons();

const settingsNavigation = setupSettingsNavigation(query<HTMLElement>(".settings"));
const shortcutControls = setupShortcutSettings(query<HTMLElement>("#shortcutSettings"));
const appearanceControls = setupAppearanceControls(query<HTMLElement>("#appearanceSettings"));
const statisticsControls = setupStatisticsControls(query<HTMLElement>("#statisticsSettings"));

const targetLang = query<HTMLSelectElement>("#targetLang");
const sourceLang = query<HTMLSelectElement>("#sourceLang");
const interfaceLanguageSelect = query<HTMLSelectElement>("#interfaceLanguage");
interfaceLanguageSelect.value = getInterfaceLanguage();
const chunkSize = query<HTMLInputElement>("#chunkSize");
const concurrency = query<HTMLInputElement>("#concurrency");
const pdfTranslationScope = query<HTMLSelectElement>("#pdfTranslationScope");
const pdfTranslationPageRadius = query<HTMLInputElement>("#pdfTranslationPageRadius");
const pdfTranslationPageRadiusField = query<HTMLElement>("#pdfTranslationPageRadiusField");
const cacheEnabled = query<HTMLInputElement>("#cacheEnabled");
const floatingBallEnabled = query<HTMLInputElement>("#floatingBallEnabled");
const floatingBallExclusions = setupExcludedSites(query<HTMLElement>("#floatingBallExclusions"));
const selectionTranslationEnabled = query<HTMLInputElement>("#selectionTranslationEnabled");
const selectionTranslationFields = query<HTMLFieldSetElement>("#selectionTranslationFields");
const selectionDictionary = query<HTMLSelectElement>("#selectionDictionary");
const selectionTriggerStyle = query<HTMLSelectElement>("#selectionTriggerStyle");
const imageTranslationEnabled = query<HTMLInputElement>("#imageTranslationEnabled");
const imageTranslationContextMenuEnabled = query<HTMLInputElement>("#imageTranslationContextMenuEnabled");
const imageTranslationFloatingEnabled = query<HTMLInputElement>("#imageTranslationFloatingEnabled");
imageTranslationEnabled.addEventListener("change", () => setImageTranslationToggle(imageTranslationEnabled, imageTranslationEnabled.checked));
const translateCodeComments = query<HTMLInputElement>("#translateCodeComments");
const translationDisplayMode = query<HTMLSelectElement>("#translationDisplayMode");
const translationDisplayModeDescription = query<HTMLSpanElement>("#translationDisplayModeDescription");
const providerPicker = query<HTMLDivElement>("#providerPicker");
const providerTrigger = query<HTMLButtonElement>("#providerTrigger");
const providerTriggerLabel = query<HTMLSpanElement>("#providerTriggerLabel");
const providerMenu = query<HTMLDivElement>("#providerMenu");
const addProviderButton = query<HTMLButtonElement>("#addProvider");
const providerForm = query<HTMLDivElement>("#providerForm");
const providerPerformance = query<HTMLDivElement>("#providerPerformance");
const modelDialog = query<HTMLDialogElement>("#modelDialog");
const modelDialogForm = query<HTMLFormElement>("#modelDialogForm");
const modelAction = query<HTMLSelectElement>("#modelAction");
const customModelName = query<HTMLInputElement>("#customModelName");
const providerDialog = query<HTMLDialogElement>("#providerDialog");
const providerDialogForm = query<HTMLFormElement>("#providerDialogForm");
const cancelProviderButton = query<HTMLButtonElement>("#cancelProvider");
const customProviderKind = query<HTMLSelectElement>("#customProviderKind");
const saveButton = query<HTMLButtonElement>("#save");
const status = query<HTMLParagraphElement>("#status");
const autoTranslationControls = setupAutoTranslationControls(
  query<HTMLElement>("#autoTranslationSettings"), field => {
    settingsNavigation.reveal(field);
    field.scrollIntoView?.({ block: "center" });
  }
);
const frameTranslationEnabled = query<HTMLInputElement>("#frameTranslationEnabled");
const elementRuleControls = setupElementRuleControls(query<HTMLElement>("#elementExclusionSettings"), field => {
  settingsNavigation.reveal(field); field.scrollIntoView?.({ block: "center" });
});
const frameTranslationExcluded = query<HTMLTextAreaElement>("#frameTranslationExcluded");

const LLM_MODEL_OPTIONS = [
  "gpt-4o-mini",
  "glm-4-flash-250414",
  "glm-4.7-flash",
  "glm-4-flashx-250414"
];
const ZHIPU_MODEL_OPTIONS = [
  "glm-4-flash-250414",
  "glm-4.7-flash",
  "glm-4-flashx-250414"
];
const DEEPSEEK_MODEL_OPTIONS = [
  "deepseek-flash",
  "deepseek-v4-pro"
];
let settings: ExtensionSettings;
let savedSettings: ExtensionSettings;
let providerFormSettings: ProviderConfig | undefined;
let editingProviderId: string | undefined;
let disposeLocalControl: (() => void) | undefined;
let activeProviderTest: { providerId: string; status: HTMLElement; message: string } | undefined;
let providerFormVersion = 0;
let statusTimer: ReturnType<typeof setTimeout> | undefined;
const pendingSettingsWrites = new Set<Promise<void>>();
let optionsClosed = false;
let ocrSettingsControls: ReturnType<typeof setupOcrSettings> | undefined;

window.addEventListener("pagehide", () => {
  optionsClosed = true;
  clearTimeout(statusTimer);
}, { once: true });

void init().catch((error: unknown) => {
  setStatus(error instanceof Error ? error.message : String(error));
});

async function init(): Promise<void> {
  settings = await sendRuntimeMessage<ExtensionSettings>({ type: "GET_SETTINGS" });
  savedSettings = cloneSettings(settings);
  ocrSettingsControls = setupOcrSettings(imageTranslationEnabled, () => {
    settings.imageTranslationEnabled = false; setImageTranslationToggle(imageTranslationEnabled, false);
  }, settings.ocr, field => settingsNavigation.reveal(field));
  render();
  setupSettingsActionFeedback(document);
  setupSettingsBackupControls({ status: setStatus, imported: imported => {
    invalidateProviderTest();
    settings = imported;
    savedSettings = cloneSettings(imported);
    editingProviderId = undefined;
    setProviderMenuOpen(false);
    render();
  } });
  const imageNotice = new URLSearchParams(location.search).get("imageTranslationNotice");
  if (imageNotice === "setup") setStatus(t("beforeTranslatingImagesFromTheContextMenuInstall"));
  if (imageNotice === "refresh") setStatus(t("couldNotConnectToTheImageSPage"));
  if (imageNotice) {
    settingsNavigation.reveal(imageTranslationEnabled);
    imageTranslationEnabled.closest(".image-feature")?.scrollIntoView?.({ block: "center" });
  }
  if (new URLSearchParams(location.search).get("pageTranslationNotice") === "refresh") {
    setStatus(t("couldNotConnectToThePageRefreshIt"));
  }

  providerTrigger.addEventListener("click", () => setProviderMenuOpen(false));
  providerTrigger.disabled = true; // Only local Bergamot is available.
  providerMenu.addEventListener("click", (event) => {
    const button = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>("button[data-action]")
      : null;
    if (!button) return;
    void handleProviderAction(button.dataset.action ?? "", button.dataset.providerId ?? "");
  });
  addProviderButton.hidden = true;
  addProviderButton.disabled = true;
  addProviderButton.addEventListener("click", openProviderDialog);
  cancelProviderButton.addEventListener("click", () => providerDialog.close());
  customProviderKind.addEventListener("change", updateCustomProviderFields);
  providerDialogForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void addCustomProvider();
  });
  query<HTMLButtonElement>("#cancelModel").addEventListener("click", () => modelDialog.close());
  modelAction.addEventListener("change", () => {
    const provider = getEditingProvider();
    customModelName.value = modelAction.value === "edit" && "model" in provider ? provider.model : "";
    customModelName.focus();
  });
  modelDialogForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveModel();
  });
  document.addEventListener("click", (event) => {
    if (event.target instanceof Node && !providerPicker.contains(event.target)) {
      setProviderMenuOpen(false);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setProviderMenuOpen(false);
  });
  saveButton.addEventListener("click", () => {
    void save().catch(() => {});
  });
  setupSettingsResetControls(resetSettings);
  query<HTMLButtonElement>("#restorePageDefaults").addEventListener("click", () => {
    try { restorePageDefaults(); }
    catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  });
  providerForm.addEventListener("input", invalidateProviderTest);
  providerForm.addEventListener("change", invalidateProviderTest);
  const updateUsageOnEdit = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (["serviceMode", "model", "baseURL", "endpoint"].includes(target.dataset.field ?? "")
      || ["model", "endpoint"].includes(target.dataset.apiField ?? "")) updateProviderUsage();
  };
  providerForm.addEventListener("input", updateUsageOnEdit);
  providerForm.addEventListener("change", updateUsageOnEdit);
  for (const field of [chunkSize, concurrency, providerPerformance]) {
    field.addEventListener("input", updateUsageScheduling);
    field.addEventListener("change", updateUsageScheduling);
  }
  pdfTranslationScope.addEventListener("change", updatePdfTranslationScope);
  sourceLang.addEventListener("change", updateLocalControl);
  targetLang.addEventListener("change", updateLocalControl);
}

function render(): void {
  renderGeneralSettings();
  renderProviderPicker(false);
  renderProviderForm();
}

function renderGeneralSettings(): void {
  statisticsControls.render(settings.statisticsEnabled === true);
  shortcutControls.render(settings.shortcuts, settings.shortcutEnabled, settings.localShortcuts);
  appearanceControls.render(settings.appearance);
  autoTranslationControls.render(settings.autoTranslation);
  elementRuleControls.render(settings);
  renderGeneralPageSettings(settings);
  renderSelectionSettings(settings);
  renderPerformanceSettings(settings);
  ocrSettingsControls?.render(settings.ocr);
}

function renderGeneralPageSettings(value: ExtensionSettings): void {
  const frameTranslation = normalizeFrameTranslation(value.frameTranslation);
  frameTranslationEnabled.checked = frameTranslation.enabled;
  frameTranslationExcluded.value = frameTranslation.excludeMatches.join("\n");
  renderLanguageOptions(targetLang, value.targetLang, TARGET_LANGUAGES);
  renderLanguageOptions(sourceLang, value.sourceLang, SOURCE_LANGUAGES);
  cacheEnabled.checked = value.cacheEnabled;
  floatingBallEnabled.checked = value.floatingBallEnabled;
  floatingBallExclusions.render(value.floatingBallExcludedSites);
  setImageTranslationToggle(imageTranslationEnabled, value.imageTranslationEnabled === true);
  imageTranslationContextMenuEnabled.checked = value.imageTranslationContextMenuEnabled !== false;
  imageTranslationFloatingEnabled.checked = value.imageTranslationFloatingEnabled !== false;
  translateCodeComments.checked = value.translateCodeComments;
  translationDisplayMode.innerHTML = TRANSLATION_DISPLAY_MODES
    .map((mode) => `<option value="${mode.value}">${mode.label}</option>`)
    .join("");
  translationDisplayMode.value = value.translationDisplayMode;
  updateTranslationDisplayModeDescription();
}

function renderSelectionSettings(value: ExtensionSettings): void {
  const selection = normalizeSelectionTranslation(value.selectionTranslation);
  selectionTranslationEnabled.checked = selection.enabled;
  selectionTranslationFields.disabled = !selection.enabled;
  selectionDictionary.value = selection.provider;
  selectionTriggerStyle.value = selection.style;
}

function renderPerformanceSettings(value: ExtensionSettings): void {
  chunkSize.value = String(value.chunkSize);
  concurrency.value = String(value.concurrency);
  pdfTranslationScope.value = value.pdfTranslationPageRadius === null ? "unlimited" : "nearby";
  pdfTranslationPageRadius.value = String(value.pdfTranslationPageRadius ?? DEFAULT_SETTINGS.pdfTranslationPageRadius);
  updatePdfTranslationScope();
}

translationDisplayMode.addEventListener("change", updateTranslationDisplayModeDescription);
selectionTranslationEnabled.addEventListener("change", () => { selectionTranslationFields.disabled = !selectionTranslationEnabled.checked; });

function updatePdfTranslationScope(): void {
  pdfTranslationPageRadiusField.hidden = pdfTranslationScope.value === "unlimited";
  pdfTranslationPageRadius.disabled = pdfTranslationPageRadiusField.hidden;
}

function updateTranslationDisplayModeDescription(): void {
  translationDisplayModeDescription.textContent = TRANSLATION_DISPLAY_MODES.find(
    (mode) => mode.value === translationDisplayMode.value
  )?.description ?? "";
}

function renderLanguageOptions(
  select: HTMLSelectElement,
  value: string,
  languages: ReadonlyArray<{ code: string; label: string }>
): void {
  const options = languages.some((entry) => entry.code === value)
    ? languages
    : [{ code: value, label: value }, ...languages];
  select.innerHTML = options
    .map((entry) => `<option value="${escapeHtml(entry.code)}">${escapeHtml(entry.label)}</option>`)
    .join("");
  select.value = value;
}

function renderProviderPicker(keepOpen: boolean): void {
  ensureProviderIconStyles();
  const activeProvider = getEditingProvider();
  query<HTMLElement>("#providerTriggerIcon").innerHTML = providerIconMarkup(activeProvider);
  providerTriggerLabel.textContent = activeProvider.label;
  query<HTMLElement>("#disabledProviderHint").hidden = activeProvider.enabled !== false;
  providerMenu.innerHTML = settings.providers.map(renderProviderMenuRow).join("");
  setProviderMenuOpen(keepOpen);
}

function renderProviderMenuRow(provider: ProviderConfig): string {
  return `<div class="provider-menu-row"><button class="provider-option" type="button" role="option"
     data-action="select" data-provider-id="${escapeAttr(provider.id)}" aria-selected="true">
     ${providerIconMarkup(provider)}<span class="provider-option-label">${escapeHtml(provider.label)}</span>
     </button></div>`;
}

function renderProviderForm(rebuildPerformance = true): void {
  invalidateProviderTest();
  ++providerFormVersion;
  disposeLocalControl?.(); disposeLocalControl = undefined;
  const provider = getEditingProvider();
  providerFormSettings = structuredClone(provider);
  if (rebuildPerformance) renderProviderPerformanceControls(provider);
  setProviderFormMarkup(provider, `<div class="grid"><label>${htmlMessage("displayName")}
    <input data-field="label" type="text" value="${escapeAttr(provider.label)}" readonly /></label></div>
    <div data-local-model-control></div>`);
  updateLocalControl();
}

function updateLocalControl(): void {
  const container = providerForm.querySelector<HTMLElement>("[data-local-model-control]");
  if (!container) return;
  disposeLocalControl?.();
  disposeLocalControl = setupLocalModelControl(container, sourceLang.value, targetLang.value);
}

function setProviderFormMarkup(provider: ProviderConfig, markup: string): void {
  providerForm.dataset.providerId = provider.id;
  providerForm.innerHTML = markup;
  setupProviderTabs(providerForm, provider);
  if (!providerForm.querySelector("#test")) {
    providerForm.insertAdjacentHTML("beforeend", `<div class="provider-test-action">${renderTestButton()}</div>`);
  }
  providerForm.insertAdjacentHTML("beforeend", '<p data-role="provider-test-status" class="hint" role="status" hidden></p>');
  const usage = document.createElement("aside"); usage.id = "providerUsage";
  providerForm.append(usage);
  renderProviderUsage(usage, provider);
  updateUsageScheduling();
  providerForm.querySelector("#test")?.addEventListener("click", testProvider);
  providerForm.querySelector("[data-action='test-provider']")?.addEventListener("click", testProvider);
  providerForm.querySelector("[data-action='manage-model']")?.addEventListener("click", () => {
    settings = readSettingsFromForm();
    modelAction.value = "add";
    customModelName.value = "";
    query<HTMLElement>("#modelStatus").textContent = "";
    modelDialog.showModal();
    customModelName.focus();
  });
}

function updateProviderUsage(): void {
  const container = providerForm.querySelector<HTMLElement>("#providerUsage");
  if (!container) return;
  renderProviderUsage(container, readProviderFromForm(getEditingProvider()));
  updateUsageScheduling();
}

function updateUsageScheduling(): void {
  refreshUsageScheduling(readProviderFromForm(getEditingProvider()));
}

function refreshUsageScheduling(base: ProviderConfig): void {
  const container = providerForm.querySelector<HTMLElement>("#providerUsage");
  if (!container) return;
  const provider = { ...base, ...readProviderPerformance() } as ProviderConfig;
  const value = (input: HTMLInputElement, fallback: number, min: number, max: number): number => {
    const number = Number(input.value);
    return input.value && Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
  };
  updateProviderScheduling(container, provider, { ...settings,
    chunkSize: value(chunkSize, settings.chunkSize, 200, 4000), concurrency: value(concurrency, settings.concurrency, 1, 8),
    providers: settings.providers.map(entry => entry.id === provider.id ? provider : entry) });
}

type ModelProvider = Extract<ProviderConfig, { model: string }>;

function modelPresets(provider: ModelProvider): string[] {
  if (provider.type === "index-translate") return ["Index-Translate-35B-A3B", "Index-Translate-9B", "Index-Translate-2B"];
  if (provider.type === "deepseek") return DEEPSEEK_MODEL_OPTIONS;
  if (provider.type === "zhipu-glm") return ZHIPU_MODEL_OPTIONS;
  return provider.type === "openai-compatible" ? LLM_MODEL_OPTIONS : [];
}

function renderTestButton(): string {
  return `<button id="test" type="button" class="secondary">${htmlMessage("testService")}</button>`;
}

async function saveModel(): Promise<void> {
  try {
    const provider = getEditingProvider();
    if (!("model" in provider)) return;
    const model = customModelName.value.trim();
    if (!model) {
      query<HTMLElement>("#modelStatus").textContent = t("enterAModelName");
      return;
    }
    const presets = modelPresets(provider);
    const previous = [...new Set([...(provider.customModels ?? []),
      ...(!presets.includes(provider.model) ? [provider.model] : [])])];
    const customModels = [...new Set([
      ...previous.filter((name) => modelAction.value !== "edit" || name !== provider.model),
      ...(!presets.includes(model) ? [model] : [])
    ])];
    settings.providers = settings.providers.map((entry) => entry.id === provider.id
      ? { ...provider, model, customModels } : entry);
    await persistSettings(false);
    modelDialog.close();
    render();
    setStatus(t("savedModel", model));
  } catch (error) {
    query<HTMLElement>("#modelStatus").textContent = error instanceof Error ? error.message : String(error);
  }
}

function renderProviderPerformanceControls(provider: ProviderConfig): void {
  providerPerformance.innerHTML = provider.type === "firefox-local"
    ? `<p class="hint">${htmlMessage("localTranslationUsesAFixedChunkSizeOf")}</p>`
    : provider.type === "doubao-web"
      ? `<p class="hint">${htmlMessage("doubaoUsesAFixedChunkSizeOf1200")}</p>`
      : renderProviderPerformance(provider);
  providerPerformance.querySelector("[data-field='inheritPerformance']")
    ?.addEventListener("change", updateProviderPerformanceFields);
  updateProviderPerformanceFields();
}

function renderProviderPerformance(provider: ProviderConfig): string {
  const inherited = provider.performanceMode !== "custom";
  return `
    <fieldset class="provider-performance">
      <legend>${htmlMessage("currentServiceName", provider.label)}</legend>
      <label class="setting-toggle performance-inherit">
        <span>${htmlMessage("useGeneralPerformanceSettings")}</span>
        <input data-field="inheritPerformance" type="checkbox" role="switch" ${inherited ? "checked" : ""} />
        <span class="setting-toggle-control" aria-hidden="true"></span>
      </label>
      <div class="grid performance-overrides" data-role="performanceOverrides" ${inherited ? "hidden" : ""}>
        <label>${htmlMessage("chunkSize")}
          <input data-field="chunkSize" type="number" min="200" max="4000" value="${provider.chunkSize ?? settings.chunkSize}" />
        </label>
        <label>${htmlMessage("serviceConcurrency")}
          <input data-field="concurrency" type="number" min="1" max="${settings.concurrency}" value="${provider.concurrency ?? settings.concurrency}" />
        </label>
      </div>
      <p class="hint">${htmlMessage("serviceConcurrencyIsCappedByTheGlobalMaximum")}</p>
    </fieldset>
  `;
}

function updateProviderPerformanceFields(): void {
  const inherit = providerPerformance.querySelector<HTMLInputElement>("[data-field='inheritPerformance']");
  const overrides = providerPerformance.querySelector<HTMLElement>("[data-role='performanceOverrides']");
  if (!inherit || !overrides) return;
  overrides.hidden = inherit.checked;
  overrides.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
    input.disabled = inherit.checked;
  });
}

async function handleProviderAction(action: string, providerId: string): Promise<void> {
  try {
    if (action === "select") await selectProvider(providerId);
    if (action === "toggle") await toggleProvider(providerId);
    if (action === "delete") await deleteProvider(providerId);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  }
}

async function selectProvider(providerId: string): Promise<void> {
  const provider = settings.providers.find((entry) => entry.id === providerId);
  if (!provider || provider.type !== "firefox-local") return;
  invalidateProviderTest();
  settings = readSettingsFromForm();
  if (provider.enabled !== false) settings.activeProviderId = providerId;
  await persistSettings(false);
  editingProviderId = providerId;
  renderProviderPicker(false);
  renderProviderForm();
  setStatus(provider.enabled === false ? t("disabledServiceSelectedYouCanEditItsConfiguration") : t("currentServiceChanged"));
}

async function toggleProvider(providerId: string): Promise<void> {
  settings = readSettingsFromForm();
  const provider = settings.providers.find((entry) => entry.id === providerId);
  if (!provider) return;
  const nextEnabled = provider.enabled === false;
  if (!nextEnabled) {
    const hasOtherEnabled = settings.providers.some(
      (entry) => entry.id !== providerId && entry.enabled !== false
    );
    if (!hasOtherEnabled) {
      setStatus(t("enableAtLeastOneTranslationService"));
      return;
    }
  }
  settings.providers = settings.providers.map((entry) =>
    entry.id === providerId ? { ...entry, enabled: nextEnabled } : entry
  );
  if (!nextEnabled && settings.activeProviderId === providerId) {
    settings.activeProviderId = settings.providers.find((entry) => entry.enabled !== false)!.id;
  }
  await persistSettings(false);
  renderProviderPicker(true);
  renderProviderForm();
  setStatus(nextEnabled ? t("serviceEnabled") : t("serviceDisabled"));
}

async function deleteProvider(providerId: string): Promise<void> {
  if (BUILT_IN_PROVIDER_IDS.has(providerId)) return;
  const provider = settings.providers.find((entry) => entry.id === providerId);
  if (!provider || !window.confirm(t("confirmDeleteProvider", provider.label))) return;
  settings = readSettingsFromForm();
  settings.providers = settings.providers.filter((entry) => entry.id !== providerId);
  if (settings.activeProviderId === providerId) {
    settings.activeProviderId = settings.providers.find((entry) => entry.enabled !== false)?.id
      ?? DEFAULT_SETTINGS.activeProviderId;
  }
  if (editingProviderId === providerId) editingProviderId = settings.activeProviderId;
  await persistSettings(false);
  renderProviderPicker(true);
  renderProviderForm();
  setStatus(t("customServiceDeleted"));
}

function openProviderDialog(): void { /* No custom/online services supported. */ }
function updateCustomProviderFields(): void { /* No custom/online services supported. */ }
async function addCustomProvider(): Promise<void> { throw new Error("Online/API providers are removed."); }

async function save(): Promise<void> {
  setStatus("");
  const selected = interfaceLanguageSelect.value as InterfaceLanguage;
  const languageChange = selected !== getInterfaceLanguage() ? selected : undefined;
  if (languageChange) saveButton.disabled = true;
  try {
    settings = readSettingsFromForm();
    await persistSettings(false, languageChange);
    if (languageChange) {
      location.reload();
      return;
    }
    render();
    setStatus(t("saved"), ACTION_STATUS_DURATION);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    if (languageChange) saveButton.disabled = false;
  }
}

function persistSettings(showSavedStatus: boolean, interfaceLanguage?: InterfaceLanguage): Promise<void> {
  const write = persistSettingsNow(showSavedStatus, interfaceLanguage);
  pendingSettingsWrites.add(write);
  void write.then(() => pendingSettingsWrites.delete(write), () => pendingSettingsWrites.delete(write));
  return write;
}

async function persistSettingsNow(showSavedStatus: boolean, interfaceLanguage?: InterfaceLanguage): Promise<void> {
  const previousSettings = cloneSettings(savedSettings);
  // A service test leaves the current form mounted. Compare its fields with
  // what that form displayed, even if the previous save merged external edits.
  const formSettings = providerFormSettings;
  if (formSettings) previousSettings.providers = previousSettings.providers.map(provider =>
    provider.id === formSettings.id ? formSettings : provider);
  await sendRuntimeMessage({ type: "SAVE_SETTINGS", settings, previousSettings, ...(interfaceLanguage ? { interfaceLanguage } : {}) });
  if (interfaceLanguage) return;
  settings = await sendRuntimeMessage<ExtensionSettings>({ type: "GET_SETTINGS" });
  savedSettings = cloneSettings(settings);
  // Provider actions can save without rebuilding the provider form (for
  // example while a service test owns its status node). Keep every other
  // control aligned with the merged settings used as the next edit baseline.
  renderGeneralSettings();
  if (showSavedStatus) setStatus(t("saved"), ACTION_STATUS_DURATION);
}

function invalidateProviderTest(): void {
  const previous = activeProviderTest;
  activeProviderTest = undefined;
  if (!previous) return;
  previous.status.hidden = true;
  previous.status.textContent = "";
  if (previous.message && status.textContent === previous.message) setStatus("");
}

async function testProvider(): Promise<void> {
  invalidateProviderTest();
  const inlineStatus = providerForm.querySelector<HTMLElement>("[data-role='provider-test-status']");
  if (!inlineStatus) return;
  const run = { providerId: getEditingProvider().id, status: inlineStatus, message: "" };
  activeProviderTest = run;
  const isCurrent = (): boolean => activeProviderTest === run
    && getEditingProvider().id === run.providerId && run.status.isConnected;
  const report = (message: string): void => {
    if (!isCurrent()) return;
    run.message = message;
    setStatus(message);
    run.status.hidden = false;
    run.status.textContent = message;
  };
  try {
    settings = readSettingsFromForm();
    report(t("testing"));
    await persistSettings(false);
    if (!isCurrent()) return;
    const result = await sendRuntimeMessage<{ translation: string }>({
      type: "TEST_PROVIDER",
      providerId: run.providerId
    });
    report(t("testPassed", result.translation));
  } catch (error) {
    report(error instanceof Error ? error.message : String(error));
  }
}

function restorePageDefaults(): void {
  const panel = document.querySelector<HTMLElement>(".settings-panel:not([hidden])");
  switch (panel?.id) {
    case "generalSettings":
      interfaceLanguageSelect.value = "browser";
      renderGeneralPageSettings(DEFAULT_SETTINGS);
      syncDoubaoTargetControls(settings, targetLang); updateLocalControl();
      break;
    case "selectionTranslationSettings": renderSelectionSettings(DEFAULT_SETTINGS); break;
    case "autoTranslationSettings": autoTranslationControls.render(DEFAULT_SETTINGS.autoTranslation); break;
    case "elementExclusionSettings": elementRuleControls.render(DEFAULT_SETTINGS); break;
    case "shortcutSettings": shortcutControls.reset(); break;
    case "appearanceSettings": appearanceControls.render(DEFAULT_SETTINGS.appearance); break;
    case "statisticsSettings": statisticsControls.reset(); break;
    case "providerSettings": {
      const provider = getEditingProvider();
      const resetCurrent = BUILT_IN_PROVIDER_IDS.has(provider.id) && provider.type !== "http-template";
      // Preserve even unsaved credentials without reading or validating other pages.
      const draft = resetCurrent ? readProviderFromForm(provider) : provider;
      settings.providers = settings.providers.map(entry => restoreProviderParameters(entry.id === provider.id ? draft : entry));
      renderProviderPicker(false);
      if (resetCurrent) {
        // Save must compare restored fields with the original form, not the defaults just rendered.
        const baseline = providerFormSettings;
        renderProviderForm(false);
        providerFormSettings = baseline;
      }
      setStatus(t("builtInServiceDefaultsRestoredCredentialsAndCustom"), ACTION_STATUS_DURATION);
      return;
    }
    case "performanceSettings":
      settings.providers = settings.providers.map(provider => ({ ...provider, ...defaultProviderPerformance(provider) }));
      renderPerformanceSettings(DEFAULT_SETTINGS);
      renderProviderPerformanceControls(getEditingProvider());
      refreshUsageScheduling(getEditingProvider());
      break;
    default: return;
  }
  setStatus(t("sectionDefaultsRestoredSaveToApply"), ACTION_STATUS_DURATION);
}

async function resetSettings(): Promise<void> {
  // Commit first: cancellation or failed storage must not replace the draft or
  // its baseline. The background returns the value from this exact write.
  // Finish existing saves and their UI continuations before replacing state.
  await Promise.allSettled([...pendingSettingsWrites]);
  const reset = await sendRuntimeMessage<ExtensionSettings>({ type: "RESET_SETTINGS" });
  if (optionsClosed) return;
  if (getInterfaceLanguage() !== "browser") {
    location.reload();
    return;
  }
  interfaceLanguageSelect.value = "browser";
  invalidateProviderTest();
  settings = reset;
  savedSettings = cloneSettings(reset);
  editingProviderId = undefined;
  setProviderMenuOpen(false);
  render();
  setStatus(t("allSettingsReset"), ACTION_STATUS_DURATION);
}

function readSettingsFromForm(): ExtensionSettings {
  let appearance: ReturnType<typeof appearanceControls.read>;
  try { appearance = appearanceControls.read(); }
  catch (error) {
    settingsNavigation.reveal(query<HTMLElement>("#appearanceSettings"));
    query<HTMLElement>("#appearanceSettings [aria-invalid='true']").focus();
    throw error;
  }
  const activeProvider = {
    ...readProviderFromForm(getEditingProvider()),
    ...(getEditingProvider().type === "firefox-local" ? { performanceMode: "custom", chunkSize: 800, concurrency: 1 }
      : getEditingProvider().type === "doubao-web" ? { performanceMode: "custom", chunkSize: 1200, concurrency: 1 }
        : readProviderPerformance())
  } as ProviderConfig;
  if (supportsRequestTemplate(activeProvider)) {
    try {
      validateRequestTemplate(activeProvider.requestTemplate);
    } catch (error) {
      if (error instanceof RequestTemplateError) {
        providerForm.querySelector<HTMLButtonElement>("#providerAdvancedTab")!.click();
        const field = providerForm.querySelector<HTMLTextAreaElement>(
          `[data-field='${error.field === "headers" ? "requestHeadersTemplate" : "requestBodyTemplate"}']`
        )!;
        settingsNavigation.reveal(field);
        field.setAttribute("aria-invalid", "true");
        const message = providerForm.querySelector<HTMLElement>("[data-role='request-template-status']")!;
        message.textContent = error.message;
        message.hidden = false;
        field.focus();
      }
      throw error;
    }
  }
  const ocr = ocrSettingsControls?.read();
  return {
    ...settings,
    ...(settings.ocr !== undefined || ocr && JSON.stringify(ocr) !== JSON.stringify(DEFAULT_OCR_SETTINGS) ? { ocr } : {}),
    appearance,
    shortcuts: shortcutControls.read(),
    localShortcuts: shortcutControls.readLocal(),
    shortcutEnabled: shortcutControls.readEnabled(),
    autoTranslation: autoTranslationControls.read(),
    ...elementRuleControls.read(),
    frameTranslation: normalizeFrameTranslation({ enabled: frameTranslationEnabled.checked,
      excludeMatches: frameTranslationExcluded.value.split(/\r?\n/u) }),
    targetLang: targetLang.value.trim() || "zh-CN",
    sourceLang: sourceLang.value.trim() || "auto",
    activeProviderId: settings.activeProviderId,
    chunkSize: Number(chunkSize.value),
    concurrency: Number(concurrency.value),
    pdfTranslationPageRadius: pdfTranslationScope.value === "unlimited" ? null
      : pdfTranslationPageRadius.value === "" ? DEFAULT_SETTINGS.pdfTranslationPageRadius : Number(pdfTranslationPageRadius.value),
    cacheEnabled: cacheEnabled.checked,
    statisticsEnabled: statisticsControls.read(),
    floatingBallEnabled: floatingBallEnabled.checked,
    floatingBallExcludedSites: floatingBallExclusions.read(),
    selectionTranslation: {
      enabled: selectionTranslationEnabled.checked,
      provider: selectionDictionary.value as DictionaryProvider,
      style: selectionTriggerStyle.value as SelectionTriggerStyle
    },
    imageTranslationEnabled: imageTranslationEnabled.checked,
    imageTranslationContextMenuEnabled: imageTranslationContextMenuEnabled.checked,
    imageTranslationFloatingEnabled: imageTranslationFloatingEnabled.checked,
    translateCodeComments: translateCodeComments.checked,
    translationDisplayMode: translationDisplayMode.value as ExtensionSettings["translationDisplayMode"],
    providers: settings.providers.map((provider) =>
      provider.id === activeProvider.id ? activeProvider : provider
    )
  };
}

function readProviderPerformance(): Pick<
  ProviderConfig,
  "performanceMode" | "chunkSize" | "concurrency"
> {
  const inherit = providerPerformance.querySelector<HTMLInputElement>("[data-field='inheritPerformance']");
  if (!inherit || inherit.checked) {
    return {
      performanceMode: "inherit",
      chunkSize: undefined,
      concurrency: undefined
    };
  }
  const providerChunkSize = providerPerformance.querySelector<HTMLInputElement>("[data-field='chunkSize']");
  const providerConcurrency = providerPerformance.querySelector<HTMLInputElement>("[data-field='concurrency']");
  return {
    performanceMode: "custom",
    chunkSize: Number(providerChunkSize?.value),
    concurrency: Number(providerConcurrency?.value)
  };
}

function readProviderFromForm(provider: ProviderConfig): ProviderConfig {
  const field = (name: string) =>
    providerForm.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      `[data-field="${name}"]`
    )?.value ?? "";

  if ("model" in provider) {
    // Retain models from older settings before replacing the current selection.
    const previousModel = provider.model.trim();
    if (previousModel && !modelPresets(provider).includes(previousModel)) {
      provider = { ...provider, customModels: [...new Set([...(provider.customModels ?? []), previousModel])] };
    }
  }
  if (supportsRequestTemplate(provider)) {
    provider = { ...provider, requestTemplate: readRequestTemplate(providerForm) };
  }

  if (supportsServiceMode(provider)) {
    const api = { ...provider.api };
    providerForm.querySelectorAll<HTMLInputElement>("[data-api-field]").forEach(input => {
      api[input.dataset.apiField as keyof TranslationApiOptions] = input.value.trim();
    });
    return { ...provider, label: field("label").trim() || provider.label,
      serviceMode: field("serviceMode") === "api" ? "api" : "free", api };
  }
  if (provider.type === "firefox-local" || provider.type === "doubao-web") {
    return { ...provider, label: field("label").trim() || provider.label };
  }
  if (provider.type === "microsoft-translator") {
    return {
      ...provider,
      label: field("label").trim() || provider.label,
      endpoint: field("endpoint").trim() || "https://api.cognitive.microsofttranslator.com",
      apiKey: field("apiKey"),
      region: field("region").trim()
    };
  }
  if (provider.type === "deepl") {
    return { ...provider, label: field("label").trim() || provider.label,
      endpoint: field("endpoint").trim(), apiKey: field("apiKey").trim() };
  }
  if (provider.type === "google-cloud-translation") {
    return {
      ...provider,
      label: field("label").trim() || provider.label,
      apiKey: field("apiKey")
    };
  }
  if (provider.type === "openai-compatible" || provider.type === "anthropic-compatible" || provider.type === "index-translate") {
    return {
      ...provider,
      label: field("label").trim() || provider.label,
      baseURL: field("baseURL").trim(),
      apiKey: field("apiKey"),
      model: field("model").trim(),
      systemPrompt: field("systemPrompt"),
      ...(provider.type === "openai-compatible" ? {
        ollamaCompatibility: field("ollamaCompatibility") === "enabled"
      } : {})
    };
  }
  if (provider.type === "deepseek") {
    return {
      ...provider,
      label: field("label").trim() || provider.label,
      baseURL: field("baseURL").trim() || "https://api.deepseek.com",
      apiKey: field("apiKey"),
      model: field("model").trim() || "deepseek-flash",
      systemPrompt: field("systemPrompt")
    };
  }
  if (provider.type === "zhipu-glm") {
    return {
      ...provider,
      label: field("label").trim() || provider.label,
      baseURL: field("baseURL").trim() || "https://open.bigmodel.cn/api/paas/v4",
      apiKey: field("apiKey"),
      model: field("model").trim() || "glm-4-flash-250414",
      systemPrompt: field("systemPrompt")
    };
  }
  return {
    ...provider,
    label: field("label").trim() || provider.label,
    method: field("method") === "GET" ? "GET" : "POST",
    url: field("url").trim(),
    responsePath: field("responsePath").trim(),
    headers: parseHeaders(field("headers")),
    bodyTemplate: field("bodyTemplate")
  };
}

function parseHeaders(value: string): Record<string, string> {
  const parsed = JSON.parse(value || "{}") as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(t("requestHeadersMustBeAJsonObject"));
  }
  if (!Object.values(parsed).every((entry) => typeof entry === "string")) {
    throw new Error(t("requestHeaderValuesMustBeStrings"));
  }
  return parsed as Record<string, string>;
}

function getEditingProvider(): ProviderConfig {
  const provider = settings.providers.find((entry) => entry.id === editingProviderId)
    ?? settings.providers.find((entry) => entry.id === settings.activeProviderId);
  if (!provider) throw new Error(t("currentTranslationServiceNotFound"));
  editingProviderId = provider.id;
  return provider;
}

function setProviderMenuOpen(open: boolean): void {
  providerMenu.hidden = !open;
  providerTrigger.setAttribute("aria-expanded", String(open));
}

function setStatus(value: string, duration?: number): void {
  clearTimeout(statusTimer);
  statusTimer = undefined;
  status.textContent = value;
  if (duration !== undefined) {
    statusTimer = setTimeout(() => {
      status.textContent = "";
      statusTimer = undefined;
    }, duration);
  }
}

function query<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[char];
  });
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}



function cloneSettings(value: ExtensionSettings): ExtensionSettings {
  return JSON.parse(JSON.stringify(value)) as ExtensionSettings;
}
