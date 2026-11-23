import { t } from "./i18n";

export interface OcrSettings {
  mode: "builtin" | "http";
  /** Complete recognition URL; no path is appended. */
  endpoint: string;
  model: string;
  apiKey: string;
  /** Change this after replacing weights on the server to invalidate caches. */
  modelRevision: string;
}

export const DEFAULT_OCR_SETTINGS: OcrSettings = {
  mode: "builtin", endpoint: "", model: "", apiKey: "", modelRevision: "1"
};

export function normalizeOcrSettings(_value: unknown): OcrSettings {
  return { ...DEFAULT_OCR_SETTINGS };
}
export function validateOcrService(_config: OcrSettings): void {
  throw new Error("Remote OCR services are not included in the offline edition.");
}

export function ocrSettingsIdentity(value: unknown): string {
  const config = normalizeOcrSettings(value);
  return JSON.stringify(config.mode === "builtin" ? { mode: "builtin" } : config);
}

export interface OcrImageInput { dataUrl: string; width: number; height: number }

export function validateOcrImage(input: OcrImageInput): void {
  if (typeof input?.dataUrl !== "string" || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/u.test(input.dataUrl)
    || input.dataUrl.length > 12 * 1024 * 1024 * 4 / 3 + 100
    || !Number.isInteger(input.width) || !Number.isInteger(input.height)
    || input.width <= 0 || input.height <= 0 || input.width > 4096 || input.height > 4096
    || input.width * input.height > 16_000_000) throw new Error(t("unsupportedImageFormatOrDimensionsTryASmaller"));
}
