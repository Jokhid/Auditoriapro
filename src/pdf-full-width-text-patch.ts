import { jsPDF } from 'jspdf';

const FLAG = '__auditFullWidthTextPatchInstalled';
const FULL_WIDTH = 260;

const targetFragments = [
  'el resumen inicial ordena los datos personales',
  'los objetivos se ordenan por proyecto',
  'esta seccion cuantifica el impacto de cada contingencia',
  'el estudio de jubilacion estima la diferencia',
  'el grafico refleja la proyeccion patrimonial',
  'la lectura de seguridad sintetiza la robustez',
  'el diagnostico prioriza las medidas segun gravedad',
  'situacion de partida la auditoria muestra una seguridad global',
];

function normalize(value: unknown) {
  return String(Array.isArray(value) ? value.join(' ') : value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isOldClosing(text: unknown) {
  const normalized = normalize(text);
  return normalized.includes('si desea transformar este diagnostico en mejoras concretas')
    && normalized.includes('jose carlos hidalgo')
    && normalized.includes('josecarlos hilolegal es')
    && normalized.includes('construir un plan financiero mas solido');
}

function shouldUseFullWidth(text: unknown) {
  const normalized = normalize(text);
  return targetFragments.some((fragment) => normalized.includes(fragment));
}

function premiumClosingLines() {
  return [
    'Si desea transformar este diagnóstico en mejoras concretas, puede ponerse en contacto con:',
    '',
    '                         JOSÉ CARLOS HIDALGO',
    '                         Teléfono: 647 50 60 40',
    '                         Email: josecarlos@hilolegal.es',
    '',
    'El objetivo es ayudarle a corregir las debilidades detectadas, reforzar su protección familiar',
    'y construir un plan financiero más sólido, claro y adaptado a su realidad.',
  ];
}

const api = jsPDF.API as unknown as {
  splitTextToSize?: (text: unknown, maxlen: number, options?: unknown) => string[];
  [FLAG]?: boolean;
};

if (!api[FLAG] && typeof api.splitTextToSize === 'function') {
  const originalSplitTextToSize = api.splitTextToSize;
  api[FLAG] = true;
  api.splitTextToSize = function patchedSplitTextToSize(this: jsPDF, text: unknown, maxlen: number, options?: unknown) {
    if (isOldClosing(text)) return premiumClosingLines();
    const width = shouldUseFullWidth(text) ? FULL_WIDTH : maxlen;
    return originalSplitTextToSize.call(this, text, width, options);
  };
}
