import { stripVTControlCharacters } from 'node:util';

export function normalizeTuiCapture(input: string): string {
  return stripVTControlCharacters(input)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    .replace(/\b20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/g, '<TIMESTAMP>')
    .replace(/\s+$/gm, '')
    .trim();
}

export function assertCaptureContains(input: string, labels: string[]): void {
  const normalized = normalizeTuiCapture(input);
  for (const label of labels) {
    if (!normalized.includes(label)) {
      throw new Error(`TUI capture missing expected label: ${label}`);
    }
  }
}
