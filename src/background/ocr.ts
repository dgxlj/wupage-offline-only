import { t } from "../shared/i18n";
import type { OcrRecognition, OcrStatus } from "../shared/ocr";
import type { RuntimeResponse } from "../shared/types";
import { ensureOffscreenDocument } from "./offscreen";

export async function requestOcr<T = OcrStatus>(action: "status" | "install" | "remove" | "recognize", dataUrl?: string): Promise<T> {
  await ensureOffscreenDocument();
  const response = await chrome.runtime.sendMessage({ target: "ocr-offscreen", action, dataUrl }) as RuntimeResponse;
  if (!response?.ok) throw new Error(response?.error ?? t("ocrCouldNotStartReloadTheExtension"));
  return response.data as T;
}
export async function recognizeImage(dataUrl: string, _settings: import("../shared/types").ExtensionSettings,
  _width: number, _height: number): Promise<OcrRecognition> {
  return requestOcr<OcrRecognition>("recognize", dataUrl);
}
export async function getOcrStatus(_settings: import("../shared/types").ExtensionSettings): Promise<OcrStatus> {
  return requestOcr("status");
}
