import { installedRevision } from "../ocr/model-store";
import type { ExtensionSettings } from "../shared/types";

/** Only the bundled PaddleOCR engine may be used. */
export async function ocrRevision(_settings: Pick<ExtensionSettings, "ocr">): Promise<string | undefined> {
  return installedRevision();
}
export function initOcrService(): void { /* Built-in OCR needs no HTTP service lifecycle. */ }
