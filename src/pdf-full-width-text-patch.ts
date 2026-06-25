import { jsPDF } from 'jspdf';

const FLAG = '__auditFullWidthTextPatchInstalled';
const FULL_WIDTH = 194;

const targetFragments = [
  'El resumen inicial ordena los datos personales',
  'Los objetivos se ordenan por proyecto',
  'Esta sección cuantifica el impacto de cada contingencia',
  'El estudio de jubilación estima la diferencia',
  'El gráfico refleja la proyección patrimonial',
  'La lectura de seguridad sintetiza la robustez',
  'El diagnóstico prioriza las medidas según gravedad',
  'Situación de partida. La auditoría muestra una seguridad global',
];

function normalize(value: unknown) {
  return String(Array.isArray(value) ? value.join(' ') : value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function shouldUseFullWidth(text: unknown) {
  const normalized = normalize(text);
  return targetFragments.some((fragment) => normalized.includes(fragment));
}

const api = jsPDF.API as unknown as {
  splitTextToSize?: (text: unknown, maxlen: number, options?: unknown) => string[];
  [FLAG]?: boolean;
};

if (!api[FLAG] && typeof api.splitTextToSize === 'function') {
  const originalSplitTextToSize = api.splitTextToSize;
  api[FLAG] = true;
  api.splitTextToSize = function patchedSplitTextToSize(this: jsPDF, text: unknown, maxlen: number, options?: unknown) {
    const width = shouldUseFullWidth(text) ? Math.max(maxlen || 0, FULL_WIDTH) : maxlen;
    return originalSplitTextToSize.call(this, text, width, options);
  };
}
