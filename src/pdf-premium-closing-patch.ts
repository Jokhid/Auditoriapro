import { jsPDF } from 'jspdf';

const FLAG = '__auditPremiumClosingPatchInstalled';
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

const api = jsPDF.API as unknown as {
  text?: (...args: unknown[]) => unknown;
  [FLAG]?: boolean;
};

if (!api[FLAG]) {
  const originalText = new jsPDF().text as unknown as (...args: unknown[]) => unknown;
  api[FLAG] = true;
  api.text = function premiumClosingText(this: jsPDF, text: unknown, x: unknown, y: unknown, ...rest: unknown[]) {
    if (!isOldClosing(text)) {
      return originalText.call(this, text, x, y, ...rest);
    }

    const startX = 14;
    const startY = Math.min(Number(y) || 216, 222);
    const width = 182;
    const height = 54;

    this.setDrawColor(...GOLD);
    this.setFillColor(255, 255, 255);
    this.roundedRect(startX, startY - 4, width, height, 3, 3, 'FD');
    this.setFillColor(...BLACK);
    this.roundedRect(startX, startY - 4, width, 11, 3, 3, 'F');
    this.setFillColor(...GOLD);
    this.rect(startX, startY + 5.5, width, 1.2, 'F');

    this.setFont('Helvetica', 'bold');
    this.setFontSize(8.8);
    this.setTextColor(255, 255, 255);
    originalText.call(this, 'Contacto profesional para transformar el diagnóstico en un plan de acción', startX + 5, startY + 3.2);

    this.setFont('Helvetica', 'normal');
    this.setFontSize(8.2);
    this.setTextColor(...MUTED);
    originalText.call(this, 'Si desea transformar este diagnóstico en mejoras concretas, puede ponerse en contacto con:', startX + 5, startY + 15);

    this.setFont('Helvetica', 'bold');
    this.setFontSize(12.5);
    this.setTextColor(...SLATE);
    originalText.call(this, 'JOSÉ CARLOS HIDALGO', startX + 5, startY + 26);

    this.setFont('Helvetica', 'bold');
    this.setFontSize(8.4);
    this.setTextColor(...SLATE);
    originalText.call(this, 'Teléfono: 647 50 60 40', startX + 5, startY + 35);
    originalText.call(this, 'Email: josecarlos@hilolegal.es', startX + 72, startY + 35);

    this.setDrawColor(...BORDER);
    this.line(startX + 5, startY + 40, startX + width - 5, startY + 40);

    this.setFont('Helvetica', 'normal');
    this.setFontSize(8.1);
    this.setTextColor(...MUTED);
    const finalText = 'El objetivo es ayudarle a corregir las debilidades detectadas, reforzar su protección familiar y construir un plan financiero más sólido, claro y adaptado a su realidad.';
    const lines = this.splitTextToSize(finalText, width - 10) as string[];
    originalText.call(this, lines, startX + 5, startY + 47);

    return this;
  };
}
