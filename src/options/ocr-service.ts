import { setupOcrControl } from "../shared/ocr-control";
import { DEFAULT_OCR_SETTINGS, type OcrSettings } from "../shared/ocr-service";

export function setupOcrSettings(toggle: HTMLInputElement, onRemoved: () => void,
  _initial?: OcrSettings, _reveal?: (element: HTMLElement) => void): {
  render: (value?: OcrSettings) => void;
  read: () => OcrSettings;
} {
  const root = document.getElementById("ocrServiceSettings");
  if (root) root.textContent = "仅支持内置 PaddleOCR。模型可联网下载，文字识别在本机完成。";
  const read = () => ({ ...DEFAULT_OCR_SETTINGS });
  const control = setupOcrControl(toggle, onRemoved, { getConfig: read });
  return { read, render: () => { void control.refresh(); } };
}
