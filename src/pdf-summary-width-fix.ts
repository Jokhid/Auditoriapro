import { jsPDF } from 'jspdf';

const FLAG = '__auditExecutiveSummaryWidthFixInstalled';
const win = window as typeof window & { [FLAG]?: boolean };
const api = jsPDF.API as typeof jsPDF.API & {
  splitTextToSize?: (text: string | string[], maxlen: number, options?: unknown) => string[];
};

if (!win[FLAG] && typeof api.splitTextToSize === 'function') {
  win[FLAG] = true;
  const originalSplitTextToSize = api.splitTextToSize;

  api.splitTextToSize = function splitExecutiveOpeningWider(text, maxlen, options) {
    const content = Array.isArray(text) ? text.join(' ') : String(text || '');
    const widenedMaxLen = content.trim().startsWith('Situación de partida.') && maxlen === 182 ? 196 : maxlen;
    return originalSplitTextToSize.call(this, text, widenedMaxLen, options);
  };
}
