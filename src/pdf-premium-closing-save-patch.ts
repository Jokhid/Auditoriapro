import { jsPDF } from 'jspdf';

const SPLIT_FLAG = '__auditHideOldClosingInstalled';
const SAVE_FLAG = '__auditPremiumClosingSaveInstalled';
const GOLD = [197, 165, 102] as const;
const BLACK = [26, 26, 26] as const;
const SLATE = [15, 23, 42] as const;
const MUTED = [71, 85, 105] as const;
const BORDER = [226, 232, 240] as const;

function normalize(value: unknown) {
  return String(Array.isArray(value) ? value.join(' ') : value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isOldClosing(text: unknown) {
  const value = normalize(text);
  return value.includes('si desea transformar este diagnostico en mejoras concretas')
    && value.includes('jose carlos hidalgo')
    && value.includes('josecarlos@hilolegal.es')
    && value.includes('construir un plan financiero mas solido');
}

function drawPremiumClosing(doc: jsPDF) {
  const startX = 14;
  const startY = 218;
  const width = 182;
  const height = 54;

  doc.setFillColor(255, 255, 255);
  doc.rect(startX - 1, startY - 7, width + 2, height + 10, 'F');
  doc.setDrawColor(...GOLD);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(startX, startY - 4, width, height, 3, 3, 'FD');
  doc.setFillColor(...BLACK);
  doc.roundedRect(startX, startY - 4, width, 11, 3, 3, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(startX, startY + 5.5, width, 1.2, 'F');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(255, 255, 255);
  doc.text('Contacto profesional para transformar el diagnóstico en un plan de acción', startX + width / 2, startY + 3.2, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(...MUTED);
  doc.text('Si desea transformar este diagnóstico en mejoras concretas, puede ponerse en contacto con:', startX + width / 2, startY + 15, { align: 'center' });

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(...SLATE);
  doc.text('JOSÉ CARLOS HIDALGO', startX + width / 2, startY + 27, { align: 'center' });

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.text('Teléfono: 647 50 60 40', startX + width / 2, startY + 36, { align: 'center' });
  doc.text('Email: josecarlos@hilolegal.es', startX + width / 2, startY + 44, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.7);
  doc.setTextColor(...MUTED);
  const finalText = 'El objetivo es ayudarle a corregir las debilidades detectadas, reforzar su protección familiar y construir un plan financiero más sólido, claro y adaptado a su realidad.';
  const lines = doc.splitTextToSize(finalText, width - 18) as string[];
  doc.text(lines.slice(0, 2), startX + width / 2, startY + 55, { align: 'center' });
}

const api = jsPDF.API as unknown as {
  splitTextToSize?: (text: unknown, maxlen: number, options?: unknown) => string[];
  save?: (...args: unknown[]) => unknown;
  [SPLIT_FLAG]?: boolean;
  [SAVE_FLAG]?: boolean;
};

if (!api[SPLIT_FLAG] && typeof api.splitTextToSize === 'function') {
  const originalSplit = api.splitTextToSize;
  api[SPLIT_FLAG] = true;
  api.splitTextToSize = function patchedSplitTextToSize(this: jsPDF, text: unknown, maxlen: number, options?: unknown) {
    if (isOldClosing(text)) return [''];
    return originalSplit.call(this, text, maxlen, options);
  };
}

if (!api[SAVE_FLAG]) {
  const originalSave = new jsPDF().save as unknown as (...args: unknown[]) => unknown;
  api[SAVE_FLAG] = true;
  api.save = function patchedSave(this: jsPDF, ...args: unknown[]) {
    try {
      drawPremiumClosing(this);
    } catch (error) {
      console.warn('No se pudo añadir el cierre premium al PDF', error);
    }
    return originalSave.apply(this, args);
  };
}
