import { jsPDF } from 'jspdf';

const PDF_CURRENCY_PATCH_FLAG = '__auditPdfCurrencyFormatPatchInstalled';

function numberFromText(value: string) {
  const cleaned = String(value || '').replace(/[^0-9.,-]/g, '');
  if (!cleaned) return 0;
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  const normalized = hasComma
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : hasDot && /\.\d{3}(\D|$)/.test(cleaned)
      ? cleaned.replace(/\./g, '')
      : cleaned;
  return Number(normalized) || 0;
}

function euro(value: number) {
  return `${Math.round(value || 0).toLocaleString('es-ES')} €`;
}

function normalizeText(value: string) {
  return value
    .replace(/\bEUR\b/g, '€')
    .replace(/(-?\d+(?:[,.]\d+)?)\s*k\s*€/gi, (_match, amount) => euro(numberFromText(amount) * 1000))
    .replace(/(\d)\s*€\s*\/\s*mes/g, '$1 € / mes')
    .replace(/(\d)\s+€/g, '$1 €');
}

function normalizePdfText<T>(value: T): T {
  if (typeof value === 'string') return normalizeText(value) as T;
  if (Array.isArray(value)) return value.map((item) => normalizePdfText(item)) as T;
  return value;
}

function installPdfCurrencyFormatPatch() {
  const win = window as typeof window & { [PDF_CURRENCY_PATCH_FLAG]?: boolean };
  if (win[PDF_CURRENCY_PATCH_FLAG]) return;
  win[PDF_CURRENCY_PATCH_FLAG] = true;

  const api = jsPDF.API as typeof jsPDF.API & { text?: (...args: unknown[]) => unknown };
  const originalText = api.text;
  if (typeof originalText !== 'function') return;

  api.text = function patchedPdfText(this: unknown, text: unknown, ...args: unknown[]) {
    return originalText.call(this, normalizePdfText(text), ...args);
  };
}

installPdfCurrencyFormatPatch();
